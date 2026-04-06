// === Conversation Types ===

export type MessageRole = 'user' | 'assistant';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  rawHTML: string;
  timestamp: number;
  codeBlocks: string[];
  listItems: string[];
  headings: string[];
  boldTerms: string[];
}

// === Graph Types ===

export type NodeType = 'root' | 'topic' | 'concept' | 'detail' | 'example';

export type RelationType =
  | 'parent-child'
  | 'sibling'
  | 'related'
  | 'example-of'
  | 'contrasts-with';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  weight: number;
  messageIndices: number[];
  metadata: {
    firstSeen: number;
    mentionCount: number;
    sourceRole: MessageRole | 'both';
  };
  children: string[]; // child node IDs
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  weight: number;
}

export interface KnowledgeGraphState {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  rootId: string;
}

// === Extraction Types ===

export interface ExtractedTerm {
  term: string;
  score: number;
  source: MessageRole | 'both';
}

export interface TopicSegment {
  id: string;
  mainTopic: string;
  subTopics: string[];
  messageRange: [number, number];
  depth: number;
  parentSegmentId?: string;
}

export interface ExtractionResult {
  terms: ExtractedTerm[];
  segment: TopicSegment;
  relations: DetectedRelation[];
}

export interface DetectedRelation {
  source: string;
  target: string;
  type: RelationType;
  confidence: number;
}

// === Store Types ===

export type PanelType = 'mindmap' | 'notes';
export type LayoutMode = 'horizontal' | 'vertical';

export interface MindFlowSettings {
  autoExpand: boolean;
  theme: 'light' | 'dark' | 'auto';
  exportFormat: 'obsidian' | 'plain';
  extractionMode: 'api';
  apiProvider: 'anthropic' | 'deepseek' | 'gemini' | 'openai' | 'doubao';
  // apiKey is stored in chrome.storage.local only, never in Zustand
}

/** @deprecated — kept for backward compatibility; new AI extractor uses MindmapJSON internally */
export interface AIExtractionResponse {
  topic: string;
  keyPoints: string[];
  parentConnection: string | null;
}
