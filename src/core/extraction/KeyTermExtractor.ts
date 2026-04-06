import type { ConversationMessage, ExtractedTerm } from '../types';
import { isStopWord } from './StopWords';

/**
 * Improved key term extraction strategy:
 * 1. Headings and bold terms are ALWAYS top-priority concepts (structural signal)
 * 2. Use cleaned noun-phrase extraction instead of raw RAKE (avoid sentence fragments)
 * 3. TF-IDF only as secondary scoring, not primary extraction
 * 4. Filter out single characters, common verbs, and sentence fragments
 */

const NOISE_WORDS = new Set([
  // Single letters and common fragments that aren't concepts
  'a', 'b', 'c', 'd', 'p', 'vs', 'e', 'f', 'g',
  'case', 'step', 'route', 'please', 'explain', 'said',
  'mean', 'exactly', 'means', 'thing', 'something',
  'way', 'method', 'approach', 'point', 'points',
  'example', 'examples', 'question', 'answer',
  'first', 'second', 'third', 'problem', 'type',
  // Common sentence-start words that get captured as "capitalized"
  'the', 'this', 'that', 'these', 'those', 'here', 'there',
  'when', 'where', 'why', 'how', 'what', 'which', 'who',
  'but', 'and', 'or', 'so', 'because', 'if', 'then',
  'not', 'no', 'yes', 'your', 'its', 'their', 'our',
  'can', 'cannot', 'could', 'would', 'should', 'will',
  'every', 'each', 'both', 'same', 'different', 'another',
  'like', 'also', 'just', 'still', 'even', 'only',
  'think', 'imagine', 'remember', 'forget', 'notice',
  'later', 'now', 'before', 'after', 'during',
  'changing', 'retraining', 'timeliness', 'unreferenced',
  'developers', 'in cs', 'in js', 'in linux', 'the js', 'the os', 'the gc',
  'because gc', 'for os', 'like qwerty',
  'hard', 'building', 'historical', 'optional', 'built-in',
  // Noise from AI conversation context
  'ppt', 'pdf', 'create variable', 'and logical rules',
  'web chat', 'cli tool', 'human-computer', 'cpus',
  'read-only', 'system built-in, read-only', 'example skills, read-only',
  'user custom skills', 'core instructions',
  'route', 'route a', 'route b', 'computer theory behind it',
  'route a: claude code', 'route b: claude.ai',
  // Duplicates when alias/full-form already captured
  'retrieval-augmented generation', 'command line interface',
  'instruction set architecture', 'node package manager',
  // Low-value detail terms (clutter the mind map)
  'auto-reclaimed', 'malloc in c', 'free in c', 'create variable',
  'spidermonkey', 'javascriptcore', 'cmd', 'powershell',
  'npmjs.com', 'skills', 'skill mechanism', 'augmented generation',
  'web search augmentation',
  'route a: claude code', 'route b: claude.ai',
  'javascript essence', 'why trapped in browser',
  'two different claude products',
]);

const CONCEPT_PATTERNS = [
  // English technical terms: capitalized or multi-word with specific patterns
  /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g,  // Capitalized phrases: "Garbage Collector"
  /\b[A-Z]{2,}(?:\s*[-/]\s*[A-Z]{2,})*\b/g,       // Acronyms: "RAG", "CLI", "GUI", "GC"
  /\b[a-z]+[-_.][a-z]+(?:[-_.][a-z]+)*\b/g,        // Technical names: "node.js", "claude.ai"
];

export class KeyTermExtractor {
  private corpusTokens: Map<string, number> = new Map(); // term -> doc count
  private docCount = 0;

  addToCorpus(content: string): void {
    this.docCount++;
    const tokens = new Set(this.tokenizeSimple(content));
    for (const t of tokens) {
      this.corpusTokens.set(t, (this.corpusTokens.get(t) ?? 0) + 1);
    }
  }

  extract(message: ConversationMessage, topN: number = 15): ExtractedTerm[] {
    const candidates = new Map<string, number>(); // normalized term -> score

    // Priority 1: Headings (highest signal - these ARE the topic structure)
    for (const h of message.headings) {
      const cleaned = this.cleanTerm(h);
      if (cleaned && cleaned.length > 1) {
        candidates.set(cleaned, (candidates.get(cleaned) ?? 0) + 10.0);
      }
    }

    // Priority 2: Bold terms (author explicitly marked as important)
    for (const b of message.boldTerms) {
      const cleaned = this.cleanTerm(b);
      if (cleaned && cleaned.length > 1) {
        candidates.set(cleaned, (candidates.get(cleaned) ?? 0) + 6.0);
      }
    }

    // Priority 3: Extract technical terms and noun phrases from content
    const contentTerms = this.extractConceptsFromText(message.content);
    for (const term of contentTerms) {
      const cleaned = this.cleanTerm(term);
      if (cleaned && cleaned.length > 1) {
        // Apply IDF boost for rare terms
        const idf = this.getIDF(cleaned);
        candidates.set(cleaned, (candidates.get(cleaned) ?? 0) + 2.0 * idf);
      }
    }

    // Priority 4: List items often contain key concepts
    for (const li of message.listItems) {
      // Extract the first meaningful phrase from list item
      const firstPhrase = this.extractFirstPhrase(li);
      if (firstPhrase) {
        candidates.set(firstPhrase, (candidates.get(firstPhrase) ?? 0) + 3.0);
      }
    }

    // Filter and sort
    return [...candidates.entries()]
      .filter(([term]) => !this.isNoise(term))
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([term, score]) => ({
        term,
        score,
        source: message.role,
      }));
  }

  private extractConceptsFromText(text: string): string[] {
    const terms: string[] = [];

    // Extract capitalized phrases (proper nouns / technical terms)
    for (const pattern of CONCEPT_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          if (m.length > 1 && !isStopWord(m.toLowerCase())) {
            terms.push(m);
          }
        }
      }
    }

    // Extract terms in parentheses (often definitions/explanations)
    const parenMatches = text.match(/\(([^)]{2,60})\)/g);
    if (parenMatches) {
      for (const m of parenMatches) {
        const inner = m.slice(1, -1).trim();
        // Only keep if it looks like a term, not a full sentence
        if (inner.split(/\s+/).length <= 5 && !inner.includes('.')) {
          terms.push(inner);
        }
      }
    }

    // Extract terms after "called/named/known as" patterns
    const namedPatterns = [
      /(?:called|named|known as|abbreviated as|short for|stands for)\s+([A-Za-z][A-Za-z0-9\s.-]{1,40})/gi,
      /([A-Za-z][A-Za-z0-9\s.-]{1,30})\s*(?:\(|,\s*(?:or|also|i\.e\.))/gi,
    ];
    for (const pattern of namedPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const term = match[1].trim();
        if (term.length > 1 && term.split(/\s+/).length <= 4) {
          terms.push(term);
        }
      }
    }

    return terms;
  }

  private extractFirstPhrase(text: string): string | null {
    // Get the meaningful part of a list item (before any dash or colon explanation)
    const parts = text.split(/\s*[-\u2014\u2013:]\s*/);
    const first = parts[0]?.trim();
    if (first && first.length > 1 && first.split(/\s+/).length <= 5) {
      return this.cleanTerm(first);
    }
    return null;
  }

  private cleanTerm(term: string): string {
    return term
      .replace(/^[\s*#_-]+|[\s*#_-]+$/g, '') // trim markers
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isNoise(term: string): boolean {
    const lower = term.toLowerCase();
    if (lower.length <= 1) return true;
    if (NOISE_WORDS.has(lower)) return true;
    if (isStopWord(lower)) return true;
    // Filter sentence fragments (too many words)
    if (lower.split(/\s+/).length > 5) return true;
    // Filter terms that start with common articles/prepositions
    if (/^(the|a|an|in|on|at|to|for|with|from|by|of|as|is|are|was|were|be|no|not)\s/i.test(term)) return true;
    // Filter if mostly stopwords
    const words = lower.split(/\s+/);
    const stopCount = words.filter(w => isStopWord(w)).length;
    if (words.length > 2 && stopCount / words.length > 0.6) return true;
    // Filter purely numeric or very short meaningless terms
    if (/^\d+$/.test(lower)) return true;
    // Filter common verb phrases captured as capitalized (sentence starts)
    if (/^(cannot|forget|changing|every|each|later|also|already)$/i.test(lower)) return true;
    return false;
  }

  private getIDF(term: string): number {
    const lower = term.toLowerCase();
    const df = this.corpusTokens.get(lower) ?? 0;
    return Math.log((this.docCount + 1) / (df + 1)) + 1;
  }

  private tokenizeSimple(text: string): string[] {
    return text.toLowerCase().match(/[a-z][a-z0-9._-]+/g) ?? [];
  }
}
