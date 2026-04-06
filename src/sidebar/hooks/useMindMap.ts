import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

export function useMindMap(
  svgRef: React.RefObject<SVGSVGElement | null>,
  markdown: string
) {
  const markmapRef = useRef<Markmap | null>(null);
  const hiddenSvgRef = useRef<SVGSVGElement | null>(null);
  const transformer = useMemo(() => new Transformer(), []);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ ox: 0, oy: 0 }); // pan offset
  const bboxRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!svgRef.current || !markdown) return;
    const { root } = transformer.transform(markdown);

    // Create a hidden offscreen SVG for markmap to render into
    // This keeps d3-zoom isolated — it only affects the hidden SVG
    if (!hiddenSvgRef.current) {
      const hidden = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      hidden.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:2000px;height:2000px;';
      document.body.appendChild(hidden);
      hiddenSvgRef.current = hidden;
    }

    const hidden = hiddenSvgRef.current;

    if (!markmapRef.current) {
      while (hidden.firstChild) hidden.removeChild(hidden.firstChild);

      markmapRef.current = Markmap.create(
        hidden,
        { autoFit: false, duration: 0, maxWidth: 250, paddingX: 16 },
        root
      );
    } else {
      markmapRef.current.setData(root);
    }

    // Copy rendered content to the visible SVG after markmap finishes
    setTimeout(() => {
      copyToVisible(hidden, svgRef.current!, scaleRef, bboxRef, offsetRef);
    }, 200);
  }, [markdown, svgRef, transformer]);

  // Drag state exposed for MindMapPanel to bind on its container div
  const dragRef = useRef({ active: false, x0: 0, y0: 0, ox0: 0, oy0: 0 });

  const onDragStart = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { active: true, x0: clientX, y0: clientY, ox0: offsetRef.current.ox, oy0: offsetRef.current.oy };
  }, []);

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragRef.current.active || !svgRef.current) return;
    const d = dragRef.current;
    offsetRef.current.ox = d.ox0 + (clientX - d.x0);
    offsetRef.current.oy = d.oy0 + (clientY - d.y0);
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  const onDragEnd = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  useEffect(() => {
    return () => {
      markmapRef.current?.destroy();
      markmapRef.current = null;
      if (hiddenSvgRef.current) {
        hiddenSvgRef.current.remove();
        hiddenSvgRef.current = null;
      }
    };
  }, []);

  const zoomIn = useCallback(() => {
    if (!svgRef.current) return;
    scaleRef.current = Math.min(5, scaleRef.current * 1.25);
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  const zoomOut = useCallback(() => {
    if (!svgRef.current) return;
    scaleRef.current = Math.max(0.1, scaleRef.current * 0.8);
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  const fitView = useCallback(() => {
    if (!svgRef.current || !hiddenSvgRef.current) return;
    offsetRef.current = { ox: 0, oy: 0 };
    copyToVisible(hiddenSvgRef.current, svgRef.current, scaleRef, bboxRef, offsetRef);
  }, [svgRef]);

  const panLeft = useCallback(() => {
    if (!svgRef.current) return;
    offsetRef.current.ox += 40;
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  const panRight = useCallback(() => {
    if (!svgRef.current) return;
    offsetRef.current.ox -= 40;
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  const panUp = useCallback(() => {
    if (!svgRef.current) return;
    offsetRef.current.oy += 40;
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  const panDown = useCallback(() => {
    if (!svgRef.current) return;
    offsetRef.current.oy -= 40;
    applyTransform(svgRef.current, scaleRef.current, bboxRef.current, offsetRef.current);
  }, [svgRef]);

  return { markmapRef, zoomIn, zoomOut, fitView, panLeft, panRight, panUp, panDown, onDragStart, onDragMove, onDragEnd };
}

function copyToVisible(
  hidden: SVGSVGElement,
  visible: SVGSVGElement,
  scaleRef: React.MutableRefObject<number>,
  bboxRef: React.MutableRefObject<{ x: number; y: number; w: number; h: number }>,
  offsetRef: React.MutableRefObject<{ ox: number; oy: number }>
) {
  const sourceG = hidden.querySelector('g');
  if (!sourceG) return;

  // Measure content at identity
  const oldT = sourceG.getAttribute('transform') || '';
  sourceG.setAttribute('transform', 'translate(0,0) scale(1)');
  const bbox = sourceG.getBBox();
  sourceG.setAttribute('transform', oldT);

  if (bbox.width === 0 || bbox.height === 0) return;

  bboxRef.current = { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };

  // Clone the <g> into visible SVG
  while (visible.firstChild) visible.removeChild(visible.firstChild);

  // Copy defs (styles) if any
  const defs = hidden.querySelector('defs');
  if (defs) visible.appendChild(defs.cloneNode(true));

  // Copy style elements
  hidden.querySelectorAll('style').forEach(s => {
    visible.appendChild(s.cloneNode(true));
  });

  const clonedG = sourceG.cloneNode(true) as SVGGElement;
  visible.appendChild(clonedG);

  // Fit to visible SVG
  const svgR = visible.getBoundingClientRect();
  const pad = 10;
  const sx = (svgR.width - pad * 2) / bbox.width;
  const sy = (svgR.height - pad * 2) / bbox.height;
  scaleRef.current = Math.min(sx, sy, 1.5);
  offsetRef.current = { ox: 0, oy: 0 };

  applyTransform(visible, scaleRef.current, bboxRef.current, offsetRef.current);
}

function applyTransform(
  svg: SVGSVGElement,
  scale: number,
  bbox: { x: number; y: number; w: number; h: number },
  offset: { ox: number; oy: number }
) {
  const g = svg.querySelector('g');
  if (!g) return;

  const pad = 10;
  const tx = pad - bbox.x * scale + offset.ox;
  const ty = pad - bbox.y * scale + offset.oy;

  g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${scale})`);
}
