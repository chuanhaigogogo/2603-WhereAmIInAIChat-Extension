import { useRef, useState, useEffect } from 'react';
import { useMindFlowStore } from '../../state/store';
import { useMindMap } from '../hooks/useMindMap';

interface Props {
  onClose?: () => void;
}

export function MindMapPanel({ onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { markdownTree, generating, messages } = useMindFlowStore();
  const { zoomIn, zoomOut, fitView, panLeft, panRight, panUp, panDown, onDragStart, onDragMove, onDragEnd } = useMindMap(svgRef, markdownTree);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { onDragMove(e.clientX, e.clientY); };
    const onUp = () => { onDragEnd(); setDragging(false); };
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onDragMove, onDragEnd]);

  const header = (
    <div style={hdrStyle}>
      <span style={titleStyle}>
        MIND MAP
      </span>
      <div style={ctrlRow}>
        <button onClick={zoomOut} style={cBtn} title="Zoom out">-</button>
        <button onClick={fitView} style={{ ...cBtn, color: '#3b82f6', fontWeight: 600 }} title="Fit view">Fit</button>
        <button onClick={zoomIn} style={cBtn} title="Zoom in">+</button>
        <div style={sep} />
        <button onClick={panLeft} style={cBtn} title="Pan left">{'\u2190'}</button>
        <button onClick={panUp} style={cBtn} title="Pan up">{'\u2191'}</button>
        <button onClick={panDown} style={cBtn} title="Pan down">{'\u2193'}</button>
        <button onClick={panRight} style={cBtn} title="Pan right">{'\u2192'}</button>
        <div style={sep} />
        <button onClick={onClose} style={{ ...cBtn, color: '#c0c4cc' }} title="Close">{'\u2715'}</button>
      </div>
    </div>
  );

  if (!markdownTree && !generating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '30px 16px', color: '#b0b0b0', textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af', marginBottom: '2px' }}>
            {messages.length > 0 ? `${messages.length} messages captured` : 'Waiting for conversation...'}
          </p>
          <p style={{ fontSize: '10px', color: '#c0c4cc' }}>
            {messages.length > 0 ? 'Click "Generate" above' : 'Start chatting, then generate'}
          </p>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '30px 16px', color: '#8b5cf6', textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 500 }}>Generating...</p>
          <p style={{ fontSize: '10px', color: '#b0b0b0', marginTop: '3px' }}>{messages.length} messages</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {header}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => {
          e.preventDefault();
          onDragStart(e.clientX, e.clientY);
          setDragging(true);
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomIn();
            else zoomOut();
          }
        }}
      >
        <svg
          ref={svgRef}
          id="mindflow-map-svg"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
}

const hdrStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '3px 6px', background: '#fafbfc', borderBottom: '1px solid #f0f0f0',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: '9px', fontWeight: 600, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.5px',
};

const ctrlRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '2px',
};

const sep: React.CSSProperties = {
  width: '1px', height: '12px', background: '#e5e7eb', margin: '0 2px',
};

const cBtn: React.CSSProperties = {
  height: '18px', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  fontSize: '10px', fontWeight: 500, color: '#6b7280',
  background: 'none', border: 'none',
  cursor: 'pointer', padding: '0 4px',
  lineHeight: 1,
};
