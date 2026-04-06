import type { PlatformAdapter } from './PlatformAdapter';
import { ChatGPTAdapter } from './ChatGPTAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { DeepSeekAdapter } from './DeepSeekAdapter';
import { DoubaoAdapter } from './DoubaoAdapter';
import { PerplexityAdapter } from './PerplexityAdapter';
import { GrokAdapter } from './GrokAdapter';

export class AdapterRegistry {
  private adapters: PlatformAdapter[] = [];

  register(adapter: PlatformAdapter): void {
    this.adapters.push(adapter);
  }

  detect(url: string): PlatformAdapter | null {
    return this.adapters.find((a) => a.matches(url)) ?? null;
  }
}

export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new ChatGPTAdapter());
  registry.register(new ClaudeAdapter());
  registry.register(new GeminiAdapter());
  registry.register(new DeepSeekAdapter());
  registry.register(new DoubaoAdapter());
  registry.register(new PerplexityAdapter());
  registry.register(new GrokAdapter());
  return registry;
}
