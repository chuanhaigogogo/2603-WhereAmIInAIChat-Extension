import type { GraphNode, NodeType, MessageRole } from '../types';

export function createGraphNode(
  label: string,
  type: NodeType,
  messageIndex: number,
  sourceRole: MessageRole
): GraphNode {
  return {
    id: slugify(label),
    label,
    type,
    weight: 1,
    messageIndices: [messageIndex],
    metadata: {
      firstSeen: Date.now(),
      mentionCount: 1,
      sourceRole,
    },
    children: [],
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
