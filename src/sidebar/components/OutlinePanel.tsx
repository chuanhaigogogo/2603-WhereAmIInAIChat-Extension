import { useMindFlowStore } from '../../state/store';

export function OutlinePanel() {
  const markdownTree = useMindFlowStore((s) => s.markdownTree);

  // Parse markdown tree into indented outline
  const lines = markdownTree.split('\n').filter(Boolean);

  if (lines.length <= 1) {
    return (
      <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
        Outline will appear as the conversation develops...
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', fontSize: '14px' }}>
      {lines.map((line, i) => {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        const bulletMatch = line.match(/^(\s*)-\s+(.+)/);

        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          return (
            <div
              key={i}
              style={{
                paddingLeft: `${(level - 1) * 16}px`,
                marginBottom: '4px',
                fontWeight: level <= 2 ? 600 : 400,
                fontSize: level === 1 ? '16px' : level === 2 ? '14px' : '13px',
                color: level === 1 ? '#1f2937' : level === 2 ? '#374151' : '#6b7280',
              }}
            >
              {level > 1 && (
                <span style={{ color: '#3b82f6', marginRight: '6px' }}>
                  {level === 2 ? '\u25cf' : level === 3 ? '\u25cb' : '\u00b7'}
                </span>
              )}
              {text}
            </div>
          );
        }

        if (bulletMatch) {
          const indent = bulletMatch[1].length;
          const text = bulletMatch[2];
          return (
            <div
              key={i}
              style={{
                paddingLeft: `${80 + indent * 8}px`,
                marginBottom: '2px',
                fontSize: '12px',
                color: '#9ca3af',
              }}
            >
              {'\u00b7'} {text}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
