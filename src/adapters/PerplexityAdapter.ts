import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

/**
 * Perplexity AI adapter (www.perplexity.ai)
 *
 * DOM notes:
 * - User query: div[data-testid="user-query"] or elements with user query styling
 * - AI answer: div[data-testid="answer-content"] or prose content blocks
 * - Container: the main scrollable area
 */

export class PerplexityAdapter implements PlatformAdapter {
  readonly platformName = 'Perplexity';

  matches(url: string): boolean {
    return url.includes('perplexity.ai');
  }

  getConversationContainerSelectors(): string[] {
    return [
      '.scrollable-container',
      'main',
    ];
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const role = this.detectRole(el);
    if (!role) return null;

    const content = getPlainText(el);
    if (!content || content.length < 2) return null;

    const { headings, listItems, codeBlocks, boldTerms } = extractStructure(el);

    return {
      id: el.id || generateMessageId(),
      role,
      content,
      rawHTML: el.innerHTML,
      timestamp: Date.now(),
      headings,
      listItems,
      codeBlocks,
      boldTerms,
    };
  }

  getAllMessages(): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    const seen = new Set<string>();

    // Perplexity user queries: inside .group\/query elements with bg-subtle bubble
    const queryEls = document.querySelectorAll('.group\\/query .bg-subtle');
    for (const el of queryEls) {
      const content = getPlainText(el);
      if (!content || content.length < 2) continue;
      const key = content.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      messages.push({
        id: generateMessageId(),
        role: 'user',
        content,
        rawHTML: el.innerHTML,
        timestamp: Date.now(),
        headings: [], listItems: [], codeBlocks: [], boldTerms: [],
      });
    }

    // Perplexity answers: div[id^="markdown-content-"]
    const answerEls = document.querySelectorAll('[id^="markdown-content-"]');
    for (const el of answerEls) {
      const content = getPlainText(el);
      if (!content || content.length < 10) continue;
      const key = content.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      const { headings, listItems, codeBlocks, boldTerms } = extractStructure(el);
      messages.push({
        id: el.id,
        role: 'assistant',
        content,
        rawHTML: el.innerHTML,
        timestamp: Date.now(),
        headings, listItems, codeBlocks, boldTerms,
      });
    }

    // Interleave: Perplexity always alternates query → answer
    // The queries and answers are already in DOM order, so just sort by position
    // Actually they're already paired since we push user then assistant in order

    return messages;
  }

  isMessageMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    if (!target?.closest) return false;
    return target.closest('[id^="markdown-content-"]') !== null
      || target.closest('.group\\/query') !== null;
  }

  isStreaming(): boolean {
    return document.querySelector('button[aria-label="Stop"]') !== null
      || document.querySelector('[class*="cursor-blink"]') !== null;
  }

  private detectRole(el: Element): 'user' | 'assistant' | null {
    if (el.id?.startsWith('markdown-content-')) return 'assistant';
    if (el.closest?.('.group\\/query')) return 'user';
    if (el.classList?.contains('bg-subtle')) return 'user';

    const text = el.textContent ?? '';
    if (text.length > 100) return 'assistant';
    if (text.length > 0) return 'user';
    return null;
  }
}
