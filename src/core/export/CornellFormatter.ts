import type { ConversationMessage, GraphNode } from '../types';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';

export class CornellFormatter {
  /**
   * Cornell Note format - SUMMARY version, not full listing.
   * - Cues: core questions the user asked (max 8)
   * - Notes: one key takeaway per question (max 8)
   * - Summary: synthesized overview connecting concepts
   */
  format(
    messages: ConversationMessage[],
    graph: KnowledgeGraph
  ): string {
    const lines: string[] = [];

    lines.push('## \u5eb7\u5948\u5c14\u7b14\u8bb0 / Cornell Notes');
    lines.push('');

    // === Cues: core questions only ===
    lines.push('### \u7ebf\u7d22\u680f (Cues)');
    const cues = this.extractCues(messages);
    cues.forEach((cue, i) => {
      lines.push(`${i + 1}. ${cue}`);
    });
    lines.push('');

    // === Notes: one key insight per question ===
    lines.push('### \u7b14\u8bb0 (Notes)');
    const notes = this.extractKeyInsights(messages);
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');

    // === Summary ===
    lines.push('### \u603b\u7ed3 (Summary)');
    const summary = this.generateSummary(messages, graph);
    lines.push(summary);
    lines.push('');

    return lines.join('\n');
  }

  /** Extract user questions as cues - max 8, concise */
  private extractCues(messages: ConversationMessage[]): string[] {
    const cues: string[] = [];

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      const content = msg.content.trim();
      if (content.length < 3) continue;

      // Take first sentence, clean up
      let cue = content.split(/[.!?\u3002\uff01\uff1f\n]/)[0]?.trim() ?? content;
      if (cue.length > 80) cue = cue.slice(0, 77) + '...';
      if (!cue.endsWith('?') && !cue.endsWith('\uff1f')) {
        cue = cue.replace(/[.\u3002]$/, '') + '?';
      }

      if (cue.length > 2) cues.push(cue);
      if (cues.length >= 8) break;
    }

    return cues;
  }

  /**
   * Extract ONE key insight per Q&A pair.
   * For each user question, take the first sentence of the assistant's answer.
   */
  private extractKeyInsights(messages: ConversationMessage[]): string[] {
    const insights: string[] = [];

    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role !== 'user') continue;
      // Find the next assistant message
      const assistant = messages[i + 1];
      if (!assistant || assistant.role !== 'assistant') continue;

      // Take the first heading if available, otherwise first sentence
      let insight: string;
      if (assistant.headings.length > 0 && assistant.boldTerms.length > 0) {
        insight = `${assistant.headings[0]}: ${assistant.boldTerms[0]}`;
      } else if (assistant.headings.length > 0) {
        insight = assistant.headings[0];
      } else {
        const firstSentence = assistant.content.split(/[.!?\u3002\uff01\uff1f]/)[0]?.trim();
        insight = firstSentence ?? assistant.content.slice(0, 80);
      }

      if (insight.length > 100) insight = insight.slice(0, 97) + '...';
      insights.push(insight);
      if (insights.length >= 8) break;
    }

    return insights;
  }

  /** Generate a connecting summary from the graph's top nodes */
  private generateSummary(
    messages: ConversationMessage[],
    graph: KnowledgeGraph
  ): string {
    const topNodes = graph.getTopNodes(8);
    const rootNode = graph.getNodes().find(n => n.id === graph.getRootId());

    if (topNodes.length === 0) {
      return '(Summary will be generated as the conversation progresses...)';
    }

    const rootLabel = rootNode?.label ?? 'this topic';
    const concepts = topNodes
      .filter(n => n.type !== 'root' && n.metadata.sourceRole !== 'user')
      .slice(0, 5)
      .map(n => n.label);

    const userQuestions = messages.filter(m => m.role === 'user').length;

    const parts: string[] = [];
    parts.push(`This conversation explored **${rootLabel}**`);
    if (concepts.length > 0) {
      parts.push(`, covering: ${concepts.join(', ')}`);
    }
    parts.push(`. Through ${userQuestions} questions, key concepts were connected and explained in context.`);

    return parts.join('');
  }
}
