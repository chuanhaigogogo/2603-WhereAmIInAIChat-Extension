Last updated: April 6, 2026

## Overview

MindFlow is a Chrome extension that generates mind maps and review notes from AI conversations. We are committed to protecting your privacy.

## Data Collection

MindFlow does NOT collect, store, or transmit any personal data to external servers. We do not operate any backend server or database.

## How Your Data Is Handled

### API Key

Your API key is stored locally in your browser using Chrome's built-in storage API. It is never sent to MindFlow's servers — we don't have any. When you click "Generate," your API key is used to send conversation content directly to your chosen AI provider. MindFlow acts only as a bridge between your browser and your AI provider.

### Conversation Content

MindFlow reads your AI conversation content only when you explicitly click the "Generate" button. The content is sent directly from your browser to your chosen AI provider for analysis. MindFlow does not store, log, or transmit conversation content to any other destination.

### Generated Mind Maps and Notes

All generated mind maps and notes exist only in your current browser session. They are never uploaded or shared unless you choose to export them yourself.

## Permissions Used

### Required Permissions

- **storage** — Saves your API key and preferences locally in your browser. No data leaves your device.
- **activeTab** — Accesses the currently active tab to read AI conversation content when you click the MindFlow icon.

### Optional Host Permissions

These are only requested when you enable AI-enhanced mode and choose a provider:

- **api.anthropic.com** — Connects to the Anthropic Claude API for AI-powered mind map generation.
- **api.openai.com** — Connects to the OpenAI API for AI-powered mind map generation.
- **api.deepseek.com** — Connects to the DeepSeek API for AI-powered mind map generation.
- **ark.cn-beijing.volces.com** — Connects to the Volcengine (Doubao) API for AI-powered mind map generation.
- **generativelanguage.googleapis.com** — Connects to the Google Gemini API for AI-powered mind map generation.

### Content Script Sites

MindFlow runs a content script on the following AI chat sites to read conversation content and display the sidebar:

- ChatGPT (chatgpt.com, chat.openai.com)
- Claude (claude.ai)
- DeepSeek (chat.deepseek.com)
- Gemini (gemini.google.com)
- Grok (grok.com)
- Doubao (doubao.com)
- Perplexity (perplexity.ai)

The content script only reads the conversation text displayed on the page. It does not access cookies, passwords, form data, or any other information on these sites.

## Third-Party Services

When you use the "Generate" feature, MindFlow sends conversation content to the AI provider you have configured. This communication goes directly from your browser to the provider's servers. MindFlow does not relay, intercept, or store this data. Your use of these third-party services is governed by the respective provider's own privacy policy and terms of service.

## Data Sharing

We do not sell, trade, or share any user data with third parties.

## Data Deletion

You can delete all locally stored data at any time by:

- Clearing the extension's storage in Chrome settings (chrome://extensions → MindFlow → Details → Clear data), or
- Uninstalling the MindFlow extension

## Children's Privacy

MindFlow does not knowingly collect any data from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected by the "Last updated" date at the top of this page.

## Contact

If you have questions about this privacy policy, please contact us at:

- Email: chuanhaigogogo@gmail.com
- GitHub: https://github.com/chuanhaigogogo/2603-WhereAmIInAIChat-Extension