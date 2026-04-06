import type { GraphNode } from '../types';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';

export interface ObsidianExportOptions {
  title: string;
  source: string;
  date: string;
  tags: string[];
}

export class ObsidianFormatter {
  /** Generate Obsidian-compatible markdown with frontmatter and [[wiki-links]] */
  format(
    graph: KnowledgeGraph,
    options: ObsidianExportOptions
  ): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`title: "${options.title}"`);
    lines.push(`date: ${options.date}`);
    lines.push(`source: ${options.source}`);
    lines.push(`tags: [${options.tags.join(', ')}]`);
    lines.push('mindflow_version: "1.0"');
    lines.push('---');
    lines.push('');

    // Mind map as heading tree with wiki-links
    const nodes = graph.getNodes();
    const rootId = graph.getRootId();
    const root = nodes.find((n) => n.id === rootId);

    if (root) {
      lines.push(`# ${root.label}`);
      lines.push('');
      this.renderNodeTree(root, nodes, graph, 2, lines, new Set());
    }

    return lines.join('\n');
  }

  private renderNodeTree(
    node: GraphNode,
    allNodes: GraphNode[],
    graph: KnowledgeGraph,
    depth: number,
    lines: string[],
    visited: Set<string>
  ): void {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    const childNodes = node.children
      .map((id) => allNodes.find((n) => n.id === id))
      .filter((n): n is GraphNode => n !== undefined)
      .sort((a, b) => b.weight - a.weight);

    for (const child of childNodes) {
      if (depth <= 4) {
        const prefix = '#'.repeat(depth);
        lines.push(
          `${prefix} [[${child.label}]]`
        );
      } else {
        lines.push(`- [[${child.label}]]`);
      }

      // Add detail children as bullet points
      const details = child.children
        .map((id) => allNodes.find((n) => n.id === id))
        .filter(
          (n): n is GraphNode =>
            n !== undefined && n.type === 'detail'
        );

      for (const detail of details) {
        if (!visited.has(detail.id)) {
          visited.add(detail.id);
          lines.push(`  - ${detail.label}`);
        }
      }

      lines.push('');

      // Recurse for non-detail children
      this.renderNodeTree(
        child,
        allNodes,
        graph,
        depth + 1,
        lines,
        visited
      );
    }
  }
}
