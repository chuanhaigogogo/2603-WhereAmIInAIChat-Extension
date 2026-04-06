import type { ConversationMessage } from '../core/types';
import {
  PlatformAdapter,
  extractStructure,
  getPlainText,
  generateMessageId,
} from './PlatformAdapter';

export class GeminiAdapter implements PlatformAdapter {
  readonly platformName = 'Gemini';

  matches(url: string): boolean {
    return url.includes('gemini.google.com');
  }

  getConversationContainerSelectors(): string[] {
    return [
      '.conversation-container',
      'infinite-scroller',
      'chat-window',
      'main',
    ];
  }

  parseMessageElement(el: Element): ConversationMessage | null {
    const isUser = el.tagName.toLowerCase() === 'user-query' || el.closest('user-query') !== null;
    const isModel = el.tagName.toLowerCase() === 'model-response' || el.closest('model-response') !== null;

    if (!isUser && !isModel) return null;

    const role = isUser ? 'user' : 'assistant';
    const content = getPlainText(el);
    if (!content) return null;

    const { headings, listItems, codeBlocks, boldTerms } = extractStructure(el);

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
    const seen = new Set<string>();

    // Get all user queries and model responses in DOM order
    const elements = document.querySelectorAll('user-query, model-response');
    elements.forEach((el) => {
      const role = el.tagName.toLowerCase() === 'user-query' ? 'user' : 'assistant';
      const content = getPlainText(el);
      if (!content) return;

      // Dedup by content hash
      const key = `${role}:${content.slice(0, 100)}`;
      if (seen.has(key)) return;
      seen.add(key);

      const { headings, listItems, codeBlocks, boldTerms } = extractStructure(el);

      messages.push({
        id: generateMessageId(),
        role,
        content,
        rawHTML: el.innerHTML,
        timestamp: Date.now(),
        headings,
        listItems,
        codeBlocks,
        boldTerms,
      });
    });

    return messages;
  }

  isMessageMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    if (!target?.closest) return false;
    return target.closest('user-query') !== null
      || target.closest('model-response') !== null;
  }

  isStreaming(): boolean {
    return document.querySelector('mat-icon[data-mat-icon-name="stop_circle"]') !== null
      || document.querySelector('.loading-indicator') !== null;
  }
}
