import { useMemo, useState, useEffect } from 'react';
import { useMindFlowStore } from '../../state/store';
import type { ConversationMessage } from '../../core/types';
import { detectLanguage, type ConvoLang } from '../../core/extraction/ExtractionEngine';

interface Props {
  fontSize?: number;
  onFontSmaller?: () => void;
  onFontLarger?: () => void;
}

export function NotesPanel({ fontSize = 15, onFontSmaller, onFontLarger }: Props) {
  const messages = useMindFlowStore(s => s.messages);
  const markdownTree = useMindFlowStore(s => s.markdownTree);
  const settings = useMindFlowStore(s => s.settings);
  const aiNotes = useMindFlowStore(s => s.aiNotes);

  const [aiLoading, setAiLoading] = useState(false);
  const [dismissWarning, setDismissWarning] = useState(false);

  // Check total conversation length
  const totalChars = useMemo(() => messages.reduce((sum, m) => sum + m.content.length, 0), [messages]);
  const showLengthWarning = totalChars > 80000 && !dismissWarning;

  // Detect language once
  const lang = useMemo(() => detectLanguage(messages), [messages]);

  // Send conversation to AI for notes generation
  useEffect(() => {
    if (!markdownTree || messages.length === 0) return;
    if (aiNotes) return; // already generated

    setAiLoading(true);

    generateAINotes(settings.apiProvider, messages, lang)
      .then(result => {
        if (result) useMindFlowStore.setState({ aiNotes: result });
        setAiLoading(false);
      })
      .catch(() => setAiLoading(false));
  }, [markdownTree, settings.apiProvider, aiNotes]);

  if (!aiNotes && !aiLoading) {
    return (
      <div style={{ padding: '16px', color: '#b0b0b0', textAlign: 'center', fontSize: `${fontSize}px` }}>
        Generate a mind map to see notes...
      </div>
    );
  }

  if (aiLoading && !aiNotes) {
    return (
      <div style={{ padding: '16px', color: '#8b5cf6', textAlign: 'center', fontSize: `${fontSize}px` }}>
        AI generating notes...
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 10px 32px', fontSize: `${fontSize}px`, lineHeight: '1.7', position: 'relative', minHeight: '100%' }}>
      {showLengthWarning && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 8px', marginBottom: '8px',
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px',
          fontSize: `${Math.max(10, fontSize - 2)}px`, color: '#1e40af', lineHeight: '1.4',
        }}>
          <span>{`Long conversation (${(totalChars / 1000).toFixed(0)}k chars). Summary may be incomplete. Consider starting a new conversation.`}</span>
          <button onClick={() => setDismissWarning(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#1e40af', fontSize: '12px', padding: '0 4px', flexShrink: 0,
          }}>{'\u2715'}</button>
        </div>
      )}
      {aiLoading && aiNotes && (
        <div style={{ padding: '4px 0', color: '#8b5cf6', fontSize: `${Math.max(10, fontSize - 2)}px`, marginBottom: '4px' }}>
          AI generating notes...
        </div>
      )}
      {aiNotes && renderMarkdown(aiNotes, fontSize)}
      <FontToolbar fontSize={fontSize} onFontSmaller={onFontSmaller} onFontLarger={onFontLarger} />
    </div>
  );
}

// ---- Render markdown-ish text ----

function renderMarkdown(text: string, fontSize: number) {
  return text.split('\n').filter(Boolean).map((line, i) => {
    const trimmed = line.trimStart();

    // Heading: # title
    if (trimmed.startsWith('# ')) {
      return <div key={i} style={{ fontWeight: 700, color: '#1e40af', fontSize: `${fontSize + 2}px`, marginTop: '10px', marginBottom: '4px' }}>
        {parseBold(trimmed.slice(2))}
      </div>;
    }

    // Indented bullet: calculate depth
    const leadingSpaces = line.length - line.trimStart().length;
    const depth = Math.floor(leadingSpaces / 2);
    const isBullet = trimmed.startsWith('- ');
    const content = isBullet ? trimmed.slice(2) : trimmed;

    // Tangent / correction prefix coloring
    let prefixColor = '#374151';
    if (content.startsWith('岔开：') || content.startsWith('tangent:')) prefixColor = '#d97706';
    else if (content.startsWith('纠正：') || content.startsWith('correction:')) prefixColor = '#dc2626';

    return (
      <div key={i} style={{
        paddingLeft: `${depth * 14}px`,
        marginBottom: isBullet ? '3px' : '1px',
        color: depth === 0 && isBullet ? '#1e40af' : prefixColor,
        fontWeight: depth === 0 && isBullet ? 600 : 400,
        fontSize: `${fontSize}px`,
      }}>
        {isBullet && <span style={{ color: '#93c5fd', marginRight: '4px' }}>{depth > 0 ? '\u2514' : '\u2022'}</span>}
        {parseBold(content)}
      </div>
    );
  });
}

function parseBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ---- Font toolbar ----

function FontToolbar({ fontSize, onFontSmaller, onFontLarger }: { fontSize: number; onFontSmaller?: () => void; onFontLarger?: () => void }) {
  return (
    <div style={{
      position: 'sticky', bottom: '8px', float: 'right',
      display: 'flex', alignItems: 'center', gap: '2px',
      background: 'rgba(255,255,255,0.92)', borderRadius: '5px',
      border: '1px solid #e5e7eb', padding: '3px 5px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <button onClick={onFontSmaller} style={nBtn} title="Smaller">A-</button>
      <span style={{ fontSize: '8px', color: '#b0b0b0', minWidth: '14px', textAlign: 'center' }}>{fontSize}</span>
      <button onClick={onFontLarger} style={nBtn} title="Larger">A+</button>
    </div>
  );
}

const nBtn: React.CSSProperties = {
  width: '20px', height: '20px', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  fontSize: '10px', fontWeight: 500, color: '#6b7280',
  background: '#fff', border: '1px solid #e5e7eb',
  borderRadius: '3px', cursor: 'pointer', padding: 0,
  lineHeight: 1,
};

// ===========================================================
// AI-generated notes
// ===========================================================

const NOTES_PROMPT_ZH = `你是一个对话分析专家。请分析以下对话，生成一个 Markdown 格式的思维导图。

## 分析算法（严格按此执行）

第一步：识别对话起点
- 找到用户最初想解决的问题或想了解的主题，这是根节点

第二步：追踪主线
- 主线是围绕用户原始目标的推进路径
- 每个推进主线的轮次成为根节点的直接子节点

第三步：识别岔开
- 当用户对 AI 回答中提到的某个术语或概念产生疑问并追问时，这是一次岔开
- 岔开的判断方法：当前用户提问中的核心词出现在上一轮 AI 回答里，并且用户在问"XX是什么"、"为什么XX"、"XX怎么理解"、"展开讲讲XX"
- 岔开作为父话题的子节点，缩进一级
- 岔开中可能继续岔开（嵌套），继续缩进
- 标注"岔开："前缀

第四步：识别回归
- 当用户说"回到"、"继续"、"接着说"或明确切换到新话题时，弹回根节点层级
- 回归后的内容重新成为根节点的直接子节点

第五步：识别纠正
- 当用户说"不对"、"不全对"、"补充"、"其实"来纠正 AI 的回答时，标注"纠正："前缀，挂在被纠正的话题节点下

第六步：提取要点
- 每个节点下附加 2-4 个关键要点
- 要点从 AI 的回答中提取核心结论，用短语（3-10个词），不用完整句子
- 如果 AI 用了类比或比喻来解释，保留这个类比作为要点

第七步：过滤噪音
- 跳过纯操作性的轮次（"导出文件"、"生成总结"、"格式改一下"）
- 跳过寒暄和确认性回复（"好的"、"明白"、"继续"）
- 只保留有知识含量的轮次

## 输出格式

严格使用以下格式。不要有开头寒暄，不要有结尾总结，直接输出导图：

# [对话的核心主题]

- 主线话题1
  - 要点
  - 要点
  - 岔开：子话题
    - 要点
    - 更深的岔开：子子话题
      - 要点
  - 纠正：被纠正的内容
- 主线话题2
  - 要点
  - 岔开：...
- 主线话题3
  - ...

## 关键规则

- 每个节点一行，短语不是句子
- 层级最多 4 层
- 不要遗漏任何一次用户的追问和岔开——这些是最有价值的学习路径
- 语言跟随对话的主要语言
- 如果用户在某个点上反复追问了多轮（连续岔开），必须体现这个嵌套深度，不要压平成同一层`;

const NOTES_PROMPT_EN = `You are a conversation analysis expert. Analyze the following conversation and generate a Markdown-formatted mind map.

## Analysis Algorithm (follow strictly)

Step 1: Identify the starting point
- Find the user's original question or topic of interest — this is the root node

Step 2: Track the main thread
- The main thread follows the user's original goal
- Each turn that advances the main thread becomes a direct child of the root node

Step 3: Identify tangents
- When the user notices a term or concept in the AI's answer and asks a follow-up about it, this is a tangent
- Tangent detection: the core term in the user's current question appeared in the AI's previous answer, AND the user is asking "what is X", "why X", "how does X work", "tell me more about X"
- Tangents become child nodes of the parent topic, indented one level
- Tangents can nest (tangent within a tangent), keep indenting
- Label with "tangent:" prefix

Step 4: Identify returns
- When the user says "back to", "let's continue", "anyway" or explicitly switches to a new topic, pop back to root level
- Content after a return becomes a direct child of the root node again

Step 5: Identify corrections
- When the user says "no", "not quite", "actually", "that's not right" to correct the AI's answer, label with "correction:" prefix and nest under the corrected topic node

Step 6: Extract key points
- Attach 2-4 key points under each node
- Extract core conclusions from the AI's answer as short phrases (3-10 words), not full sentences
- If the AI used an analogy or metaphor to explain, preserve it as a key point

Step 7: Filter noise
- Skip purely operational turns ("export file", "generate summary", "change the format")
- Skip greetings and acknowledgments ("ok", "got it", "thanks", "continue")
- Only keep turns with substantive knowledge content

## Output Format

Use the following format strictly. No opening greeting, no closing summary — output the map directly:

# [Core topic of the conversation]

- Main topic 1
  - key point
  - key point
  - tangent: sub-topic
    - key point
    - deeper tangent: sub-sub-topic
      - key point
  - correction: corrected content
- Main topic 2
  - key point
  - tangent: ...
- Main topic 3
  - ...

## Key Rules

- One line per node, phrases not sentences
- Maximum 4 levels deep
- Do NOT omit any user follow-up or tangent — these are the most valuable learning paths
- Output in English
- If the user asked multiple follow-up rounds on one point (consecutive tangents), the nesting depth must reflect this — do not flatten into the same level`;

async function generateAINotes(provider: string, messages: ConversationMessage[], lang: ConvoLang): Promise<string | null> {
  let apiKey: string | null = null;
  try {
    const result = await chrome.storage.local.get(['mindflow_api_key']);
    apiKey = result.mindflow_api_key ?? null;
  } catch { return null; }
  if (!apiKey) return null;

  // Build conversation text with smart compression
  const convoLines: string[] = [];
  let totalLen = 0;
  for (const msg of messages) {
    let content: string;
    if (msg.role === 'user') {
      content = msg.content;
    } else {
      content = compressAIMessage(msg.content);
    }
    if (totalLen + content.length > 200000) break;
    const role = msg.role === 'user' ? 'User' : 'AI';
    convoLines.push(`${role}: ${content}`);
    totalLen += content.length;
  }
  const convoText = convoLines.join('\n\n');

  const notesPrompt = lang === 'en' ? NOTES_PROMPT_EN : NOTES_PROMPT_ZH;
  const convoLabel = lang === 'en' ? 'Here is the conversation:' : '以下是对话内容：';
  const langReminder = lang === 'en'
    ? '\n\nIMPORTANT REMINDER: Output the entire mind map in English. Do NOT use Chinese for any text.'
    : '\n\nIMPORTANT REMINDER: 请用中文输出整个思维导图。';
  const userPrompt = `${notesPrompt}\n\n---\n\n${convoLabel}\n\n${convoText}${langReminder}`;

  type Provider = 'anthropic' | 'openai' | 'deepseek' | 'doubao' | 'gemini';
  const configs: Record<Provider, { endpoint: string; model: string; style: string }> = {
    anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', style: 'anthropic' },
    deepseek: { endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat', style: 'openai' },
    gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', model: 'gemini-2.5-flash', style: 'gemini' },
    openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', style: 'openai' },
    doubao: { endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', model: 'doubao-lite-32k', style: 'openai' },
  };

  const config = configs[provider as Provider];
  if (!config) return null;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'api-fetch',
      provider,
      apiKey,
      userPrompt,
      config: {
        endpoint: config.endpoint,
        model: config.model,
        style: config.style,
        maxTokens: 8192,
        temperature: 0.3,
        systemPrompt: config.style === 'openai' ? 'You are a conversation analysis expert.' : undefined,
      },
    });

    if (response?.error) {
      return null;
    }

    const text = response?.text ?? '';
    return text.trim() || null;
  } catch (e) {
    return null;
  }
}

/** Compress an AI message: keep first 800 chars + all bold text + analogy sentences */
function compressAIMessage(content: string): string {
  const parts: string[] = [];

  parts.push(content.slice(0, 800));

  const bolds = content.match(/\*\*(.*?)\*\*/g);
  if (bolds) {
    for (const b of bolds) {
      const clean = b.replace(/\*\*/g, '');
      if (clean.length > 2 && !parts[0].includes(clean)) {
        parts.push(clean);
      }
    }
  }

  const sentences = content.split(/[.!?\u3002\uff01\uff1f\n]/);
  const analogyPatterns = /\u7C7B\u6BD4|\u5C31\u50CF|\u6BD4\u65B9|\u597D\u6BD4|like\s|similar to|analogy|think of it as/i;
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length > 10 && trimmed.length < 200 && analogyPatterns.test(trimmed)) {
      if (!parts[0].includes(trimmed)) {
        parts.push(trimmed);
      }
    }
  }

  return parts.join('\n');
}
