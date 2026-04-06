import type {
  GraphNode,
  GraphEdge,
  ExtractionResult,
  KnowledgeGraphState,
} from '../types';
import { createGraphNode, slugify } from './GraphNode';
import { createGraphEdge } from './GraphEdge';

const ALIAS_MAP: Record<string, string> = {
  'js': 'JavaScript',
  'gc': 'Garbage Collector',
  'cli': 'CLI (Command Line Interface)',
  'gui': 'GUI (Graphical User Interface)',
  'npm': 'npm (Node Package Manager)',
  'rag': 'RAG (Retrieval-Augmented Generation)',
  'os': 'Operating System',
  'vm': 'Virtual Machine',
  'vms': 'Virtual Machine',
  'isa': 'ISA (Instruction Set Architecture)',
  'llm': 'LLM (Large Language Model)',
  'llms': 'LLM (Large Language Model)',
};

export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private rootId: string = '';
  private aliasIndex = new Map<string, string>();

  setTitle(title: string): void {
    if (!this.rootId) {
      const rootNode = createGraphNode(title, 'root', 0, 'both');
      this.rootId = rootNode.id;
      this.nodes.set(rootNode.id, rootNode);
    } else {
      const root = this.nodes.get(this.rootId);
      if (root) root.label = title;
    }
  }

  /**
   * Merge extraction results.
   * Key principle: only build parent-child from explicit relations.
   * Don't auto-attach everything to root — let the conversation flow define structure.
   */
  merge(result: ExtractionResult, messageIndex: number): void {
    const { terms, segment, relations } = result;

    // Ensure root
    if (!this.rootId) {
      const rootNode = createGraphNode(segment.mainTopic, 'root', messageIndex, 'both');
      this.rootId = rootNode.id;
      this.nodes.set(rootNode.id, rootNode);
    }

    // Create nodes for all terms (but don't connect them yet)
    for (const term of terms) {
      const nodeType = term.score >= 8 ? 'topic' : term.score >= 3 ? 'concept' : 'detail';
      this.ensureNode(term.term, term.score, messageIndex, term.source, nodeType);
    }

    // Build tree structure from relations
    // Key rule: only user-question-sourced relations build the tree skeleton.
    // Assistant-internal relations (heading hierarchy etc.) are stored as edges only.
    const isUserSourced = terms.length > 0 && terms[0].source === 'user';

    for (const rel of relations) {
      const sourceId = this.resolveId(rel.source);
      const targetId = this.resolveId(rel.target);

      if (this.nodes.has(sourceId) && this.nodes.has(targetId) && sourceId !== targetId) {
        const edge = createGraphEdge(sourceId, targetId, rel.type, rel.confidence);
        this.edges.set(edge.id, edge);

        // Only build parent-child tree from:
        // 1. User question → question causal chains
        // 2. User question → answer knowledge points
        if (rel.type === 'parent-child' && (isUserSourced || rel.confidence >= 0.9)) {
          this.addChildRelation(sourceId, targetId);
        }
      }
    }

    // Connect orphan QUESTION nodes (user-sourced, high score) to root
    // Don't auto-connect assistant knowledge points — they should only
    // appear under their parent question node
    for (const term of terms) {
      if (term.source !== 'user') continue;
      const id = this.resolveId(term.term);
      if (id !== this.rootId && !this.hasParent(id)) {
        this.addChildRelation(this.rootId, id);
      }
    }
  }

  /** Check if a node has any parent */
  private hasParent(nodeId: string): boolean {
    for (const node of this.nodes.values()) {
      if (node.children.includes(nodeId)) return true;
    }
    return false;
  }

  private resolveId(label: string): string {
    const resolved = this.resolveAlias(label);
    return resolved.id;
  }

  private resolveAlias(label: string): { label: string; id: string } {
    const lowerLabel = label.toLowerCase().trim();
    const alias = ALIAS_MAP[lowerLabel];
    if (alias) {
      return { label: alias, id: slugify(alias) };
    }
    const id = slugify(label);
    const canonical = this.aliasIndex.get(id);
    if (canonical) {
      const node = this.nodes.get(canonical);
      return { label: node?.label ?? label, id: canonical };
    }
    return { label, id };
  }

  private ensureNode(
    label: string,
    score: number,
    messageIndex: number,
    source: 'user' | 'assistant' | 'both',
    nodeType: 'root' | 'topic' | 'concept' | 'detail' | 'example'
  ): string {
    const resolved = this.resolveAlias(label);
    const id = resolved.id;
    label = resolved.label;

    const originalId = slugify(label);
    if (originalId !== id) {
      this.aliasIndex.set(originalId, id);
    }

    const existing = this.nodes.get(id);
    if (existing) {
      existing.weight += score;
      existing.metadata.mentionCount++;
      if (!existing.messageIndices.includes(messageIndex)) {
        existing.messageIndices.push(messageIndex);
      }
      if (existing.metadata.sourceRole !== source && existing.metadata.sourceRole !== 'both') {
        existing.metadata.sourceRole = 'both';
      }
      if (nodeType === 'topic' && existing.type !== 'root') {
        existing.type = 'topic';
      }
    } else {
      const node = createGraphNode(label, nodeType, messageIndex, source);
      node.weight = score;
      node.id = id;
      this.nodes.set(id, node);
    }

    return id;
  }

  /** Convert graph to markdown tree. Prioritize Q&A causal chain as skeleton. */
  toMarkdownTree(): string {
    if (!this.rootId) return '# (empty)';
    const root = this.nodes.get(this.rootId);
    if (!root) return '# (empty)';

    const lines: string[] = [];
    const visited = new Set<string>();
    this.buildMarkdownTree(root, 1, lines, visited);

    return lines.join('\n');
  }

  getTopNodes(limit: number = 20): GraphNode[] {
    return [...this.nodes.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  getState(): KnowledgeGraphState {
    return { nodes: new Map(this.nodes), edges: new Map(this.edges), rootId: this.rootId };
  }

  getNodes(): GraphNode[] { return [...this.nodes.values()]; }
  getEdges(): GraphEdge[] { return [...this.edges.values()]; }
  getRootId(): string { return this.rootId; }

  private addChildRelation(parentId: string, childId: string): void {
    const parent = this.nodes.get(parentId);
    if (parent && !parent.children.includes(childId)) {
      parent.children.push(childId);
    }
  }

  private buildMarkdownTree(
    node: GraphNode,
    depth: number,
    lines: string[],
    visited: Set<string>,
    maxTotalNodes: number = 35
  ): void {
    if (visited.has(node.id)) return;
    if (visited.size >= maxTotalNodes) return; // hard cap
    visited.add(node.id);

    if (depth <= 6) {
      lines.push(`${'#'.repeat(depth)} ${node.label}`);
    } else {
      lines.push(`${'  '.repeat(depth - 6)}- ${node.label}`);
    }

    // Sort children: user questions first, then by weight
    const childNodes = node.children
      .map(id => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined)
      .sort((a, b) => {
        if (a.metadata.sourceRole === 'user' && b.metadata.sourceRole !== 'user') return -1;
        if (b.metadata.sourceRole === 'user' && a.metadata.sourceRole !== 'user') return 1;
        return b.weight - a.weight;
      });

    // Limit children: questions unlimited, knowledge points max 3
    const questions = childNodes.filter(n => n.metadata.sourceRole === 'user');
    const knowledgePoints = childNodes.filter(n => n.metadata.sourceRole !== 'user').slice(0, 3);
    const limitedChildren = [...questions, ...knowledgePoints];

    for (const child of limitedChildren) {
      this.buildMarkdownTree(child, depth + 1, lines, visited, maxTotalNodes);
    }
  }
}
