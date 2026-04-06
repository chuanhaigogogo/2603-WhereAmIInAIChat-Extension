import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

/**
 * Claude.ai adapter.
 * DOM structure (as of 2026-03):
 * - Scroll container: div.overflow-y-auto
 * - User messages: div[data-testid="user-message"]
 * - Assistant messages: NO data-testid, but they are sibling groups
 *   next to user messages in the conversation flow.
 *
 * Strategy: find all user-message elements, then for each one,
 * look at the next sibling group to find the assistant response.
 */

const SELECTORS = {
  conversationContainer: [
    'div.overflow-y-auto',
    '.overflow-y-auto',
    'main .overflow-y-auto',
  ],
  userMessage: '[data-testid="user-message"]',
  streamingIndicator: [
    'button[aria-label="Stop Response"]',
    'button[aria-label="Stop"]',
    '[data-testid="stop-button"]',
  ],
};

export class ClaudeAdapter implements PlatformAdapter {
  readonly platformName = 'Claude';

  matches(url: string): boolean {
    return url.includes('claude.ai');
  }

  getConversationContainerSelectors(): string[] {
    return SELECTORS.conversationContainer;
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const role = this.detectRole(el);
    if (!role) return null;

    const content = getPlainText(el);
    if (!content || content.length < 2) return null;

    const { headings, listItems, codeBlocks, boldTerms } =
      extractStructure(el);

    return {
      id: generateMessageId(),
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
    const container = this.findContainer();
    if (!container) return messages;

    // Find all user messages
    const userMsgEls = container.querySelectorAll(SELECTORS.userMessage);

    for (const userEl of userMsgEls) {
      // Parse user message
      const userMsg = this.parseMessageElement(userEl);
      if (userMsg) {
        userMsg.role = 'user';
        messages.push(userMsg);
      }

      // Find the assistant response: walk up to the conversation turn wrapper,
      // then look for the next sibling that contains the assistant's response
      const assistantEl = this.findAssistantResponse(userEl);
      if (assistantEl) {
        const assistantMsg = this.parseMessageElement(assistantEl);
        if (assistantMsg) {
          assistantMsg.role = 'assistant';
          messages.push(assistantMsg);
        }
      }
    }

    return messages;
  }

  isMessageMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    if (!target?.closest) return false;
    // Any mutation within the scroll container is potentially relevant
    const container = this.findContainer();
    return container?.contains(target) ?? false;
  }

  isStreaming(): boolean {
    return SELECTORS.streamingIndicator.some(
      (sel) => document.querySelector(sel) !== null
    );
  }

  private findContainer(): Element | null {
    for (const sel of SELECTORS.conversationContainer) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /**
   * Given a user message element, find the corresponding assistant response.
   * Strategy: walk up the DOM tree to the "turn" level, then find the next
   * turn which should be the assistant's response.
   */
  private findAssistantResponse(userEl: Element): Element | null {
    // Walk up to find the turn-level container
    // User message is inside: turn-wrapper > ... > [data-testid="user-message"]
    // We need to go up until we find a sibling that contains non-user content
    let turnEl: Element | null = userEl;

    // Go up max 5 levels to find the turn boundary
    for (let i = 0; i < 5; i++) {
      const parent = turnEl?.parentElement;
      if (!parent) break;

      // Check if this parent has multiple children that look like turn groups
      const nextSibling = turnEl.nextElementSibling;
      if (nextSibling && !nextSibling.querySelector(SELECTORS.userMessage)) {
        // Next sibling doesn't contain a user message, so it's likely the assistant response
        return nextSibling;
      }

      turnEl = parent;
    }

    return null;
  }

  private detectRole(el: Element): 'user' | 'assistant' | null {
    // Check if this element or its children have the user-message testid
    if (
      el.getAttribute('data-testid') === 'user-message' ||
      el.querySelector(SELECTORS.userMessage)
    ) {
      return 'user';
    }
    // If it's not a user message and contains substantial text, assume assistant
    const text = el.textContent ?? '';
    if (text.length > 20) {
      return 'assistant';
    }
    return null;
  }
}
