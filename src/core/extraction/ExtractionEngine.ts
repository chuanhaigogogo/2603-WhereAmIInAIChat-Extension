import type { ConversationMessage } from '../types';

/**
 * MindFlow local mindmap algorithm v3
 * Core principle: extract concept noun-phrases as node labels, not colloquial text.
 *
 * Pipeline: pair QA → segment topics → extract knowledge points → build tree → markdown
 *
 * Bilingual: auto-detects conversation language (zh/en) and uses matching patterns.
 */

// ── Language detection (exported for NotesPanel) ─────────────────────

export type ConvoLang = 'zh' | 'en';

export function detectLanguage(messages: ConversationMessage[]): ConvoLang {
  let zhChars = 0;
  let enChars = 0;
  for (const m of messages) {
    const text = m.content;
    for (const ch of text) {
      if (/[\u4e00-\u9fff]/.test(ch)) zhChars++;
      else if (/[a-zA-Z]/.test(ch)) enChars++;
    }
  }
  return zhChars > enChars ? 'zh' : 'en';
}

// ── Stopwords ───────────────────────────────────────────────────────

const EN_STOPWORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'but',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'this', 'that', 'these', 'those', 'it', 'its', 'can', 'will', 'would',
  'could', 'should', 'not', 'no', 'yes', 'your', 'you', 'my', 'we',
  'they', 'their', 'have', 'has', 'had', 'do', 'does', 'did', 'been',
  'being', 'just', 'also', 'very', 'too', 'much', 'more', 'most',
  'some', 'any', 'all', 'each', 'every', 'both', 'few', 'many',
  'how', 'what', 'when', 'where', 'which', 'who', 'why', 'than',
  'then', 'now', 'here', 'there', 'about', 'into', 'over', 'after',
]);

const ZH_STOPWORDS = new Set([
  '\u4ec0\u4e48', '\u600e\u4e48', '\u4e3a\u4ec0\u4e48', '\u600e\u6837',
  '\u5982\u4f55', '\u54ea\u4e2a', '\u54ea\u4e9b',
  '\u53ef\u4ee5', '\u9700\u8981', '\u5e94\u8be5', '\u80fd\u591f',
  '\u5df2\u7ecf', '\u6b63\u5728',
  '\u6211\u4eec', '\u4f60\u4eec', '\u4ed6\u4eec', '\u5927\u5bb6',
  '\u6240\u6709', '\u5176\u4ed6',
  '\u5c31\u662f', '\u4e5f\u662f', '\u4e0d\u662f', '\u8fd8\u662f',
  '\u6216\u8005', '\u4ee5\u53ca',
  '\u6bd4\u5982', '\u4f8b\u5982', '\u5982\u679c', '\u90a3\u4e48',
  '\u6240\u4ee5', '\u56e0\u4e3a', '\u4f46\u662f', '\u867d\u7136',
  '\u4e00\u4e2a', '\u8fd9\u4e2a', '\u90a3\u4e2a', '\u8fd9\u79cd',
  '\u90a3\u79cd', '\u4e00\u79cd',
  '\u975e\u5e38', '\u7279\u522b', '\u5b8c\u5168', '\u57fa\u672c',
  '\u901a\u5e38', '\u4e00\u822c',
  '\u7684\u8bdd', '\u7684\u65f6\u5019', '\u7684\u60c5\u51b5',
  '\u7684\u65b9\u5f0f', '\u7684\u610f\u601d',
  '\u95ee\u9898', '\u4e1c\u897f', '\u4e8b\u60c5', '\u65b9\u9762',
  '\u90e8\u5206', '\u8fc7\u7a0b',
]);

// ── Internal types ──────────────────────────────────────────────────

interface QARound {
  index: number;
  question: string;
  answer: string;
  // Pre-parsed from DOM
  headings: string[];
  listItems: string[];
  boldTerms: string[];
}

interface Segment {
  title: string;
  rounds: QARound[];
}

interface KP {
  label: string;
  detail: string;
  type: string;
  subpoints?: KP[];
}

interface TNode {
  label: string;
  children: TNode[];
}

// ── Main class ──────────────────────────────────────────────────────

export class ExtractionEngine {
  private processedCount = 0;
  private lang: ConvoLang = 'zh';

  generateMarkdownTree(messages: ConversationMessage[]): string {
    if (messages.length === 0) return '# (empty)';

    this.lang = detectLanguage(messages);

    const rounds = this.pairIntoRounds(messages);
    const segments = this.segmentTopics(rounds);
    const tree = this.buildTree(segments);
    this.processedCount = messages.length;
    return this.renderMarkdown(tree);
  }

  getProcessedCount(): number {
    return this.processedCount;
  }

  // ── Step 1: Pair QA rounds ────────────────────────────────────────

  private pairIntoRounds(messages: ConversationMessage[]): QARound[] {
    const rounds: QARound[] = [];
    let i = 0;

    while (i < messages.length) {
      const msg = messages[i];
      if (msg.role === 'user') {
        let answer = '';
        const headings: string[] = [];
        const listItems: string[] = [];
        const boldTerms: string[] = [];
        let j = i + 1;
        while (j < messages.length && messages[j].role === 'assistant') {
          const a = messages[j];
          answer += (a.content || '') + '\n';
          headings.push(...(a.headings || []));
          listItems.push(...(a.listItems || []));
          boldTerms.push(...(a.boldTerms || []));
          j++;
        }
        rounds.push({
          index: rounds.length,
          question: msg.content.trim(),
          answer: answer.trim(),
          headings,
          listItems,
          boldTerms,
        });
        i = j;
      } else {
        // Orphan assistant message: append to previous round
        if (rounds.length > 0) {
          const last = rounds[rounds.length - 1];
          last.answer += '\n' + msg.content;
          last.headings.push(...(msg.headings || []));
          last.listItems.push(...(msg.listItems || []));
          last.boldTerms.push(...(msg.boldTerms || []));
        }
        i++;
      }
    }

    return rounds;
  }

  // ── Step 2: Segment topics ────────────────────────────────────────

  private segmentTopics(rounds: QARound[]): Segment[] {
    if (rounds.length === 0) return [];

    const segments: Segment[] = [];
    let cur: Segment = { title: '', rounds: [rounds[0]] };

    for (let i = 1; i < rounds.length; i++) {
      if (this.isNewTopic(rounds[i - 1], rounds[i])) {
        segments.push(cur);
        cur = { title: '', rounds: [rounds[i]] };
      } else {
        cur.rounds.push(rounds[i]);
      }
    }
    segments.push(cur);

    for (const s of segments) {
      s.title = this.extractSegmentTitle(s.rounds);
    }

    return segments;
  }

  private isNewTopic(prev: QARound, curr: QARound): boolean {
    const q = curr.question;
    const prevA = prev.answer;
    const prevQ = prev.question;

    // Signal 1: URL
    if (/https?:\/\/\S+/.test(q)) return true;

    // Signal 1.5 (EN only): Skip meta/noise questions — not a new topic, will be filtered in buildTree
    if (this.lang === 'en' && this.isEnMetaQuestion(q)) {
      return false; // keep in current segment, will be skipped during tree build
    }

    // Signal 2: Explicit transition words
    if (this.lang === 'en') {
      if (/^(by the way|another question|let'?s talk about|moving on|now i want|ok so|alright,?\s*(?:now|let'?s|i want)|actually,?\s*(?:can you|i want|let me))/i.test(q)) {
        return true;
      }
    } else {
      if (/^(\u6362\u4e2a\u8bdd\u9898|\u53e6\u5916\u4e00\u4e2a|\u56de\u5230|\u63a5\u4e0b\u6765|\u597d\u7684?[,\uff0c]?\s*(?:\u6211\u60f3|\u6211\u8981|\u73b0\u5728)|\u5bf9\u4e86[,\uff0c])/i.test(q)) {
        return true;
      }
    }

    // Signal 3: Core nouns have zero overlap
    const prevNouns = this.extractCoreNouns(prevQ + ' ' + prevA);
    const currNouns = this.extractCoreNouns(q);

    if (currNouns.length > 0 && prevNouns.length > 0) {
      const overlap = currNouns.filter(n =>
        prevNouns.some(pn => pn.includes(n) || n.includes(pn))
      );
      if (overlap.length === 0 && currNouns.length >= 2) return true;
    }

    // Signal 4: Short isolated command
    if (this.lang === 'en') {
      if (q.length < 25 && !/[?]/.test(q) && !this.isFollowUpSignal(q)) {
        return true;
      }
    } else {
      if (q.length < 15 && !/[?\uff1f\u5417\u5462\u5427\u554a]/.test(q) && !this.isFollowUpSignal(q)) {
        return true;
      }
    }

    return false;
  }

  private extractSegmentTitle(rounds: QARound[]): string {
    const firstQ = rounds[0].question;
    const firstA = rounds[0].answer;
    let m: RegExpMatchArray | null;

    // "what is X" patterns
    if (this.lang === 'en') {
      // Skip meta-questions for title extraction — use next round if available
      if (this.isEnMetaQuestion(firstQ) && rounds.length > 1) {
        const fallbackQ = rounds[1].question;
        if ((m = fallbackQ.match(/(?:what\s+(?:is|are|does)|explain|describe|tell me about|how\s+(?:does|do|to))\s+(.{2,40})/i))) {
          return this.cleanLabel(m[1]).replace(/[?]$/, '');
        }
      }
      if ((m = firstQ.match(/(?:what\s+(?:is|are|does)|explain|describe|tell me about|how\s+(?:does|do|to))\s+(.{2,40})/i))) {
        return this.cleanLabel(m[1]).replace(/[?]$/, '');
      }
      if ((m = firstQ.match(/(.{2,30})\s*(?:\?\s*$)/))) {
        const nouns = this.extractCoreNouns(m[1]);
        if (nouns.length > 0) return nouns.slice(0, 3).join(', ');
      }
    } else {
      if ((m = firstQ.match(/(?:\u4ec0\u4e48\u662f|\u4ecb\u7ecd\u4e00?\u4e0b?|\u8bb2\u89e3\u4e00?\u4e0b?|\u89e3\u91ca\u4e00?\u4e0b?)(.{2,20})/))) {
        return this.cleanLabel(m[1]);
      }
      if ((m = firstQ.match(/(.{2,20})(?:\u662f\u4ec0\u4e48|\u662f\u5565|\u5565\u610f\u601d|\u4ec0\u4e48\u610f\u601d)/))) {
        return this.cleanLabel(m[1]);
      }
    }

    // URL project name
    if ((m = firstQ.match(/github\.com\/[\w-]+\/([\w-]+)/))) {
      return m[1];
    }

    // First heading from DOM-parsed headings
    if (rounds[0].headings.length > 0) {
      const h = rounds[0].headings[0].replace(/\*+/g, '').trim();
      if (h.length >= 3 && h.length <= 25) return h;
    }

    // First markdown heading from answer text
    if ((m = firstA.match(/^#+\s*(.+)/m))) {
      const title = m[1].replace(/\*+/g, '').trim();
      if (title.length <= 25) return title;
    }

    // Fallback: core nouns
    const nouns = this.extractCoreNouns(firstQ);
    if (this.lang === 'en') {
      if (nouns.length > 0) return nouns.slice(0, 3).join(', ');
    } else {
      if (nouns.length > 0) return nouns.slice(0, 3).join(' + ');
    }

    return firstQ.slice(0, 20).replace(/[?\uff1f\u3002\uff01!,\uff0c]$/, '');
  }

  // ── Step 3: Extract knowledge points ──────────────────────────────

  private extractKnowledgePoints(round: QARound): KP[] {
    const points: KP[] = [];
    const answer = round.answer;

    // === Strategy A: Definition sentences from plain text ===
    const defPatterns = this.lang === 'en'
      ? [
          /([A-Za-z][A-Za-z0-9 ._-]{1,30})\s+(?:is|are|refers to|means|stands for)\s+([^\n.]{5,80})/g,
          /([A-Za-z][A-Za-z0-9 ._-]{1,25})\s*[(\uff08]\s*([^)\uff09]{3,40})\s*[)\uff09]/g,
        ]
      : [
          /([^\n]{2,20})\s*(?:\u5c31\u662f|\u672c\u8d28\u4e0a\u662f|\u662f\u4e00[\u4e2a\u79cd\u95e8]|\u6307\u7684\u662f|\u7b49\u4e8e\u662f)\s*([^\n\u3002.]{5,60})/g,
          /([A-Za-z][A-Za-z0-9 ._-]{1,25})\s*[(\uff08]\s*([^)\uff09]{3,40})\s*[)\uff09]/g,
        ];

    for (const pattern of defPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(answer)) !== null) {
        const term = this.cleanLabel(match[1]);
        const definition = match[2].trim().replace(/\*+/g, '');
        if (term.length >= 2 && definition.length >= 4) {
          points.push({ label: term, detail: this.truncate(definition, 40), type: 'definition' });
        }
      }
    }

    // === Strategy B: DOM-parsed headings (+ raw markdown heading fallback for EN) ===
    const headers: KP[] = [];
    for (const h of round.headings) {
      const text = h.replace(/\*+/g, '').trim();
      if (text.length >= 3 && text.length <= 40 && !this.isMetaHeader(text)) {
        headers.push({ label: text, detail: '', type: 'header' });
      }
    }
    // Fallback: parse raw markdown headings when DOM data is empty (EN)
    if (this.lang === 'en' && headers.length === 0) {
      const mdHeadings = answer.match(/^#+\s+(.+)/gm) || [];
      for (const h of mdHeadings) {
        const text = h.replace(/^#+\s+/, '').replace(/\*+/g, '').trim();
        if (text.length >= 3 && text.length <= 40 && !this.isMetaHeader(text)) {
          headers.push({ label: text, detail: '', type: 'header' });
        }
      }
    }

    // === Strategy C: DOM-parsed list items (split on colon/dash) ===
    let listItemsSource = round.listItems;
    // Fallback: parse raw markdown list items when DOM data is empty (EN)
    if (this.lang === 'en' && listItemsSource.length === 0) {
      const mdListItems = answer.match(/^[-*]\s+(.+)/gm) || [];
      listItemsSource = mdListItems.map(l => l.replace(/^[-*]\s+/, ''));
    }
    for (const item of listItemsSource) {
      const cleaned = item.replace(/\*+/g, '').trim();
      if (cleaned.length < 3 || cleaned.length > 100) continue;

      const colonSplit = cleaned.match(/^(.{2,25})[:\uff1a\u2014\-\u2013]\s*(.{4,})/);
      if (colonSplit) {
        points.push({
          label: this.cleanLabel(colonSplit[1]),
          detail: this.truncate(colonSplit[2], 40),
          type: 'list-item',
        });
      } else if (cleaned.length <= 40 && !this.isColloquial(cleaned)) {
        points.push({ label: this.cleanLabel(cleaned), detail: '', type: 'list-item' });
      }
    }

    // === Strategy D: DOM-parsed bold terms (+ raw markdown bold fallback for EN) ===
    let boldSource = round.boldTerms;
    // Fallback: parse raw markdown **bold** when DOM data is empty (EN)
    if (this.lang === 'en' && boldSource.length === 0) {
      const mdBolds = answer.match(/\*\*([^*]+)\*\*/g) || [];
      boldSource = mdBolds.map(b => b.replace(/\*\*/g, ''));
    }
    if (points.length < 3) {
      for (const b of boldSource) {
        const t = b.trim();
        if (t.length >= 2 && t.length <= 40 && !this.isColloquial(t)) {
          points.push({ label: t, detail: '', type: 'bold' });
        }
      }
    }

    // === Strategy E: Paragraph first-sentence nouns (fallback) ===
    if (points.length < 2) {
      const paragraphs = answer.split(/\n\n+/).filter(p =>
        p.trim().length > 30 && !p.trim().startsWith('#') && !p.trim().startsWith('```')
      );

      for (const para of paragraphs.slice(0, 5)) {
        const firstSentence = para.match(/^[^#\-*\d](.+?[\u3002.!\uff01?\uff1f])/);
        if (firstSentence) {
          const nouns = this.extractCoreNouns(firstSentence[1]);
          if (nouns.length > 0) {
            points.push({
              label: nouns.slice(0, 2).join(this.lang === 'en' ? ': ' : '\uff1a'),
              detail: this.truncate(firstSentence[1].replace(/\*+/g, ''), 40),
              type: 'sentence',
            });
          }
        }
      }
    }

    // === Strategy F: Core nouns from answer (last resort) ===
    if (points.length < 2 && answer.length > 30) {
      const nouns = this.extractCoreNouns(answer.slice(0, 500));
      for (const noun of nouns.slice(0, 4)) {
        if (!this.isColloquial(noun)) {
          points.push({ label: noun, detail: '', type: 'noun' });
        }
      }
    }

    // Merge headers and content points
    if (headers.length > 0 && points.length > 0) {
      return this.mergeHeadersAndPoints(headers, points);
    }

    return this.dedup(points.length > 0 ? points : headers).slice(0, 10);
  }

  // ── Step 4: Build tree ────────────────────────────────────────────

  private buildTree(segments: Segment[]): TNode {
    const root: TNode = {
      label: this.generateRootTitle(segments),
      children: [],
    };

    for (const seg of segments) {
      const topicNode: TNode = { label: seg.title, children: [] };
      const stack: TNode[] = [topicNode];

      for (let i = 0; i < seg.rounds.length; i++) {
        const round = seg.rounds[i];
        const prevRound = i > 0 ? seg.rounds[i - 1] : null;

        // EN: skip meta/noise questions (language requests, acks, formatting)
        if (this.lang === 'en' && this.isEnMetaQuestion(round.question)) continue;

        const relation = this.classifyQuestion(round, prevRound);
        const questionLabel = this.normalizeQuestion(round.question);
        const kps = this.extractKnowledgePoints(round);

        const roundNode: TNode = {
          label: questionLabel,
          children: kps.map(kp => {
            const node: TNode = { label: kp.label, children: [] };
            if (kp.detail) {
              node.children.push({ label: kp.detail, children: [] });
            }
            if (kp.subpoints) {
              for (const sp of kp.subpoints) {
                node.children.push({ label: sp.label, children: [] });
              }
            }
            return node;
          }),
        };

        if (relation === 'followup' && stack.length > 0) {
          const parent = stack[stack.length - 1];
          const lastChild = parent.children[parent.children.length - 1];
          if (lastChild) {
            lastChild.children.push(roundNode);
            stack.push(roundNode);
          } else {
            parent.children.push(roundNode);
          }
        } else if (relation === 'digression') {
          roundNode.label = (this.lang === 'en' ? 'digression: ' : '\u5c94\u5f00\uff1a') + roundNode.label;
          const parent = stack[stack.length - 1];
          const lastChild = parent.children[parent.children.length - 1];
          if (lastChild) {
            lastChild.children.push(roundNode);
            stack.push(roundNode);
          } else {
            parent.children.push(roundNode);
          }
        } else if (relation === 'return') {
          while (stack.length > 1) stack.pop();
          stack[0].children.push(roundNode);
        } else {
          while (stack.length > 1) stack.pop();
          topicNode.children.push(roundNode);
        }
      }

      root.children.push(topicNode);
    }

    return root;
  }

  private classifyQuestion(curr: QARound, prev: QARound | null): string {
    if (!prev) return 'new';

    const q = curr.question;
    const prevA = prev.answer;
    const prevQ = prev.question;

    if (this.isFollowUpSignal(q)) return 'followup';

    const currNouns = this.extractCoreNouns(q);
    const prevQNouns = this.extractCoreNouns(prevQ);
    const prevANouns = this.extractCoreNouns(prevA);

    const inAnswer = currNouns.filter(n =>
      prevANouns.some(an => an.includes(n) || n.includes(an))
    );
    const inQuestion = currNouns.filter(n =>
      prevQNouns.some(qn => qn.includes(n) || n.includes(qn))
    );

    if (inAnswer.length > 0 && inQuestion.length === 0 && currNouns.length > 0) {
      return 'digression';
    }

    if (this.lang === 'en') {
      if (/\b(back to|going back|anyway|let'?s continue|as i was saying|returning to)\b/i.test(q)) {
        return 'return';
      }
    } else {
      if (/\u56de\u5230|\u56de\u5f52|\u7ee7\u7eed\u4e4b\u524d|\u521a\u624d\u8bf4\u7684|\u56de\u6765/.test(q)) {
        return 'return';
      }
    }

    if (inQuestion.length > 0) return 'followup';
    if (inAnswer.length > 0) return 'digression';

    return 'new';
  }

  private isFollowUpSignal(q: string): boolean {
    if (this.lang === 'en') {
      if (/^(so|but|and|wait|right|ok so|hmm|what about|how about|does that mean|you (?:said|mentioned))/i.test(q)) {
        return true;
      }
      if (/\b(you (?:said|mentioned)|earlier you|what do you mean|can you (?:explain|elaborate)|tell me more)\b/i.test(q)) {
        return true;
      }
      return false;
    }
    if (/^(\u90a3|\u6240\u4ee5|\u4f46\u662f?|\u53ef\u662f|\u5c31\u662f\u8bf4|\u4e5f\u5c31\u662f|\u7b49\u7b49|\u4e0d\u5bf9|\u5bf9\u554a|\u4e3a\u5565|\u4e3a\u4ec0\u4e48|\u600e\u4e48\u5c31|\u548b)/.test(q)) {
      return true;
    }
    if (/(\u4f60\u8bf4\u7684|\u4f60\u63d0\u5230|\u524d\u9762\u8bf4|\u521a\u624d|\u4e0a\u9762|\u8fd9\u4e2a|\u90a3\u4e2a).{0,5}(\u662f\u4ec0\u4e48|\u5565\u610f\u601d|\u600e\u4e48\u7406\u89e3|\u4ec0\u4e48\u610f\u601d)/.test(q)) {
      return true;
    }
    return false;
  }

  // ── Question normalization ────────────────────────────────────────

  private normalizeQuestion(q: string): string {
    q = q.replace(/[`*_#]/g, '').trim();

    const shortLimit = this.lang === 'en' ? 30 : 20;
    if (q.length <= shortLimit && this.extractCoreNouns(q).length > 0) {
      return this.cleanLabel(q);
    }

    const nouns = this.extractCoreNouns(q);

    if (this.lang === 'en') {
      if (/\bwhat\s+(?:is|are|does)\b/i.test(q) && nouns.length > 0) {
        return nouns.slice(0, 2).join(' — ');
      }
      if (/\bwhy\b/i.test(q) && nouns.length > 0) {
        return 'why ' + nouns.slice(0, 2).join(' / ');
      }
      if (/\bhow\s+(?:to|do|does|can)\b/i.test(q) && nouns.length > 0) {
        return 'how ' + nouns.slice(0, 2).join(' ');
      }
      if (/\b(?:difference|compare|versus|vs)\b/i.test(q) && nouns.length >= 2) {
        return nouns[0] + ' vs ' + nouns[1];
      }
      // Clarification / follow-up questions: summarize what they're asking about
      if (/\b(?:don'?t understand|don'?t get|confused|unclear)\b/i.test(q) && nouns.length > 0) {
        return 'clarification: ' + nouns.slice(0, 3).join(' ');
      }
    } else {
      if (/\u4ec0\u4e48\u662f|\u662f\u4ec0\u4e48|\u662f\u5565|\u5565\u610f\u601d/.test(q) && nouns.length > 0) {
        return nouns[0] + ' \u7684\u6982\u5ff5';
      }
      if (/\u4e3a\u4ec0\u4e48|\u4e3a\u5565|\u5e72\u561b|\u548b/.test(q) && nouns.length > 0) {
        return '\u4e3a\u4ec0\u4e48 ' + nouns.slice(0, 2).join(' / ');
      }
      if (/\u600e\u4e48|\u5982\u4f55|\u600e\u6837/.test(q) && nouns.length > 0) {
        return '\u5982\u4f55 ' + nouns.slice(0, 2).join(' ');
      }
      if (/\u533a\u522b|\u5bf9\u6bd4|\u4e0d\u540c|vs/i.test(q) && nouns.length >= 2) {
        return nouns[0] + ' vs ' + nouns[1];
      }
    }

    if (this.lang === 'en') {
      if (nouns.length > 0) return nouns.slice(0, 3).join(', ');
    } else {
      if (nouns.length > 0) return nouns.slice(0, 3).join(' + ');
    }

    const firstSentence = q.match(/^(.+?[?\uff1f\u3002!\uff01])/);
    if (firstSentence && firstSentence[1].length <= 30) return firstSentence[1];

    return q.slice(0, 25) + (q.length > 25 ? '...' : '');
  }

  // ── Core noun extraction ──────────────────────────────────────────

  private extractCoreNouns(text: string): string[] {
    const nouns: string[] = [];

    // English: split into words, remove stopwords, group adjacent content words into noun phrases
    if (this.lang === 'en') {
      // Extract quoted/backticked terms first (highest priority)
      const quoted = text.match(/[`"'\u300c]([^`"'\u300d]+)[`"'\u300d]/g) || [];
      for (const q of quoted) {
        const inner = q.replace(/[`"'\u300c\u300d]/g, '').trim();
        if (inner.length > 1 && inner.length < 30) nouns.push(inner.toLowerCase());
      }

      // Extract capitalized terms / acronyms (e.g. "Transformer", "RNN", "BPE")
      const caps = text.match(/\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g) || [];
      for (const cap of caps) {
        const t = cap.trim().toLowerCase();
        if (t.length > 1 && !EN_STOPWORDS.has(t)) nouns.push(t);
      }
      const acronyms = text.match(/\b[A-Z]{2,}\b/g) || [];
      for (const acr of acronyms) {
        nouns.push(acr.toLowerCase());
      }

      // Split text into words, filter stopwords, group remaining into noun phrases
      const words = text.replace(/[^a-zA-Z0-9._-]+/g, ' ').split(/\s+/);
      let currentPhrase: string[] = [];
      for (const word of words) {
        const w = word.toLowerCase();
        if (w.length <= 2 || EN_STOPWORDS.has(w)) {
          if (currentPhrase.length > 0) {
            nouns.push(currentPhrase.join(' '));
            currentPhrase = [];
          }
        } else {
          currentPhrase.push(w);
        }
      }
      if (currentPhrase.length > 0) nouns.push(currentPhrase.join(' '));
    } else {
      // Chinese: keep existing logic
      const enTerms = text.match(/[A-Za-z][A-Za-z0-9._-]{2,}(?:\s+[A-Za-z][A-Za-z0-9._-]+)*/g) || [];
      for (const term of enTerms) {
        const t = term.trim().toLowerCase();
        if (!EN_STOPWORDS.has(t) && t.length > 2) nouns.push(t);
      }

      const quoted = text.match(/[`"'\u300c]([^`"'\u300d]+)[`"'\u300d]/g) || [];
      for (const q of quoted) {
        const inner = q.replace(/[`"'\u300c\u300d]/g, '').trim();
        if (inner.length > 1 && inner.length < 30) nouns.push(inner.toLowerCase());
      }
    }

    const zhPhrases = text.match(/[\u4e00-\u9fa5]{3,8}/g) || [];
    for (const phrase of zhPhrases) {
      if (!ZH_STOPWORDS.has(phrase) && !this.isColloquial(phrase)) nouns.push(phrase);
    }

    return [...new Set(nouns)];
  }

  // ── Markdown output ───────────────────────────────────────────────

  private renderMarkdown(tree: TNode): string {
    const lines: string[] = [];
    lines.push('# ' + tree.label);
    lines.push('');
    for (const child of tree.children) {
      this.renderNode(child, 0, lines);
    }
    return lines.join('\n');
  }

  private renderNode(node: TNode, depth: number, lines: string[]): void {
    const indent = '    '.repeat(depth);
    lines.push(`${indent}- ${node.label}`);
    if (node.children) {
      for (const child of node.children) {
        this.renderNode(child, depth + 1, lines);
      }
    }
  }

  // ── Utility functions ─────────────────────────────────────────────

  private generateRootTitle(segments: Segment[]): string {
    if (segments.length === 0) return this.lang === 'en' ? 'Conversation Summary' : '\u5bf9\u8bdd\u603b\u7ed3';
    if (segments.length === 1) return segments[0].title;

    if (this.lang === 'en') {
      // For English: use segment titles directly, pick up to 2 most meaningful ones
      const titles = segments.map(s => s.title).filter(t => t.length > 2);
      if (titles.length === 0) return 'Conversation Summary';
      if (titles.length === 1) return titles[0];
      // Use first 2 segment titles joined by &, capitalize first letter
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return cap(titles[0]) + ' & ' + cap(titles[1]) + (titles.length > 2 ? ' +' : '');
    }

    const allNouns = segments.flatMap(s => this.extractCoreNouns(s.title));
    const freq: Record<string, number> = {};
    for (const n of allNouns) freq[n] = (freq[n] || 0) + 1;
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2);

    const connector = ' \u4e0e ';
    if (top.length >= 2) return top[0][0] + connector + top[1][0];
    if (top.length === 1) return top[0][0];
    return segments[0].title;
  }

  private cleanLabel(text: string): string {
    let cleaned = text
      .replace(/\*+/g, '')
      .replace(/^[:\uff1a\u2014\-\u2013\s]+/, '')
      .replace(/[:\uff1a\u2014\-\u2013\s]+$/, '');

    if (this.lang === 'en') {
      cleaned = cleaned.replace(/^(so|well|basically|actually|like|i mean|you know|ok so|right so)\s+/i, '');
    } else {
      cleaned = cleaned.replace(/^(\u90a3|\u6240\u4ee5|\u5176\u5b9e|\u5c31\u662f\u8bf4|\u4e5f\u5c31\u662f\u8bf4)\s*/g, '');
    }

    return cleaned.trim();
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const sub = text.slice(0, maxLen);
    const lastPunc = Math.max(
      sub.lastIndexOf('\uff0c'), sub.lastIndexOf('\u3002'),
      sub.lastIndexOf('\u3001'), sub.lastIndexOf(','),
      sub.lastIndexOf(';'), sub.lastIndexOf('\uff1b'),
    );
    if (lastPunc > maxLen * 0.5) return text.slice(0, lastPunc);
    return sub + '...';
  }

  private isColloquial(phrase: string): boolean {
    if (this.lang === 'en') {
      return [
        /^(in other words|that is to say|for example|for instance|let me put it this way)/i,
        /^(you can|you need|you should|you want|we can|they can|this is)/i,
        /^(first|second|then|next|finally|also|after that|before that)/i,
        /^(however|but|although|therefore|because|since|due to)/i,
        /^(this|that|these|those|some|another|the same)/i,
      ].some(p => p.test(phrase));
    }
    return [
      /^(\u5c31\u662f\u8bf4|\u4e5f\u5c31\u662f|\u7b80\u5355\u6765\u8bf4|\u6362\u53e5\u8bdd\u8bf4|\u6253\u4e2a\u6bd4\u65b9|\u4e3e\u4e2a\u4f8b\u5b50|\u6bd4\u65b9\u8bf4)/,
      /^(\u4f60\u53ef\u4ee5|\u4f60\u9700\u8981|\u4f60\u5e94\u8be5|\u4f60\u60f3|\u4f60\u770b|\u6211\u4eec|\u4ed6\u4eec|\u8fd9\u6837)/,
      /^(\u5148\u8bf4|\u518d\u8bf4|\u7136\u540e|\u63a5\u4e0b\u6765|\u6700\u540e|\u9996\u5148|\u5176\u6b21)/,
      /^(\u4e0d\u8fc7|\u4f46\u662f|\u7136\u800c|\u6240\u4ee5|\u56e0\u6b64|\u56e0\u4e3a|\u7531\u4e8e)/,
      /^(\u8fd9\u4e2a|\u90a3\u4e2a|\u8fd9\u79cd|\u90a3\u79cd|\u67d0\u4e2a|\u67d0\u79cd)/,
    ].some(p => p.test(phrase));
  }

  /** EN only: detect meta/noise questions with no knowledge content */
  private isEnMetaQuestion(q: string): boolean {
    return [
      /\b(?:why.*(?:answer|respond|reply|speak|write).*(?:chinese|english|mandarin|spanish|french))/i,
      /\b(?:(?:answer|respond|reply|speak|write).*(?:in english|in chinese|in mandarin))/i,
      /\b(?:change|switch|use).*(?:language|english|chinese)/i,
      /\b(?:translate|translation)\b/i,
      /\b(?:format|formatting|font|style|layout|markdown|bold|italic)\b/i,
      /^(?:ok|okay|sure|got it|i see|thanks|thank you|thx|ty|great|nice|good|cool|perfect|alright)[\s.,!]*$/i,
      /^(?:continue|go on|go ahead|next|yes|yeah|yep|yup|right|correct)[\s.,!]*$/i,
    ].some(p => p.test(q));
  }

  private isMetaHeader(text: string): boolean {
    if (this.lang === 'en') {
      return [
        /^(summary|conclusion|note|tip|warning|important|caveat|takeaway)/i,
        /^(step\s*\d+|example|case study|hands-on|practice|exercise)/i,
        /^(key points|quick recap|in short|tl;?dr)/i,
      ].some(p => p.test(text));
    }
    return [
      /^(\u603b\u7ed3|\u5c0f\u7ed3|\u6ce8\u610f|\u8865\u5145|\u8bf4\u660e|\u63d0\u793a|\u907f\u5751|\u4eba\u7c7b\u7ecf\u9a8c)/,
      /^(\u7b2c[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\d]+\u6b65)/,
      /^(\u793a\u4f8b|\u4f8b\u5b50|\u6848\u4f8b|\u5b9e\u64cd|\u64cd\u4f5c\u6b65\u9aa4)/,
    ].some(p => p.test(text));
  }

  private mergeHeadersAndPoints(headers: KP[], points: KP[]): KP[] {
    const merged = headers.map(h => ({
      ...h,
      subpoints: [] as KP[],
    }));

    if (merged.length > 0 && points.length > 0) {
      const perHeader = Math.ceil(points.length / merged.length);
      let pi = 0;
      for (const h of merged) {
        h.subpoints = points.slice(pi, pi + perHeader);
        pi += perHeader;
      }
    }

    return merged;
  }

  private dedup(points: KP[]): KP[] {
    const seen = new Set<string>();
    return points.filter(p => {
      const key = p.label.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
