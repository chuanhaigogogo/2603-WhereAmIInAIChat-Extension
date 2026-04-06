import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

/**
 * Grok adapter (grok.com)
 *
 * DOM notes:
 * - Grok by xAI uses a React-based chat interface
 * - User messages and AI responses are in alternating message blocks
 * - Uses data attributes and role-based identification
 */

export class GrokAdapter implements PlatformAdapter {
  readonly platformName = 'Grok';

  matches(url: string): boolean {
    return url.includes('grok.com');
  }

  getConversationContainerSelectors(): string[] {
    return [
      'main .overflow-y-auto',
      'main',
    ];
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const role = this.detectRole(el);
    if (!role) return null;

    // Extract content from the markdown area inside the message
    const contentEl = el.querySelector('.response-content-markdown') ?? el;
    const content = getPlainText(contentEl);
    if (!content || content.length < 2) return null;

    const { headings, listItems, codeBlocks, boldTerms } = extractStructure(contentEl);

    return {
      id: el.id || generateMessageId(),
      role,
      content,
      rawHTML: contentEl.innerHTML,
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

    // Grok uses div[id^="response-"] for each message container
    const messageEls = document.querySelectorAll('[id^="response-"]');

    for (const el of messageEls) {
      const msg = this.parseMessageElement(el);
      if (msg) {
        const key = msg.content.slice(0, 80);
        if (!seen.has(key)) {
          seen.add(key);
          messages.push(msg);
        }
      }
    }

    return messages;
  }

  isMessageMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    if (!target?.closest) return false;
    return target.closest('[id^="response-"]') !== null;
  }

  isStreaming(): boolean {
    return document.querySelector('button[aria-label="Stop"]') !== null
      || document.querySelector('[class*="typing"]') !== null
      || document.querySelector('[class*="loading"]') !== null;
  }

  private detectRole(el: Element): 'user' | 'assistant' | null {
    // Grok aligns user messages to the right (items-end) and
    // assistant messages to the left (items-start)
    if (el.classList.contains('items-end')) return 'user';
    if (el.classList.contains('items-start')) return 'assistant';

    // Fallback: user message bubbles have bg-surface-l1 background
    const bubble = el.querySelector('.message-bubble');
    if (bubble) {
      if (bubble.classList.contains('bg-surface-l1')) return 'user';
      if (bubble.classList.contains('max-w-none')) return 'assistant';
    }

    return null;
  }
}
