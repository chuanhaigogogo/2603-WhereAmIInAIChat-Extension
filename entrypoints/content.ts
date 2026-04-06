import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { SidebarApp } from '../src/sidebar/SidebarApp';
import { createDefaultRegistry } from '../src/adapters/AdapterRegistry';
import { ConversationStream } from '../src/observers/ConversationStream';
import { useMindFlowStore } from '../src/state/store';
import type { PlatformAdapter } from '../src/adapters/PlatformAdapter';

let currentAdapter: PlatformAdapter | null = null;

// Force re-scan the page for messages right now
function rescanMessages() {
  if (!currentAdapter) return;
  const messages = currentAdapter.getAllMessages();
  if (messages.length > 0) {
    useMindFlowStore.getState().updateMessages(messages);
  }
}

export default defineContentScript({
  matches: [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://chat.deepseek.com/*',
    'https://www.doubao.com/*',
    'https://www.perplexity.ai/*',
    'https://grok.com/*',
  ],

  async main() {

    await useMindFlowStore.getState().loadSettings();

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.mindflow_api_provider) {
        useMindFlowStore.getState().loadSettings();
      }
    });

    browser.runtime.onMessage.addListener((msg: { type: string }) => {
      if (msg.type === 'toggle-sidebar') {
        useMindFlowStore.getState().toggleSidebar();
      }
      if (msg.type === 'generate-mindmap') {
        // Always rescan before generating
        rescanMessages();
        useMindFlowStore.getState().generateMindMap();
      }
    });

    // Mount sidebar after delay
    setTimeout(() => {
      if (document.getElementById('mindflow-root')) return;
      const el = document.createElement('div');
      el.id = 'mindflow-root';
      document.body.appendChild(el);
      createRoot(el).render(createElement(SidebarApp));
    }, 3000);

    // Detect adapter
    const registry = createDefaultRegistry();
    currentAdapter = registry.detect(window.location.href);

    if (!currentAdapter) {
      return;
    }


    await new Promise((r) => setTimeout(r, 4000));

    const stream = new ConversationStream(currentAdapter, (messages) => {
      useMindFlowStore.getState().updateMessages(messages);
    });

    const started = stream.start();
    if (!started) {
      setTimeout(() => stream.start(), 3000);
    }
  },
});
