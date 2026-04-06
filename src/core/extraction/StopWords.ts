// Common English stopwords + AI conversation filler words
const STOP_WORDS = new Set([
  // English stopwords
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if',
  'while', 'although', 'about', 'up', 'down',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'isn', 'aren', 'wasn', 'weren', 'hasn', 'haven', 'hadn',
  'doesn', 'don', 'didn', 'won', 'wouldn', 'couldn', 'shouldn',
  'also', 'well', 'back', 'even', 'still', 'new', 'get', 'make',
  'like', 'know', 'take', 'come', 'go', 'see', 'think', 'say',
  'much', 'many', 'way', 'thing', 'things', 'really',

  // AI conversation fillers
  'sure', 'certainly', 'absolutely', 'basically', 'essentially',
  'actually', 'simply', 'obviously', 'clearly', 'great', 'question',
  'let', 'help', 'explain', 'understand', 'example', 'note',
  'important', 'means', 'use', 'using', 'used', 'work', 'works',
  'working', 'want', 'right', 'good', 'look', 'looking',

  // Chinese stopwords (encoded as Unicode escapes for Chrome extension compatibility)
  '\u7684', '\u4e86', '\u5728', '\u662f', '\u6211', '\u6709', '\u548c', '\u5c31', '\u4e0d', '\u4eba', '\u90fd', '\u4e00',
  '\u4e00\u4e2a', '\u4e0a', '\u4e5f', '\u5f88', '\u5230', '\u8bf4', '\u8981', '\u53bb', '\u4f60', '\u4f1a', '\u7740',
  '\u6ca1\u6709', '\u770b', '\u597d', '\u81ea\u5df1', '\u8fd9', '\u4ed6', '\u5979', '\u5b83', '\u4eec', '\u90a3', '\u4e9b',
  '\u4ec0\u4e48', '\u600e\u4e48', '\u4e3a\u4ec0\u4e48', '\u54ea', '\u5417', '\u5462', '\u5427', '\u554a', '\u55ef', '\u54e6',
  '\u53ef\u4ee5', '\u80fd', '\u80fd\u591f', '\u4f46\u662f', '\u800c\u4e14', '\u7136\u540e', '\u6240\u4ee5', '\u56e0\u4e3a', '\u5982\u679c',
  '\u8fd9\u4e2a', '\u90a3\u4e2a', '\u4e00\u4e0b', '\u5df2\u7ecf', '\u8fd8\u662f', '\u6216\u8005', '\u4ee5\u53ca', '\u5173\u4e8e',
]);

export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase());
}

export function removeStopWords(words: string[]): string[] {
  return words.filter((w) => !isStopWord(w) && w.length > 1);
}
