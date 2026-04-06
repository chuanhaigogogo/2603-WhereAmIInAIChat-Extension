import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

/**
 * Doubao Chat adapter (www.doubao.com)
 *
 * DOM notes (ByteDance / Semi Design framework):
 * - User messages: div[data-testid="send_message"]
 * - Assistant messages: div[data-testid="receive_message"]
 * - Message wrapper: div[data-testid="union_message"]
 * - Text content: div[data-testid="message_text_content"]
 * - Scroll container: div[class^="scrollable-"]
 */

const SELECTORS = {
  conversationContainer: [
    'div[class^="scrollable-"]',
    'main',
  ],
  userMessage: '[data-testid="send_message"]',
  assistantMessage: '[data-testid="receive_message"]',
  unionMessage: '[data-testid="union_message"]',
  messageTextContent: '[data-testid="message_text_content"]',
  streamingIndicator: [
    'button[data-testid*="stop"]',
    '.semi-button[aria-label*="stop"]',
    '.semi-button[aria-label*="Stop"]',
  ],
};

export class DoubaoAdapter implements PlatformAdapter {
  readonly platformName = 'Doubao';

  matches(url: string): boolean {
    return url.includes('doubao.com');
  }

  getConversationContainerSelectors(): string[] {
    return SELECTORS.conversationContainer;
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const role = this.detectRole(el);
    if (!role) return null;

    // Try to get text from the message_text_content child first
    const textEl = el.querySelector(SELECTORS.messageTextContent) || el;
    const content = getPlainText(textEl);
    if (!content || content.length < 2) return null;

    const { headings, listItems, codeBlocks, boldTerms } = extractStructure(textEl);

    return {
      id: generateMessageId(),
      role,
      content,
      rawHTML: textEl.innerHTML,
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

    // Find all union_message wrappers, then detect role
    const unionMessages = document.querySelectorAll(SELECTORS.unionMessage);

    if (unionMessages.length > 0) {
      for (const el of unionMessages) {
        const msg = this.parseMessageElement(el);
        if (msg && !seen.has(msg.content.slice(0, 80))) {
          seen.add(msg.content.slice(0, 80));
          messages.push(msg);
        }
      }
      return messages;
    }

    // Fallback: try send_message and receive_message separately
    const userEls = document.querySelectorAll(SELECTORS.userMessage);
    const assistantEls = document.querySelectorAll(SELECTORS.assistantMessage);

    for (const el of userEls) {
      const msg = this.parseMessageElement(el);
      if (msg) { msg.role = 'user'; messages.push(msg); }
    }
    for (const el of assistantEls) {
      const msg = this.parseMessageElement(el);
      if (msg) { msg.role = 'assistant'; messages.push(msg); }
    }

    // Sort by DOM position
    return messages;
  }

  isMessageMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    if (!target?.closest) return false;
    return target.closest(SELECTORS.unionMessage) !== null
      || target.closest(SELECTORS.userMessage) !== null
      || target.closest(SELECTORS.assistantMessage) !== null;
  }

  isStreaming(): boolean {
    return SELECTORS.streamingIndicator.some(
      sel => document.querySelector(sel) !== null
    );
  }

  private detectRole(el: Element): 'user' | 'assistant' | null {
    // Check data-testid on the element or its parents
    if (el.matches(SELECTORS.userMessage) || el.querySelector(SELECTORS.userMessage) || el.closest(SELECTORS.userMessage)) {
      return 'user';
    }
    if (el.matches(SELECTORS.assistantMessage) || el.querySelector(SELECTORS.assistantMessage) || el.closest(SELECTORS.assistantMessage)) {
      return 'assistant';
    }

    // For union_message, check which child type it contains
    if (el.matches(SELECTORS.unionMessage)) {
      if (el.querySelector(SELECTORS.userMessage)) return 'user';
      if (el.querySelector(SELECTORS.assistantMessage)) return 'assistant';
    }

    return null;
  }
}
