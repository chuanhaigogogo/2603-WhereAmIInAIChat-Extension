import { defineConfig } from 'wxt';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Vite plugin: sanitize JS output for Chrome extension content scripts.
// Chrome rejects content scripts containing raw control characters or mid-file BOMs.
// Some bundled libraries (e.g. YAML parsers in markmap) embed literal control chars.
function sanitizeJsPlugin() {
  return {
    name: 'sanitize-js-for-extension',
    enforce: 'post' as const,
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir;
      if (!outDir) return;
      sanitizeRecursive(outDir);
    },
  };
}

function sanitizeRecursive(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sanitizeRecursive(full);
    } else if (full.endsWith('.js')) {
      let text = readFileSync(full, 'utf-8');

      // Escape ALL non-ASCII characters to \uXXXX sequences.
      // Chrome's content script loader rejects files containing raw
      // non-ASCII bytes (C1 controls, CJK chars in template literals, etc.)
      // even when the file is valid UTF-8.
      text = text.replace(/[^\x00-\x7f]/g, (ch) => {
        const code = ch.codePointAt(0)!;
        if (code > 0xffff) {
          // Surrogate pair for supplementary plane chars
          const hi = 0xd800 + ((code - 0x10000) >> 10);
          const lo = 0xdc00 + ((code - 0x10000) & 0x3ff);
          return '\\u' + hi.toString(16).padStart(4, '0') +
                 '\\u' + lo.toString(16).padStart(4, '0');
        }
        return '\\u' + code.toString(16).padStart(4, '0');
      });

      writeFileSync(full, text, 'utf-8');
    }
  }
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  vite: () => ({
    plugins: [sanitizeJsPlugin()],
  }),
  manifest: {
    name: 'MindFlow: Where Am I in AI Chat',
    description: 'Real-time mind maps from AI conversations. Free rule-based mode or AI-enhanced mode with your own API key.',
    version: '1.0.0',
    homepage_url: 'https://chuanhaigogogo.github.io/2603-WhereAmIInAIChat-Extension/privacy-policy',
    icons: {
      '16': 'icon-16.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    permissions: ['storage', 'activeTab'],
    optional_host_permissions: [
      'https://api.anthropic.com/*',
      'https://api.openai.com/*',
      'https://api.deepseek.com/*',
      'https://ark.cn-beijing.volces.com/*',
      'https://generativelanguage.googleapis.com/*',
    ],
  },
});
