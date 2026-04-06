import { useCallback } from 'react';
import { useMindFlowStore } from '../../state/store';
import { downloadMarkdown } from '../../core/export/MarkdownExporter';

export function useExport() {
  const { markdownTree, aiNotes } = useMindFlowStore();

  const getDate = () => new Date().toISOString().split('T')[0];
  const getRootName = () => {
    const firstLine = markdownTree.split('\n')[0] ?? '';
    const label = firstLine.replace(/^#+\s*/, '').trim();
    return label || 'conversation';
  };

  const exportFull = useCallback(() => {
    const parts = [`## Mind Map\n\n${markdownTree}`];
    if (aiNotes) parts.push(`## Notes\n\n${aiNotes}`);
    downloadMarkdown(parts.join('\n\n---\n\n'), `mindflow-${getRootName()}-${getDate()}.md`);
  }, [markdownTree, aiNotes]);

  const exportMindMapOnly = useCallback(() => {
    downloadMarkdown(markdownTree, `mindflow-mindmap-${getDate()}.md`);
  }, [markdownTree]);

  const exportNotesOnly = useCallback(() => {
    if (aiNotes) downloadMarkdown(aiNotes, `mindflow-notes-${getDate()}.md`);
  }, [aiNotes]);

  const copyToClipboard = useCallback(async () => {
    const parts = [`## Mind Map\n\n${markdownTree}`];
    if (aiNotes) parts.push(`## Notes\n\n${aiNotes}`);
    await navigator.clipboard.writeText(parts.join('\n\n---\n\n'));
  }, [markdownTree, aiNotes]);

  return { exportFull, exportMindMapOnly, exportNotesOnly, copyToClipboard };
}
