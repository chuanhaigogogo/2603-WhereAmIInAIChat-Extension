import type { GraphEdge, RelationType } from '../types';

export function createGraphEdge(
  source: string,
  target: string,
  type: RelationType,
  weight: number = 1
): GraphEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type,
    weight,
  };
}
