export default defineBackground(() => {
  // Toggle sidebar when extension icon is clicked
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await browser.tabs.sendMessage(tab.id, { type: 'toggle-sidebar' });
    }
  });

  // Context menu
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus?.create({
      id: 'mindflow-toggle',
      title: 'Toggle MindFlow Sidebar',
      contexts: ['page'],
      documentUrlPatterns: [
        'https://chatgpt.com/*',
        'https://chat.openai.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*',
      ],
    });
  });

  browser.contextMenus?.onClicked.addListener(
    async (info, tab) => {
      if (info.menuItemId === 'mindflow-toggle' && tab?.id) {
        await browser.tabs.sendMessage(tab.id, { type: 'toggle-sidebar' });
      }
    }
  );

  // API proxy: content script sends request here to bypass CSP
  browser.runtime.onMessage.addListener(
    (msg: any, _sender: any, sendResponse: (response: any) => void) => {
      if (msg.type === 'api-fetch') {
        handleApiFetch(msg).then(sendResponse).catch(() => sendResponse({ error: 'fetch failed' }));
        return true; // keep channel open for async response
      }
    }
  );

});

type ProviderStyle = 'anthropic' | 'openai' | 'gemini';

interface ApiFetchRequest {
  type: 'api-fetch';
  provider: string;
  apiKey: string;
  userPrompt: string;
  config: {
    endpoint: string;
    model: string;
    style: ProviderStyle;
    maxTokens: number;
    temperature: number;
    systemPrompt?: string;
  };
}

async function handleApiFetch(msg: ApiFetchRequest): Promise<{ text?: string; error?: string }> {
  const { apiKey, userPrompt, config } = msg;

  try {
    let text = '';

    if (config.style === 'anthropic') {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          ...(config.systemPrompt ? { system: config.systemPrompt } : {}),
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) return { error: `${res.status}` };
      const data = await res.json();
      text = data.content?.[0]?.text ?? '';
      const stopReason = data.stop_reason ?? data.content?.[0]?.stop_reason ?? '';

    } else if (config.style === 'gemini') {
      const url = `${config.endpoint}/${config.model}:generateContent`;
      const body: any = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: config.temperature, maxOutputTokens: 65536 },
      };
      if (config.systemPrompt) {
        body.systemInstruction = { parts: [{ text: config.systemPrompt }] };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { error: `${res.status}` };
      const data = await res.json();
      const finishReason = data.candidates?.[0]?.finishReason ?? '';
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      text = parts.filter((p: { text?: string }) => p.text).pop()?.text ?? '';

    } else {
      // openai-compatible
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [
            ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!res.ok) return { error: `${res.status}` };
      const data = await res.json();
      text = data.choices?.[0]?.message?.content ?? '';
      const finishReason = data.choices?.[0]?.finish_reason ?? '';
    }

    return { text };
  } catch (e) {
    return { error: String(e) };
  }
}
