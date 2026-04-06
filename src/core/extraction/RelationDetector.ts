import type {
  ConversationMessage,
  DetectedRelation,
  ExtractedTerm,
} from '../types';

// Patterns for different relationship types
const EXAMPLE_PATTERNS = [
  /(?:for\s+example|such\s+as|e\.g\.|like|including|for\s+instance)/i,
  /(?:\u4f8b\u5982|\u6bd4\u5982|\u6bd4\u65b9\u8bf4|\u5305\u62ec|\u50cf\u662f)/,
];

const CONTRAST_PATTERNS = [
  /(?:unlike|compared\s+to|whereas|in\s+contrast|vs\.?|versus|rather\s+than|on\s+the\s+other\s+hand|different\s+from)/i,
  /(?:\u4e0d\u540c\u4e8e|\u76f8\u6bd4|\u4e0e.*\u4e0d\u540c|\u533a\u522b\u5728\u4e8e|\u53cd\u4e4b|\u800c\u4e0d\u662f)/,
];

const COMPOSITION_PATTERNS = [
  /(?:consists?\s+of|composed\s+of|includes?|contains?|made\s+up\s+of|types?\s+of|kinds?\s+of|categories\s+of)/i,
  /(?:\u7531.*\u7ec4\u6210|\u5305\u542b|\u5206\u4e3a|\u7c7b\u578b\u6709|\u79cd\u7c7b)/,
];

export class RelationDetector {
  /** Detect relationships between extracted terms within a message */
  detect(
    terms: ExtractedTerm[],
    message: ConversationMessage
  ): DetectedRelation[] {
    const relations: DetectedRelation[] = [];

    // 1. Heading hierarchy -> parent-child
    relations.push(
      ...this.detectHeadingHierarchy(terms, message)
    );

    // 2. List items under same context -> sibling
    relations.push(
      ...this.detectListSiblings(terms, message)
    );

    // 3. Pattern-based relations
    relations.push(
      ...this.detectPatternRelations(terms, message)
    );

    // 4. Co-occurrence in same sentence -> related
    relations.push(
      ...this.detectCoOccurrence(terms, message)
    );

    return this.deduplicateRelations(relations);
  }

  private detectHeadingHierarchy(
    terms: ExtractedTerm[],
    message: ConversationMessage
  ): DetectedRelation[] {
    const relations: DetectedRelation[] = [];
    const { headings } = message;

    if (headings.length < 2) return relations;

    // Treat consecutive headings as parent-child pairs
    // (simplification: real heading levels from DOM would be better)
    for (let i = 0; i < headings.length - 1; i++) {
      const parentTerm = this.findMatchingTerm(
        headings[i],
        terms
      );
      const childTerm = this.findMatchingTerm(
        headings[i + 1],
        terms
      );

      if (parentTerm && childTerm && parentTerm !== childTerm) {
        relations.push({
          source: parentTerm,
          target: childTerm,
          type: 'parent-child',
          confidence: 0.8,
        });
      }
    }

    return relations;
  }

  private detectListSiblings(
    terms: ExtractedTerm[],
    message: ConversationMessage
  ): DetectedRelation[] {
    const relations: DetectedRelation[] = [];
    const { listItems } = message;

    if (listItems.length < 2) return relations;

    // Find terms that appear in list items
    const listTerms: string[] = [];
    for (const item of listItems) {
      const match = this.findMatchingTerm(item, terms);
      if (match) listTerms.push(match);
    }

    // Terms in same list are siblings
    for (let i = 0; i < listTerms.length; i++) {
      for (let j = i + 1; j < listTerms.length; j++) {
        if (listTerms[i] !== listTerms[j]) {
          relations.push({
            source: listTerms[i],
            target: listTerms[j],
            type: 'sibling',
            confidence: 0.7,
          });
        }
      }
    }

    return relations;
  }

  private detectPatternRelations(
    terms: ExtractedTerm[],
    message: ConversationMessage
  ): DetectedRelation[] {
    const relations: DetectedRelation[] = [];
    const content = message.content;

    // Split into sentences for local analysis
    const sentences = content.split(/[.!?\u3002\uff01\uff1f]+/).filter(Boolean);

    for (const sentence of sentences) {
      const sentenceTerms = terms.filter((t) =>
        sentence.toLowerCase().includes(t.term.toLowerCase())
      );

      if (sentenceTerms.length < 2) continue;

      // Check for example-of pattern
      if (EXAMPLE_PATTERNS.some((p) => p.test(sentence))) {
        // First term is the concept, rest are examples
        for (let i = 1; i < sentenceTerms.length; i++) {
          relations.push({
            source: sentenceTerms[0].term,
            target: sentenceTerms[i].term,
            type: 'example-of',
            confidence: 0.75,
          });
        }
      }

      // Check for contrast pattern
      if (CONTRAST_PATTERNS.some((p) => p.test(sentence))) {
        for (let i = 0; i < sentenceTerms.length - 1; i++) {
          relations.push({
            source: sentenceTerms[i].term,
            target: sentenceTerms[i + 1].term,
            type: 'contrasts-with',
            confidence: 0.7,
          });
        }
      }

      // Check for composition pattern
      if (COMPOSITION_PATTERNS.some((p) => p.test(sentence))) {
        for (let i = 1; i < sentenceTerms.length; i++) {
          relations.push({
            source: sentenceTerms[0].term,
            target: sentenceTerms[i].term,
            type: 'parent-child',
            confidence: 0.75,
          });
        }
      }
    }

    return relations;
  }

  private detectCoOccurrence(
    terms: ExtractedTerm[],
    message: ConversationMessage
  ): DetectedRelation[] {
    const relations: DetectedRelation[] = [];
    const sentences = message.content
      .split(/[.!?\u3002\uff01\uff1f]+/)
      .filter(Boolean);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const presentTerms = terms.filter((t) =>
        lower.includes(t.term.toLowerCase())
      );

      // If 2-3 terms co-occur in same sentence, they're related
      if (presentTerms.length >= 2 && presentTerms.length <= 3) {
        for (let i = 0; i < presentTerms.length - 1; i++) {
          for (
            let j = i + 1;
            j < presentTerms.length;
            j++
          ) {
            // Only add if no stronger relation already exists
            relations.push({
              source: presentTerms[i].term,
              target: presentTerms[j].term,
              type: 'related',
              confidence: 0.5,
            });
          }
        }
      }
    }

    return relations;
  }

  private findMatchingTerm(
    text: string,
    terms: ExtractedTerm[]
  ): string | null {
    const lower = text.toLowerCase();
    // Try exact match first, then substring
    const exact = terms.find(
      (t) => t.term.toLowerCase() === lower
    );
    if (exact) return exact.term;

    const partial = terms.find(
      (t) =>
        lower.includes(t.term.toLowerCase()) ||
        t.term.toLowerCase().includes(lower)
    );
    return partial?.term ?? null;
  }

  private deduplicateRelations(
    relations: DetectedRelation[]
  ): DetectedRelation[] {
    const seen = new Map<string, DetectedRelation>();
    for (const rel of relations) {
      const key = `${rel.source}|${rel.target}|${rel.type}`;
      const reverseKey = `${rel.target}|${rel.source}|${rel.type}`;
      const existing =
        seen.get(key) ?? seen.get(reverseKey);
      if (!existing || rel.confidence > existing.confidence) {
        seen.set(key, rel);
      }
    }
    return [...seen.values()];
  }
}
