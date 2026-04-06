import { useMindFlowStore } from '../../state/store';
import { ExportButton } from './ExportButton';
import type { LayoutMode } from '../../core/types';

interface ToolbarProps {
  layout: LayoutMode;
  onToggleLayout: () => void;
  showMap: boolean;
  showNotes: boolean;
  onToggleMap: () => void;
  onToggleNotes: () => void;
}

export function Toolbar({ layout, onToggleLayout, showMap, showNotes, onToggleMap, onToggleNotes }: ToolbarProps) {
  const { toggleSidebar, messages, generating, generateMindMap, markdownTree } =
    useMindFlowStore();

  const hasContent = markdownTree.length > 0;
  const bothVisible = showMap && showNotes;

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
            MindFlow
          </span>
          {messages.length > 0 && (
            <span style={{
              fontSize: '9px', background: '#f0f4ff', color: '#6b8aed',
              padding: '1px 5px', borderRadius: '6px', fontWeight: 500,
            }}>
              {messages.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {generating && (
            <span style={{
              padding: '3px 8px', fontSize: '10px', fontWeight: 600,
              background: '#f3f4f6', color: '#8b5cf6',
              borderRadius: '4px', lineHeight: '1.4',
            }}>
              Generating...
            </span>
          )}
          {hasContent && <ExportButton />}
          {/* Layout toggle (only when both panels open) */}
          {bothVisible && (
            <button
              onClick={onToggleLayout}
              style={iconBtn}
              title={layout === 'vertical' ? 'Side-by-side' : 'Top-bottom'}
            >
              {layout === 'vertical' ? '\u2194' : '\u2195'}
            </button>
          )}
          {/* Reopen closed panels */}
          {!showMap && (
            <button onClick={onToggleMap} style={reopenBtn} title="Show Mind Map">
              Map
            </button>
          )}
          {!showNotes && (
            <button onClick={onToggleNotes} style={reopenBtn} title="Show Notes">
              Notes
            </button>
          )}
          {/* Open settings popup */}
          <button
            onClick={() => {
              try { chrome.runtime.openOptionsPage?.(); } catch {}
              // Fallback: open popup.html in new tab
              const url = chrome.runtime?.getURL?.('popup.html');
              if (url) window.open(url, '_blank', 'width=300,height=500');
            }}
            style={iconBtn}
            title="Settings"
          >
            {'\u2699'}
          </button>
          <button
            onClick={toggleSidebar}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#b0b0b0', padding: '2px 4px', lineHeight: 1,
            }}
            title="Close"
          >
            {'\u2715'}
          </button>
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  padding: '3px 5px', fontSize: '11px', color: '#9ca3af',
  background: 'none', border: '1px solid #e5e7eb',
  borderRadius: '4px', cursor: 'pointer', lineHeight: 1,
};

const reopenBtn: React.CSSProperties = {
  padding: '2px 6px', fontSize: '9px', fontWeight: 500,
  color: '#3b82f6', background: '#eff6ff',
  border: '1px solid #dbeafe', borderRadius: '3px',
  cursor: 'pointer', lineHeight: '1.3',
};
