import { useMemo } from 'react';
import { useMindFlowStore } from '../../state/store';
import { CornellFormatter } from '../../core/export/CornellFormatter';

export function CornellNotePanel() {
  const { messages, graph } = useMindFlowStore();

  const cornellContent = useMemo(() => {
    const formatter = new CornellFormatter();
    return formatter.format(messages, graph);
  }, [messages, graph]);

  // Parse the cornell markdown into sections
  const sections = useMemo(() => {
    const lines = cornellContent.split('\n');
    const cues: string[] = [];
    const notes: string[] = [];
    let summary = '';
    let currentSection = '';

    for (const line of lines) {
      if (line.includes('\u7ebf\u7d22\u680f') || line.includes('Cues')) {
        currentSection = 'cues';
        continue;
      }
      if (line.includes('\u7b14\u8bb0') || line.includes('Notes')) {
        currentSection = 'notes';
        continue;
      }
      if (line.includes('\u603b\u7ed3') || line.includes('Summary')) {
        currentSection = 'summary';
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('##')) continue;

      if (currentSection === 'cues' && trimmed) {
        cues.push(trimmed.replace(/^\d+\.\s*/, ''));
      } else if (currentSection === 'notes' && trimmed) {
        notes.push(trimmed.replace(/^-\s*/, ''));
      } else if (currentSection === 'summary' && trimmed) {
        summary += (summary ? ' ' : '') + trimmed;
      }
    }

    return { cues, notes, summary };
  }, [cornellContent]);

  if (messages.length === 0) {
    return (
      <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
        Start a conversation to generate Cornell notes...
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', fontSize: '14px', lineHeight: '1.6' }}>
      {/* Cues Section */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#f0f7ff',
          borderRadius: '8px',
          borderLeft: '4px solid #3b82f6',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
          {'\u7ebf\u7d22\u680f'} / Cues
        </h3>
        {sections.cues.length > 0 ? (
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            {sections.cues.map((cue, i) => (
              <li key={i} style={{ marginBottom: '4px', color: '#374151' }}>
                {cue}
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ margin: 0, color: '#9ca3af' }}>No questions yet</p>
        )}
      </div>

      {/* Notes Section */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#f0fdf4',
          borderRadius: '8px',
          borderLeft: '4px solid #22c55e',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#166534' }}>
          {'\u7b14\u8bb0'} / Notes
        </h3>
        {sections.notes.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {sections.notes.map((note, i) => (
              <li key={i} style={{ marginBottom: '4px', color: '#374151' }}>
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: '#9ca3af' }}>No notes yet</p>
        )}
      </div>

      {/* Summary Section */}
      <div
        style={{
          padding: '12px',
          background: '#fefce8',
          borderRadius: '8px',
          borderLeft: '4px solid #eab308',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#854d0e' }}>
          {'\u603b\u7ed3'} / Summary
        </h3>
        <p style={{ margin: 0, color: '#374151' }}>
          {sections.summary || 'Summary will be generated as the conversation progresses...'}
        </p>
      </div>
    </div>
  );
}
