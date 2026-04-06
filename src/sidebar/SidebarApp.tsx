import { useState, useCallback, useRef, useEffect } from 'react';
import { useMindFlowStore } from '../state/store';
import { Toolbar } from './components/Toolbar';
import { MindMapPanel } from './components/MindMapPanel';
import { NotesPanel } from './components/NotesPanel';
import type { LayoutMode } from '../core/types';

const MIN_WIDTH = 5;
const MAX_WIDTH = Math.round(window.innerWidth * 0.8);
const DEFAULT_WIDTH = 380;
const SWITCH_THRESHOLD = 60;

export function SidebarApp() {
  const sidebarOpen = useMindFlowStore(s => s.sidebarOpen);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [layout, setLayout] = useState<LayoutMode>('vertical');
  const [splitRatio, setSplitRatio] = useState(0.55);
  const [showMap, setShowMap] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [notesFontSize, setNotesFontSize] = useState(15);

  // --- Sidebar edge drag ---
  const edgeDragging = useRef(false);
  const edgeStartX = useRef(0);
  const edgeStartW = useRef(0);

  const onEdgeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    edgeDragging.current = true;
    edgeStartX.current = e.clientX;
    edgeStartW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  // --- Split divider drag ---
  const splitDragging = useRef(false);
  const splitStartX = useRef(0);
  const splitStartY = useRef(0);
  const splitSwitched = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const onSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitDragging.current = true;
    splitSwitched.current = false;
    splitStartX.current = e.clientX;
    splitStartY.current = e.clientY;
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (edgeDragging.current) {
        const delta = edgeStartX.current - e.clientX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, edgeStartW.current + delta)));
      }
      if (splitDragging.current && splitContainerRef.current) {
        const dx = Math.abs(e.clientX - splitStartX.current);
        const dy = Math.abs(e.clientY - splitStartY.current);
        const cur = layoutRef.current;
        if (!splitSwitched.current) {
          if (cur === 'vertical' && dx > SWITCH_THRESHOLD && dx > dy * 1.5) {
            setLayout('horizontal'); setSplitRatio(0.5);
            splitSwitched.current = true;
            splitStartX.current = e.clientX; splitStartY.current = e.clientY;
            return;
          }
          if (cur === 'horizontal' && dy > SWITCH_THRESHOLD && dy > dx * 1.5) {
            setLayout('vertical'); setSplitRatio(0.5);
            splitSwitched.current = true;
            splitStartX.current = e.clientX; splitStartY.current = e.clientY;
            return;
          }
        }
        const rect = splitContainerRef.current.getBoundingClientRect();
        const ratio = cur === 'vertical'
          ? (e.clientY - rect.top) / rect.height
          : (e.clientX - rect.left) / rect.width;
        setSplitRatio(Math.min(0.8, Math.max(0.2, ratio)));
      }
    };
    const onMouseUp = () => {
      edgeDragging.current = false;
      splitDragging.current = false;
      splitSwitched.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (!sidebarOpen) return null;

  const isVert = layout === 'vertical';
  const bothVisible = showMap && showNotes;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0,
        width: `${width}px`, height: '100vh',
        background: '#ffffff',
        boxShadow: '-2px 0 10px rgba(0,0,0,0.06)',
        zIndex: 999999,
        display: 'flex', flexDirection: 'row',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px', color: '#1f2937', overflow: 'hidden',
      }}
    >
      {/* Sidebar edge drag */}
      <div
        onMouseDown={onEdgeDown}
        style={{ width: '8px', flexShrink: 0, cursor: 'col-resize', background: '#e5e7eb' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#bfc5cd'; }}
        onMouseLeave={(e) => { if (!edgeDragging.current) (e.currentTarget as HTMLElement).style.background = '#e5e7eb'; }}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Toolbar
          layout={layout}
          onToggleLayout={() => setLayout(isVert ? 'horizontal' : 'vertical')}
          showMap={showMap}
          showNotes={showNotes}
          onToggleMap={() => setShowMap(!showMap)}
          onToggleNotes={() => setShowNotes(!showNotes)}
        />

        {/* Panels */}
        <div
          ref={splitContainerRef}
          style={{
            flex: 1, display: 'flex', overflow: 'hidden',
            flexDirection: bothVisible ? (isVert ? 'column' : 'row') : 'column',
          }}
        >
          {/* Mind Map */}
          {showMap && (
            <div style={{
              ...(bothVisible
                ? { [isVert ? 'height' : 'width']: `${splitRatio * 100}%`, flexShrink: 0 }
                : { flex: 1 }),
              overflow: 'auto', position: 'relative',
            }}>
              <MindMapPanel onClose={() => setShowMap(false)} />
            </div>
          )}

          {/* Split divider (only when both visible) */}
          {bothVisible && (
            <div
              onMouseDown={onSplitDown}
              style={{
                [isVert ? 'height' : 'width']: '6px',
                flexShrink: 0, cursor: 'move',
                background: '#f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#d1d5db'; }}
              onMouseLeave={(e) => { if (!splitDragging.current) (e.currentTarget as HTMLElement).style.background = '#f0f0f0'; }}
            >
              <div style={{ display: 'flex', gap: '2px', flexDirection: isVert ? 'row' : 'column' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#b0b0b0' }} />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {showNotes && (
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0, minWidth: 0, position: 'relative' }}>
              <PanelHeader label="Notes" onClose={() => setShowNotes(false)} />
              <NotesPanel fontSize={notesFontSize}
                onFontSmaller={() => setNotesFontSize(s => Math.max(15, s - 1))}
                onFontLarger={() => setNotesFontSize(s => Math.min(20, s + 1))} />
            </div>
          )}

          {/* Nothing visible */}
          {!showMap && !showNotes && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#c0c4cc', fontSize: '11px',
            }}>
              All panels closed. Reopen from toolbar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '3px 8px', background: '#fafbfc', borderBottom: '1px solid #f0f0f0',
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      <span style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '11px', color: '#c0c4cc', padding: '1px 3px', lineHeight: 1,
      }} title={`Close ${label}`}>
        {'\u2715'}
      </button>
    </div>
  );
}
