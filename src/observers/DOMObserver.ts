import type { PlatformAdapter } from '../adapters/PlatformAdapter';

export type MessageCallback = (el: Element) => void;

export class DOMObserver {
  private observer: MutationObserver | null = null;
  private container: Element | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMutations: Element[] = [];

  constructor(
    private adapter: PlatformAdapter,
    private onNewMessage: MessageCallback,
    private debounceMs: number = 500
  ) {}

  start(): boolean {
    const container = this.findContainer();
    if (!container) {
      return false;
    }

    this.container = container;
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.container = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private findContainer(): Element | null {
    const selectors = this.adapter.getConversationContainerSelectors();
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      if (this.adapter.isMessageMutation(mutation)) {
        const target = mutation.target as Element;
        if (target && !this.pendingMutations.includes(target)) {
          this.pendingMutations.push(target);
        }
      }

      // Check added nodes
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            this.pendingMutations.push(node);
          }
        });
      }
    }

    // Debounce: wait for streaming to finish
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flushPending();
    }, this.adapter.isStreaming() ? this.debounceMs * 2 : this.debounceMs);
  }

  private flushPending(): void {
    const elements = [...this.pendingMutations];
    this.pendingMutations = [];
    for (const el of elements) {
      this.onNewMessage(el);
    }
  }
}
