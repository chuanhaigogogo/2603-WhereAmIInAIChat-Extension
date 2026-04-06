import { useState } from 'react';
import { useExport } from '../hooks/useExport';

export function ExportButton() {
  const { exportFull, exportMindMapOnly, exportNotesOnly, copyToClipboard } = useExport();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: '3px 8px', fontSize: '10px', fontWeight: 500,
          background: '#fff', color: '#6b7280',
          border: '1px solid #e5e7eb', borderRadius: '4px',
          cursor: 'pointer', lineHeight: '1.4',
        }}
      >
        Export
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '3px',
            background: '#fff', border: '1px solid #eee',
            borderRadius: '6px', boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
            minWidth: '140px', zIndex: 10, overflow: 'hidden',
          }}
        >
          <button onClick={() => { exportMindMapOnly(); setShowMenu(false); }} style={menuItem}>
            Mind Map (.md)
          </button>
          <button onClick={() => { exportNotesOnly(); setShowMenu(false); }} style={menuItem}>
            Notes (.md)
          </button>
          <button onClick={() => { exportFull(); setShowMenu(false); }} style={menuItem}>
            Full (.md)
          </button>
          <button onClick={() => { handleCopy(); setShowMenu(false); }} style={menuItem}>
            {copied ? 'Copied!' : 'Copy All'}
          </button>
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: 'block', width: '100%',
  padding: '5px 12px', fontSize: '11px',
  textAlign: 'left', background: 'none',
  border: 'none', cursor: 'pointer',
  color: '#374151', lineHeight: '1.5',
};
