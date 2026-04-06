import type { ConversationMessage, TopicSegment } from '../types';
import { tokenizeAndClean } from './Tokenizer';

// Patterns indicating a new topic
const NEW_TOPIC_PATTERNS = [
  /(?:now|next)\s+(?:let's|let\s+me|I\s+want\s+to)\s+(?:talk|discuss|learn|ask)\s+about/i,
  /(?:switching|moving|turning)\s+(?:to|on\s+to)/i,
  /(?:new|different|another|separate)\s+(?:question|topic|subject)/i,
  /(?:unrelated|off\s+topic)\s+but/i,
  /(?:what|how)\s+about\s+(?!the\s+(?:above|previous|earlier))/i,
  /(?:can|could)\s+you\s+(?:explain|tell\s+me\s+about|describe)\s+(?!more|further)/i,
  /\u6211\u60f3(?:\u95ee|\u4e86\u89e3|\u5b66\u4e60|\u77e5\u9053)/,
  /(?:\u6362\u4e2a|\u53e6\u4e00\u4e2a|\u65b0\u7684)(?:\u8bdd\u9898|\u95ee\u9898)/,
  /(?:\u5173\u4e8e|\u8bf4\u8bf4|\u804a\u804a)(?!\u521a\u624d|\u4e0a\u9762|\u4e4b\u524d)/,
];

// Patterns indicating follow-up / continuation
const FOLLOWUP_PATTERNS = [
  /(?:you\s+mentioned|you\s+said|you\s+were\s+saying)/i,
  /(?:the\s+(?:above|previous|earlier|last))/i,
  /(?:more\s+(?:about|details|specifically|on\s+that))/i,
  /(?:tell\s+me\s+more|can\s+you\s+elaborate|expand\s+on)/i,
  /(?:what\s+do\s+you\s+mean|clarify|in\s+other\s+words)/i,
  /(?:so\s+basically|in\s+summary|to\s+clarify)/i,
  /(?:going\s+back\s+to|returning\s+to|back\s+to)/i,
  /(?:\u8fd8\u662f|\u7ee7\u7eed|\u63a5\u7740|\u5173\u4e8e\u521a\u624d|\u4e0a\u9762\u8bf4\u7684)/,
  /(?:\u518d\u8be6\u7ec6|\u66f4\u591a|\u5177\u4f53|\u5c55\u5f00)/,
];

export class TopicTracker {
  private segments: TopicSegment[] = [];
  private segmentCounter = 0;

  /** Analyze a new user message and determine topic relationship */
  analyzeMessage(
    message: ConversationMessage,
    allMessages: ConversationMessage[],
    messageIndex: number
  ): TopicSegment {
    const currentTokens = tokenizeAndClean(message.content);

    // If first message, create root segment
    if (this.segments.length === 0) {
      return this.createSegment(
        currentTokens,
        messageIndex,
        0
      );
    }

    // Check explicit patterns first
    if (this.matchesPatterns(message.content, NEW_TOPIC_PATTERNS)) {
      return this.createSegment(
        currentTokens,
        messageIndex,
        1
      );
    }

    if (this.matchesPatterns(message.content, FOLLOWUP_PATTERNS)) {
      return this.extendCurrentSegment(messageIndex);
    }

    // Calculate cosine similarity with previous user message
    const prevUserMsg = this.findPreviousUserMessage(
      allMessages,
      messageIndex
    );
    if (prevUserMsg) {
      const prevTokens = tokenizeAndClean(prevUserMsg.content);
      const similarity = this.cosineSimilarity(
        currentTokens,
        prevTokens
      );

      // Low similarity = new topic
      if (similarity < 0.15) {
        return this.createSegment(
          currentTokens,
          messageIndex,
          1
        );
      }
    }

    // Check pronoun density (high pronouns = follow-up)
    const pronounRatio = this.getPronounRatio(message.content);
    if (pronounRatio < 0.05 && currentTokens.length > 3) {
      // Low pronouns + new nouns = likely new topic
      return this.createSegment(
        currentTokens,
        messageIndex,
        1
      );
    }

    // Default: extend current segment
    return this.extendCurrentSegment(messageIndex);
  }

  getSegments(): TopicSegment[] {
    return [...this.segments];
  }

  private createSegment(
    tokens: string[],
    messageIndex: number,
    depth: number
  ): TopicSegment {
    const mainTopic = tokens[0] ?? 'untitled';
    const currentSegment =
      this.segments[this.segments.length - 1];

    const segment: TopicSegment = {
      id: `seg-${this.segmentCounter++}`,
      mainTopic,
      subTopics: tokens.slice(1, 5),
      messageRange: [messageIndex, messageIndex],
      depth,
      parentSegmentId:
        depth > 0 ? currentSegment?.id : undefined,
    };

    this.segments.push(segment);
    return segment;
  }

  private extendCurrentSegment(
    messageIndex: number
  ): TopicSegment {
    const current =
      this.segments[this.segments.length - 1];
    if (current) {
      current.messageRange[1] = messageIndex;
      return current;
    }
    // Shouldn't happen, but create a fallback
    return this.createSegment([], messageIndex, 0);
  }

  private findPreviousUserMessage(
    allMessages: ConversationMessage[],
    currentIndex: number
  ): ConversationMessage | null {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        return allMessages[i];
      }
    }
    return null;
  }

  private matchesPatterns(
    text: string,
    patterns: RegExp[]
  ): boolean {
    return patterns.some((p) => p.test(text));
  }

  private cosineSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const allTerms = new Set([...setA, ...setB]);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of allTerms) {
      const inA = setA.has(term) ? 1 : 0;
      const inB = setB.has(term) ? 1 : 0;
      dotProduct += inA * inB;
      normA += inA * inA;
      normB += inB * inB;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  private getPronounRatio(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const pronouns = new Set([
      'it', 'this', 'that', 'these', 'those', 'they', 'them',
      'its', 'their', 'there', 'here',
      '\u5b83', '\u8fd9', '\u90a3', '\u8fd9\u4e2a', '\u90a3\u4e2a', '\u5b83\u4eec', '\u8fd9\u4e9b', '\u90a3\u4e9b',
    ]);
    const pronounCount = words.filter((w) =>
      pronouns.has(w)
    ).length;
    return words.length > 0 ? pronounCount / words.length : 0;
  }
}
