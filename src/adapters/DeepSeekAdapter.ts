import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

/**
 * DeepSeek Chat adapter (chat.deepseek.com)
 *
 * DOM notes:
 * - DeepSeek uses hashed class names that change between deploys
 * - Stable selectors: .ds-markdown, .ds-scroll-area (design system prefix)
 * - Assistant markdown content: div.ds-markdown.ds-markdown--block
 * - User/assistant distinction: structural position within message groups
 */

export class DeepSeekAdapter implements PlatformAdapter {
  readonly platformName = 'DeepSeek';

  matches(url: string): boolean {
    return url.includes('deepseek.com');
  }

  getConversationContainerSelectors(): string[] {
    return [
      '.ds-virtual-list-items',
      '.ds-scroll-area',
      'main',
    ];
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const role = this.detectRole(el);
    if (!role) return null;

    // For assistant messages, extract from the ds-markdown block (skip thinking content)
    const contentEl = role === 'assistant'
      ? el.querySelector('div.ds-markdown:not(.ds-think-content div.ds-markdown)') ?? el
      : el;

    const content = getPlainText(contentEl);
    if (!content || content.length < 2) return null;

    const { headings, listItems, codeBlocks, boldTerms } = extractStructure(contentEl);

    return {
      id: generateMessageId(),
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

    // DeepSeek uses .ds-message inside a virtual list
    // Target only messages within the virtual list to avoid sidebar content
    const msgEls = document.querySelectorAll('.ds-virtual-list-visible-items .ds-message');

    for (const el of msgEls) {
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
    return target.closest('.ds-virtual-list-visible-items') !== null
      || target.closest('.ds-message') !== null;
  }

  isStreaming(): boolean {
    return document.querySelector('div.ds-icon-button[class*="stop"]') !== null
      || document.querySelector('button[aria-label="Stop"]') !== null
      || document.querySelector('.result-streaming') !== null;
  }

  private detectRole(el: Element): 'user' | 'assistant' | null {
    // Assistant messages contain ds-markdown content blocks
    const markdown = el.querySelector('div.ds-markdown');
    if (markdown) {
      // Check it's not ONLY inside thinking — real response has ds-markdown outside ds-think-content
      const thinkContent = el.querySelector('.ds-think-content');
      const nonThinkMarkdown = el.querySelector('div.ds-markdown:not(.ds-think-content div.ds-markdown)');
      if (nonThinkMarkdown || !thinkContent) return 'assistant';
    }

    // No ds-markdown means it's a user message
    const text = el.textContent?.trim() ?? '';
    if (text.length > 0) return 'user';

    return null;
  }
}
