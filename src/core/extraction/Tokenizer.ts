import { removeStopWords } from './StopWords';

/** Split text into sentences */
export function splitSentences(text: string): string[] {
  // Handle both English and Chinese sentence endings
  return text
    .split(/(?<=[.!?\u3002\uff01\uff1f])\s+|(?<=[.!?\u3002\uff01\uff1f])(?=[A-Z\u4e00-\u9fff])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenize text into words (handles English and Chinese) */
export function tokenize(text: string): string[] {
  // Extract English words and Chinese characters
  const englishWords = text.match(/[a-zA-Z][a-zA-Z0-9_-]*(?:\.[a-zA-Z]+)*/g) ?? [];
  const chineseChars = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];

  return [...englishWords, ...chineseChars].map((w) => w.toLowerCase());
}

/** Clean text: remove extra whitespace, normalize */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u4e00-\u9fff.,!?;:'"()[\]{}\-\u2013\u2014/\\@#$%^&*+=<>\u3002\uff0c\uff01\uff1f\uff1b\uff1a\u201c\u201d\u2018\u2019\uff08\uff09\u3010\u3011\u3001]/g, '')
    .trim();
}

/** Tokenize and remove stop words */
export function tokenizeAndClean(text: string): string[] {
  const tokens = tokenize(cleanText(text));
  return removeStopWords(tokens);
}

/**
 * Extract candidate phrases using RAKE-style splitting:
 * Split at stopwords and punctuation to get multi-word phrases
 */
export function extractCandidatePhrases(text: string): string[] {
  const cleaned = cleanText(text);
  // Split at stopword boundaries and punctuation
  const phrases = cleaned
    .split(
      /(?:\s+(?:a|an|the|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|to|of|in|for|on|with|at|by|from|as|into|through|during|before|after|and|or|but|if|while|not|no|so|than|very|just|also|\u7684|\u4e86|\u5728|\u662f|\u548c|\u5c31|\u4e0d|\u90fd|\u4e00|\u4e5f|\u5f88|\u5230)\s+)|[,;:!?\u3002\uff0c\uff01\uff1f\uff1b\uff1a\n\t]+/i
    )
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 2 && p.split(/\s+/).length <= 5);

  return [...new Set(phrases)];
}
