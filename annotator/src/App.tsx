import { useState, useRef, useCallback, useEffect } from 'react';
import MapCanvas from './components/MapCanvas';
import { Stall, NavNode, NavEdge, Tool, VenueMap, StallType } from './types';

const STALL_TYPES: StallType[] = ['brand', 'cafe', 'lounge', 'feature', 'directory', 'service', 'entry', 'exit'];

export default function App() {
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ w: 1200, h: 800 });
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [navNodes, setNavNodes] = useState<NavNode[]>([]);
  const [navEdges, setNavEdges] = useState<NavEdge[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedStallId, setSelectedStallId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFirstId, setConnectFirstId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (canvasContainerRef.current)
        setContainerWidth(canvasContainerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Image upload ─────────────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setImageEl(img);
      setImageSize({ w: img.width, h: img.height });
    };
    img.src = url;
  };

  // ── Stall operations ─────────────────────────────────────────────────────────

  const addStall = useCallback((s: Stall) => setStalls(prev => [...prev, s]), []);
  const updateStall = useCallback((id: string, patch: Partial<Stall>) =>
    setStalls(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s)), []);
  const deleteStall = (id: string) => {
    setStalls(prev => prev.filter(s => s.id !== id));
    if (selectedStallId === id) setSelectedStallId(null);
  };

  // ── Nav node operations ──────────────────────────────────────────────────────

  const addNode = useCallback((n: NavNode) => setNavNodes(prev => [...prev, n]), []);
  const deleteNode = (id: string) => {
    setNavNodes(prev => prev.filter(n => n.id !== id));
    setNavEdges(prev => prev.filter(([a, b]) => a !== id && b !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleConnectNode = (id: string) => {
    if (!connectFirstId) {
      setConnectFirstId(id);
    } else if (connectFirstId === id) {
      setConnectFirstId(null);
    } else {
      const edge: NavEdge = [connectFirstId, id];
      const alreadyExists = navEdges.some(
        ([a, b]) => (a === edge[0] && b === edge[1]) || (a === edge[1] && b === edge[0])
      );
      if (!alreadyExists) setNavEdges(prev => [...prev, edge]);
      setConnectFirstId(null);
    }
  };

  // ── JSON import / export ─────────────────────────────────────────────────────

  const exportJSON = () => {
    const data: VenueMap = {
      refWidth: imageSize.w,
      refHeight: imageSize.h,
      stalls,
      navNodes,
      navEdges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'venue-map.json';
    a.click();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data: VenueMap = JSON.parse(ev.target?.result as string);
        if (data.stalls) setStalls(data.stalls);
        if (data.navNodes) setNavNodes(data.navNodes);
        if (data.navEdges) setNavEdges(data.navEdges);
        if (data.refWidth && data.refHeight)
          setImageSize({ w: data.refWidth, h: data.refHeight });
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (confirm('Clear all stalls and nodes?')) {
      setStalls([]); setNavNodes([]); setNavEdges([]);
      setSelectedStallId(null); setSelectedNodeId(null);
    }
  };

  // ── Selected item ────────────────────────────────────────────────────────────

  const selectedStall = stalls.find(s => s.id === selectedStallId) ?? null;
  const selectedNode = navNodes.find(n => n.id === selectedNodeId) ?? null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedStallId) deleteStall(selectedStallId);
      else if (selectedNodeId) deleteNode(selectedNodeId);
    }
    if (e.key === 'Escape') {
      setTool('select');
      setConnectFirstId(null);
    }
    if (e.key === 'v') setTool('select');
    if (e.key === 'r') setTool('draw');
    if (e.key === 'n') setTool('node');
    if (e.key === 'c') setTool('connect');
  };

  return (
    <div className="app" onKeyDown={handleKeyDown} tabIndex={0}>

      {/* ── Top toolbar ── */}
      <div className="toolbar">
        <span className="app-title">Venue Annotator</span>

        <div className="tool-group">
          {([
            ['select', '↖ Select', 'V'],
            ['draw',   '⬜ Draw Stall', 'R'],
            ['node',   '● Add Node', 'N'],
            ['connect','⤳ Connect', 'C'],
          ] as [Tool, string, string][]).map(([t, label, key]) => (
            <button
              key={t}
              className={`tool-btn ${tool === t ? 'active' : ''}`}
              onClick={() => { setTool(t); setConnectFirstId(null); }}
              title={`${label} (${key})`}
            >
              {label}
            </button>
          ))}
        </div>

        {tool === 'connect' && connectFirstId && (
          <span className="connect-hint">Click second node to connect · Esc to cancel</span>
        )}
        {tool === 'connect' && !connectFirstId && (
          <span className="connect-hint">Click first node</span>
        )}

        <div className="toolbar-right">
          <label className="file-btn" title="Upload floor map image">
            🖼 Image
            <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
          </label>
          <label className="file-btn" title="Import JSON">
            📂 Import
            <input type="file" accept=".json" onChange={importJSON} hidden />
          </label>
          <button className="file-btn export" onClick={exportJSON}>
            💾 Export JSON
          </button>
          <button className="file-btn danger" onClick={clearAll}>🗑 Clear</button>
        </div>
      </div>

      <div className="workspace">

        {/* ── Left: stall list ── */}
        <div className="sidebar left-sidebar">
          <div className="sidebar-header">
            Stalls <span className="count">{stalls.length}</span>
          </div>
          <div className="stall-list">
            {stalls.length === 0 && (
              <div className="empty-hint">Draw rectangles on the map to add stalls</div>
            )}
            {stalls.map(s => (
              <div
                key={s.id}
                className={`stall-item ${selectedStallId === s.id ? 'selected' : ''}`}
                onClick={() => { setSelectedStallId(s.id); setSelectedNodeId(null); }}
              >
                <span className={`type-dot type-${s.type}`} />
                <span className="stall-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-header" style={{ marginTop: 8 }}>
            Nodes <span className="count">{navNodes.length}</span>
            &nbsp;· Edges <span className="count">{navEdges.length}</span>
          </div>
          <div className="stall-list">
            {navNodes.map(n => (
              <div
                key={n.id}
                className={`stall-item ${selectedNodeId === n.id ? 'selected' : ''}`}
                onClick={() => { setSelectedNodeId(n.id); setSelectedStallId(null); }}
              >
                <span className="type-dot" style={{ background: '#f39c12' }} />
                <span className="stall-label">{n.id}</span>
                <span className="stall-coords">{n.x},{n.y}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Centre: canvas ── */}
        <div className="canvas-area" ref={canvasContainerRef}>
          {!imageEl && (
            <div className="upload-prompt">
              <p>Upload a floor map image to begin</p>
              <label className="upload-btn">
                Choose Image
                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
              </label>
            </div>
          )}
          <MapCanvas
            imageEl={imageEl}
            imageSize={imageSize}
            containerWidth={containerWidth}
            stalls={stalls}
            navNodes={navNodes}
            navEdges={navEdges}
            tool={tool}
            selectedStallId={selectedStallId}
            selectedNodeId={selectedNodeId}
            connectFirstId={connectFirstId}
            onAddStall={addStall}
            onUpdateStall={updateStall}
            onSelectStall={id => { setSelectedStallId(id); setSelectedNodeId(null); }}
            onAddNode={addNode}
            onSelectNode={id => { setSelectedNodeId(id); setSelectedStallId(null); }}
            onConnectNode={handleConnectNode}
            onSetTool={setTool}
          />
        </div>

        {/* ── Right: properties ── */}
        <div className="sidebar right-sidebar">
          <div className="sidebar-header">Properties</div>

          {selectedStall && (
            <div className="props">
              <label>Label
                <input
                  value={selectedStall.label}
                  onChange={e => updateStall(selectedStall.id, { label: e.target.value })}
                />
              </label>
              <label>ID
                <input
                  value={selectedStall.id}
                  onChange={e => updateStall(selectedStall.id, { id: e.target.value })}
                />
              </label>
              <label>Type
                <select
                  value={selectedStall.type}
                  onChange={e => updateStall(selectedStall.id, { type: e.target.value as StallType })}
                >
                  {STALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <div className="coord-grid">
                {(['x','y','w','h'] as (keyof Stall)[]).map(k => (
                  <label key={k}>{k}
                    <input
                      type="number"
                      value={selectedStall[k] as number}
                      onChange={e => updateStall(selectedStall.id, { [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <button className="delete-btn" onClick={() => deleteStall(selectedStall.id)}>
                🗑 Delete Stall
              </button>
            </div>
          )}

          {selectedNode && !selectedStall && (
            <div className="props">
              <label>Node ID
                <input value={selectedNode.id} readOnly />
              </label>
              <div className="coord-grid">
                <label>x <input type="number" value={selectedNode.x} readOnly /></label>
                <label>y <input type="number" value={selectedNode.y} readOnly /></label>
              </div>
              <p className="props-hint">
                Edges: {navEdges.filter(([a,b]) => a === selectedNode.id || b === selectedNode.id).length}
              </p>
              <button className="delete-btn" onClick={() => deleteNode(selectedNode.id)}>
                🗑 Delete Node
              </button>
            </div>
          )}

          {!selectedStall && !selectedNode && (
            <div className="empty-hint" style={{ padding: 12 }}>
              Click a stall or node to edit its properties.
            </div>
          )}

          <div className="sidebar-header" style={{ marginTop: 'auto' }}>Image info</div>
          <div className="props-hint" style={{ padding: '6px 12px' }}>
            {imageSize.w} × {imageSize.h} px
          </div>

          <div className="shortcuts">
            <div className="shortcuts-title">Shortcuts</div>
            <div>V — Select</div>
            <div>R — Draw stall</div>
            <div>N — Add node</div>
            <div>C — Connect nodes</div>
            <div>Del — Delete selected</div>
            <div>Esc — Cancel / Select</div>
          </div>
        </div>

      </div>
    </div>
  );
}
