import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

const SELECTORS = {
  conversationContainer: [
    'main div[class*="react-scroll"]',
    'main .overflow-y-auto',
    '[role="presentation"]',
    'main',
  ],
  streamingIndicator: [
    'button[aria-label="Stop generating"]',
    'button[data-testid="stop-button"]',
    '.result-streaming',
  ],
};

export class ChatGPTAdapter implements PlatformAdapter {
  readonly platformName = 'ChatGPT';

  matches(url: string): boolean {
    return (
      url.includes('chatgpt.com') || url.includes('chat.openai.com')
    );
  }

  getConversationContainerSelectors(): string[] {
    return SELECTORS.conversationContainer;
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const roleEl = el.hasAttribute('data-message-author-role')
      ? el
      : el.querySelector('[data-message-author-role]');

    if (!roleEl) return null;

    const roleAttr = roleEl.getAttribute('data-message-author-role');
    if (roleAttr !== 'user' && roleAttr !== 'assistant') return null;

    // Walk up to find the element that contains the actual message text.
    // The role attribute is often on a small inner element; the text is
    // in the surrounding article or a parent div.
    let contentEl: Element = el;
    const article = el.closest('article') || el.closest('[data-testid^="conversation-turn"]');
    if (article) {
      contentEl = article;
    } else {
      // Walk up a few levels to find a container with meaningful text
      let cur: Element | null = el;
      for (let i = 0; i < 5 && cur; i++) {
        if ((cur.textContent?.trim().length ?? 0) > 20) {
          contentEl = cur;
          break;
        }
        cur = cur.parentElement;
      }
    }

    const content = getPlainText(contentEl);
    if (!content) return null;

    const { headings, listItems, codeBlocks, boldTerms } = extractStructure(contentEl);
    const id = contentEl.getAttribute('data-message-id')
      ?? contentEl.querySelector('[data-message-id]')?.getAttribute('data-message-id')
      ?? generateMessageId();

    return {
      id,
      role: roleAttr,
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

    const roleElements = document.querySelectorAll('[data-message-author-role]');
    let skipped = 0;
    roleElements.forEach((el) => {
      const msg = this.parseMessageElement(el);
      if (msg && !seen.has(msg.id)) {
        seen.add(msg.id);
        messages.push(msg);
      } else if (!msg) {
        skipped++;
      }
    });

    return messages;
  }

  isMessageMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    if (!target?.closest) return false;
    return target.closest('[data-message-author-role]') !== null
      || target.closest('article[data-testid^="conversation-turn"]') !== null;
  }

  isStreaming(): boolean {
    return SELECTORS.streamingIndicator.some(
      (sel) => document.querySelector(sel) !== null
    );
  }
}
