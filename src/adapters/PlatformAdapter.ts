import type { ConversationMessage } from '../core/types';

export interface PlatformAdapter {
  readonly platformName: string;

  /** Check if this adapter handles the current URL */
  matches(url: string): boolean;

  /** CSS selectors for the conversation container to observe */
  getConversationContainerSelectors(): string[];

  /** Parse a single message DOM element into structured data */
  parseMessageElement(el: Element): ConversationMessage | null;

  /** Get all existing messages on page load */
  getAllMessages(): ConversationMessage[];

  /** Detect if a DOM mutation represents a new or updated message */
  isMessageMutation(mutation: MutationRecord): boolean;

  /** Detect if assistant is still streaming */
  isStreaming(): boolean;
}

/** Extract structural elements from HTML content */
export function extractStructure(el: Element): {
  headings: string[];
  listItems: string[];
  codeBlocks: string[];
  boldTerms: string[];
} {
  const headings: string[] = [];
  const listItems: string[] = [];
  const codeBlocks: string[] = [];
  const boldTerms: string[] = [];

  el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const text = h.textContent?.trim();
    if (text) headings.push(text);
  });

  el.querySelectorAll('li').forEach((li) => {
    const text = li.textContent?.trim();
    if (text) listItems.push(text);
  });

  el.querySelectorAll('pre code').forEach((code) => {
    const text = code.textContent?.trim();
    if (text) codeBlocks.push(text);
  });

  el.querySelectorAll('strong, b').forEach((b) => {
    const text = b.textContent?.trim();
    if (text) boldTerms.push(text);
  });

  return { headings, listItems, codeBlocks, boldTerms };
}

/** Get plain text from element, stripping code blocks */
export function getPlainText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('pre code').forEach((code) => code.remove());
  return clone.textContent?.trim() ?? '';
}

let messageCounter = 0;
export function generateMessageId(): string {
  return `msg-${Date.now()}-${messageCounter++}`;
}
