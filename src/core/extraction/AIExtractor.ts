import type { ConversationMessage } from '../types';
import { detectLanguage } from './ExtractionEngine';

/**
 * AI-powered mindmap generation.
 *
 * New approach: send the ENTIRE conversation in one API request with a
 * comprehensive prompt. The AI returns a complete mindmap JSON structure
 * which is then converted to a markdown tree for markmap rendering.
 *
 * Supports: Anthropic, OpenAI, DeepSeek, Doubao, Gemini.
 */

type Provider = 'anthropic' | 'deepseek' | 'gemini' | 'openai' | 'doubao';

/** Provider config: endpoint, model, auth style */
const PROVIDER_CONFIG: Record<Provider, {
  endpoint: string;
  model: string;
  style: 'anthropic' | 'openai-compatible' | 'gemini';
}> = {
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-haiku-4-5-20251001',
    style: 'anthropic',
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    style: 'openai-compatible',
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.5-flash',
    style: 'gemini',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    style: 'openai-compatible',
  },
  doubao: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-lite-32k',
    style: 'openai-compatible',
  },
};

// ── Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT_EN = `You are a professional mind map generator. Analyze the entire AI conversation below and produce a clean, logically structured mind map. ALL output MUST be in English.

## Rules

### Hierarchy
- Root: one phrase summarizing the entire conversation's core theme
- Level 1: major topics (usually each distinct user question = one topic)
- Level 2: key points from the AI's answer (sub-topics, arguments, steps)
- Level 3: supporting details or examples (only if important)

### Topic detection
- Each new user question usually creates a new Level 1 branch
- If the user says "by the way"/"another question"/"moving on", force a new branch
- If the user follows up ("tell me more"/"what about"/"can you elaborate"), keep it under the SAME Level 1 branch
- Numbered lists (1. 2. 3.) or bullet points in the AI answer → parallel Level 2 nodes

### Merging
- Merge similar topics (e.g. "Python advantages" and "Python benefits" → one node)
- References to earlier content ("as you mentioned") → nest under the referenced topic, not as a new branch

### Text
- Each node label: concise keyword or short phrase, max 15 characters
- Remove filler words ("sure","basically","well","so")
- Remove greetings ("hello","thanks","hi","thank you")
- Use English for all node labels

## Output format

Return ONLY valid JSON matching this structure, no other text:

{
  "root": "conversation theme",
  "children": [
    {
      "label": "topic 1",
      "children": [
        {
          "label": "key point 1",
          "children": []
        },
        {
          "label": "key point 2",
          "children": [
            { "label": "detail", "children": [] }
          ]
        }
      ]
    }
  ]
}

Constraints:
- Max 10 Level 1 branches
- Max 5 children per node
- Max depth 4
- Every node MUST have "label" (string) and "children" (array)`;

const SYSTEM_PROMPT_ZH = `You are a professional mind map generator. Analyze the entire AI conversation below and produce a clean, logically structured mind map. ALL output MUST be in Chinese (中文).

## Rules

### Hierarchy
- Root: one phrase summarizing the entire conversation's core theme
- Level 1: major topics (usually each distinct user question = one topic)
- Level 2: key points from the AI's answer (sub-topics, arguments, steps)
- Level 3: supporting details or examples (only if important)

### Topic detection
- Each new user question usually creates a new Level 1 branch
- If the user says "换个话题"/"另外"/"by the way"/"another question", force a new branch
- If the user follows up ("能详细说说"/"那...呢"/"tell me more"/"what about"), keep it under the SAME Level 1 branch
- Numbered lists (1. 2. 3.) or bullet points in the AI answer → parallel Level 2 nodes

### Merging
- Merge similar topics (e.g. "Python优点" and "Python好处" → one node)
- References to earlier content ("刚才你说的XX") → nest under the referenced topic, not as a new branch

### Text
- Each node label: concise keyword or short phrase, max 15 characters
- Remove filler words ("嗯","那个","就是说","sure","basically")
- Remove greetings ("你好","谢谢","hello","thanks")
- Use Chinese (中文) for all node labels

## Output format

Return ONLY valid JSON matching this structure, no other text:

{
  "root": "conversation theme",
  "children": [
    {
      "label": "topic 1",
      "children": [
        {
          "label": "key point 1",
          "children": []
        },
        {
          "label": "key point 2",
          "children": [
            { "label": "detail", "children": [] }
          ]
        }
      ]
    }
  ]
}

Constraints:
- Max 10 Level 1 branches
- Max 5 children per node
- Max depth 4
- Every node MUST have "label" (string) and "children" (array)`;

// Max characters to send to AI (avoid huge token costs)
const MAX_CONVERSATION_CHARS = 12000;

// ── Types ────────────────────────────────────────────────────────────

interface MindmapNode {
  label: string;
  children: MindmapNode[];
}

interface MindmapJSON {
  root: string;
  children: MindmapNode[];
}

// ── Main class ───────────────────────────────────────────────────────

export class AIExtractor {
  private provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
  }

  /**
   * Generate a complete markdown tree from the entire conversation.
   * Returns null on failure (caller should fall back to rule-based).
   */
  async generateMarkdownTree(messages: ConversationMessage[]): Promise<string | null> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return null;

    // Format conversation for the prompt
    const conversation = this.formatConversation(messages);

    // Pick language-appropriate system prompt and user prompt suffix
    const lang = detectLanguage(messages);
    const systemPrompt = lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
    const langInstruction = lang === 'en'
      ? '\n\nIMPORTANT: All node labels in the JSON MUST be in English. Do NOT use Chinese.'
      : '\n\nIMPORTANT: 所有节点标签必须使用中文。';
    const userPrompt = `## Conversation\n\n${conversation}\n\n## Generate mind map JSON now:${langInstruction}`;

    try {
      const responseText = await this.callAPI(apiKey, systemPrompt, userPrompt, 2000);
      if (!responseText) return null;

      const data = this.parseMindmapJSON(responseText);
      if (!data) return null;

      return this.toMarkdown(data);
    } catch (e) {
      // Silent fail — caller falls back to rule-based
      return null;
    }
  }

  // ── Conversation formatting ────────────────────────────────────────

  private formatConversation(messages: ConversationMessage[]): string {
    const lines: string[] = [];
    let totalChars = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const role = msg.role === 'user' ? 'User' : 'Assistant';

      // Truncate individual messages if needed
      let content = msg.content;
      if (content.length > 2000) {
        content = content.slice(0, 1800) + '\n...(truncated)';
      }

      const line = `[${i}] ${role}: ${content}`;
      totalChars += line.length;

      if (totalChars > MAX_CONVERSATION_CHARS) {
        lines.push('...(remaining messages truncated for brevity)');
        break;
      }

      lines.push(line);
    }

    return lines.join('\n\n');
  }

  // ── JSON parsing and validation ────────────────────────────────────

  private parseMindmapJSON(text: string): MindmapJSON | null {
    try {
      // Extract JSON from possible markdown code block wrapping
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                        text.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[1]);

      // Validate structure
      if (typeof parsed.root !== 'string' || !Array.isArray(parsed.children)) {
        return null;
      }

      // Sanitize: enforce depth/width limits
      return {
        root: parsed.root.slice(0, 60),
        children: this.sanitizeChildren(parsed.children, 1),
      };
    } catch {
      return null;
    }
  }

  private sanitizeChildren(children: unknown[], depth: number): MindmapNode[] {
    if (!Array.isArray(children) || depth > 4) return [];

    const result: MindmapNode[] = [];
    const maxChildren = depth === 1 ? 10 : 5;

    for (const child of children.slice(0, maxChildren)) {
      if (typeof child !== 'object' || child === null) continue;

      const c = child as Record<string, unknown>;
      const label = typeof c.label === 'string' ? c.label.slice(0, 60) : '';
      if (!label) continue;

      result.push({
        label,
        children: this.sanitizeChildren(
          Array.isArray(c.children) ? c.children : [],
          depth + 1
        ),
      });
    }

    return result;
  }

  // ── Markdown output ────────────────────────────────────────────────

  private toMarkdown(data: MindmapJSON): string {
    const lines: string[] = [`# ${data.root}`];
    for (const child of data.children) {
      this.buildMarkdownLines(child, 2, lines);
    }
    return lines.join('\n');
  }

  private buildMarkdownLines(node: MindmapNode, depth: number, lines: string[]): void {
    if (depth <= 6) {
      lines.push(`${'#'.repeat(depth)} ${node.label}`);
    } else {
      lines.push(`${'  '.repeat(depth - 6)}- ${node.label}`);
    }

    for (const child of node.children) {
      this.buildMarkdownLines(child, depth + 1, lines);
    }
  }

  // ── API call via background proxy ────────────────────────────────

  private async callAPI(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<string | null> {
    const config = PROVIDER_CONFIG[this.provider];

    // Route through background script to bypass content script CSP restrictions
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'api-fetch',
        provider: this.provider,
        apiKey,
        userPrompt,
        config: {
          endpoint: config.endpoint,
          model: config.model,
          style: config.style,
          maxTokens,
          temperature: 0.3,
          systemPrompt,
        },
      });

      if (response?.error) {
        // API returned error
        return null;
      }

      return response?.text ?? null;
    } catch (e) {
      // Network/runtime error
      return null;
    }
  }

  // ── API key management ─────────────────────────────────────────────

  private async getApiKey(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(['mindflow_api_key']);
      return result.mindflow_api_key ?? null;
    } catch {
      return null;
    }
  }

  // ── Static utilities (used by popup and notes panel) ───────────────

  /** Test if the API key works */
  static async testConnection(provider: Provider, apiKey: string): Promise<boolean> {
    try {
      const extractor = new AIExtractor(provider);
      const config = PROVIDER_CONFIG[provider];
      const testSystem = 'Return exactly: {"root":"test","children":[]}';
      const testUser = 'test';

      const result = await extractor.callAPI(apiKey, testSystem, testUser, 50);
      return result !== null;
    } catch (e) {
      // Connection test failed
      return false;
    }
  }

  /**
   * Polish raw notes with AI: reorganize, add definitions, clarify logic.
   */
  static async polishNotes(
    provider: Provider,
    rawNotes: string,
    language: string
  ): Promise<string | null> {
    let apiKey: string | null = null;
    try {
      const result = await chrome.storage.local.get(['mindflow_api_key']);
      apiKey = result.mindflow_api_key ?? null;
    } catch { return null; }
    if (!apiKey) return null;

    const systemPrompt = `You are a knowledge note organizer. Given raw extracted notes from a conversation mind map, rewrite them into clean, structured learning notes.

Rules:
- Each entry: **Knowledge Point** -- concise definition (1 sentence). Logic: how it connects to the previous/parent concept (1 sentence).
- If a term is a proper noun or technical term, include a brief definition.
- Preserve ALL knowledge points from the input, do not skip any.
- Keep it concise: max 2 sentences per entry.
- Output in ${language}.
- Do NOT add introductions, summaries, or commentary. Just the notes.
- Format: one entry per paragraph, use ** for term names.`;

    const userPrompt = `Rewrite these raw notes into clean structured notes:\n\n${rawNotes.slice(0, 4000)}`;

    try {
      const extractor = new AIExtractor(provider);
      const text = await extractor.callAPI(apiKey, systemPrompt, userPrompt, 8192);
      return text?.trim() || null;
    } catch (e) {
      // Polish notes failed
      return null;
    }
  }
}
