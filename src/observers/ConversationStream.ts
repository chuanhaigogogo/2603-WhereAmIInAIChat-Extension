import type { PlatformAdapter } from '../adapters/PlatformAdapter';
import type { ConversationMessage } from '../core/types';
import { DOMObserver } from './DOMObserver';

export type ConversationCallback = (messages: ConversationMessage[]) => void;

export class ConversationStream {
  private observer: DOMObserver;
  private processedIds = new Set<string>();
  private messageBuffer: ConversationMessage[] = [];

  constructor(
    private adapter: PlatformAdapter,
    private onUpdate: ConversationCallback
  ) {
    this.observer = new DOMObserver(adapter, (el) =>
      this.handleElement(el)
    );
  }

  start(): boolean {
    this.scanExisting();

    const ok = this.observer.start();

    // Retry scan a few times in case DOM loads lazily
    setTimeout(() => this.scanExisting(), 2000);
    setTimeout(() => this.scanExisting(), 5000);

    return ok;
  }

  private scanExisting(): void {
    const existing = this.adapter.getAllMessages();
    let added = 0;
    for (const msg of existing) {
      if (!this.processedIds.has(msg.id)) {
        this.processedIds.add(msg.id);
        this.messageBuffer.push(msg);
        added++;
      }
    }
    if (added > 0) {
      this.onUpdate([...this.messageBuffer]);
    }
  }

  stop(): void {
    this.observer.stop();
  }

  private handleElement(el: Element): void {
    const msg = this.adapter.parseMessageElement(el);
    if (!msg) return;

    if (this.processedIds.has(msg.id)) {
      // Update existing message (streaming update)
      const idx = this.messageBuffer.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        this.messageBuffer[idx] = msg;
      }
    } else {
      this.processedIds.add(msg.id);
      this.messageBuffer.push(msg);
    }

    this.onUpdate([...this.messageBuffer]);
  }
}
