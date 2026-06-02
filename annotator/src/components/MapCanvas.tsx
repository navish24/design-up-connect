import { useRef, useEffect, useState } from 'react';
import {
  Stage, Layer, Rect, Circle, Line, Text,
  Transformer, Image as KonvaImage,
} from 'react-konva';
import Konva from 'konva';
import { Stall, NavNode, NavEdge, Tool, StallType } from '../types';

const STALL_COLORS: Record<StallType, string> = {
  brand:     'rgba(255,255,255,0.18)',
  cafe:      'rgba(220,60,60,0.25)',
  lounge:    'rgba(220,60,60,0.25)',
  feature:   'rgba(220,60,60,0.25)',
  directory: 'rgba(80,80,220,0.25)',
  service:   'rgba(40,160,80,0.25)',
  entry:     'rgba(40,180,80,0.3)',
  exit:      'rgba(200,60,60,0.3)',
};
const STALL_STROKE: Record<StallType, string> = {
  brand: '#ffffff', cafe: '#dc3c3c', lounge: '#dc3c3c',
  feature: '#dc3c3c', directory: '#5050dc',
  service: '#28a050', entry: '#28b450', exit: '#c83c3c',
};

interface Props {
  imageEl: HTMLImageElement | null;
  imageSize: { w: number; h: number };
  containerWidth: number;
  stalls: Stall[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
  tool: Tool;
  selectedStallId: string | null;
  selectedNodeId: string | null;
  connectFirstId: string | null;
  onAddStall: (s: Stall) => void;
  onUpdateStall: (id: string, patch: Partial<Stall>) => void;
  onSelectStall: (id: string | null) => void;
  onAddNode: (n: NavNode) => void;
  onSelectNode: (id: string | null) => void;
  onConnectNode: (id: string) => void;
  onSetTool: (t: Tool) => void;
}

let stallSeq = 1;
let nodeSeq = 1;

export default function MapCanvas({
  imageEl, imageSize, containerWidth,
  stalls, navNodes, navEdges,
  tool, selectedStallId, selectedNodeId, connectFirstId,
  onAddStall, onUpdateStall, onSelectStall,
  onAddNode, onSelectNode, onConnectNode, onSetTool,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, Konva.Rect>>(new Map());

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const stageScale = imageSize.w > 0 ? containerWidth / imageSize.w : 1;
  const stageHeight = imageSize.h * stageScale;

  // Attach transformer to selected stall
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedStallId && tool === 'select') {
      const node = shapeRefs.current.get(selectedStallId);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedStallId, tool]);

  const getImagePos = () => stageRef.current?.getRelativePointerPosition() ?? null;

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === 'draw' && e.target === e.target.getStage()) {
      const pos = getImagePos();
      if (!pos) return;
      setDrawStart(pos);
      setDrawCurrent(pos);
      setIsDrawing(true);
    } else if (tool === 'select' && e.target === e.target.getStage()) {
      onSelectStall(null);
      onSelectNode(null);
    }
  };

  const handleStageMouseMove = () => {
    if (tool === 'draw' && isDrawing) {
      const pos = getImagePos();
      if (pos) setDrawCurrent(pos);
    }
  };

  const handleStageMouseUp = () => {
    if (tool === 'draw' && isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);
      if (w > 8 && h > 8) {
        const newStall: Stall = {
          id: `stall-${Date.now()}`,
          label: `Stall ${stallSeq++}`,
          x: Math.round(x), y: Math.round(y),
          w: Math.round(w), h: Math.round(h),
          type: 'brand',
        };
        onAddStall(newStall);
        onSelectStall(newStall.id);
        onSetTool('select');
      }
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
    }
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === 'node' && e.target === e.target.getStage()) {
      const pos = getImagePos();
      if (!pos) return;
      const newNode: NavNode = {
        id: `n${nodeSeq++}`,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
      };
      onAddNode(newNode);
    }
  };

  const handleTransformEnd = (stallId: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Rect;
    onUpdateStall(stallId, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      w: Math.round(Math.max(10, node.width() * node.scaleX())),
      h: Math.round(Math.max(10, node.height() * node.scaleY())),
    });
    node.scaleX(1);
    node.scaleY(1);
  };

  const drawPreview = isDrawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  // Build a map of nodeId → position for edge rendering
  const nodeMap = new Map(navNodes.map(n => [n.id, n]));

  const cursorStyle =
    tool === 'draw' ? 'crosshair' :
    tool === 'node' ? 'cell' :
    tool === 'connect' ? 'pointer' : 'default';

  return (
    <div style={{ cursor: cursorStyle, border: '1px solid #333', background: '#222' }}>
      <Stage
        ref={stageRef}
        width={containerWidth}
        height={stageHeight || 500}
        scaleX={stageScale}
        scaleY={stageScale}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
      >
        {/* ── Layer 1: background image ── */}
        <Layer listening={false}>
          {imageEl && (
            <KonvaImage image={imageEl} width={imageSize.w} height={imageSize.h} />
          )}
          {!imageEl && (
            <Rect width={imageSize.w || 1200} height={imageSize.h || 800} fill="#2a2a2a" />
          )}
        </Layer>

        {/* ── Layer 2: nav edges ── */}
        <Layer listening={false}>
          {navEdges.map(([a, b], i) => {
            const na = nodeMap.get(a);
            const nb = nodeMap.get(b);
            if (!na || !nb) return null;
            return (
              <Line
                key={i}
                points={[na.x, na.y, nb.x, nb.y]}
                stroke="#f39c12"
                strokeWidth={3}
                opacity={0.7}
              />
            );
          })}
        </Layer>

        {/* ── Layer 3: stalls ── */}
        <Layer>
          {stalls.map(stall => {
            const isSelected = selectedStallId === stall.id;
            return (
              <React.Fragment key={stall.id}>
                <Rect
                  ref={node => {
                    if (node) shapeRefs.current.set(stall.id, node);
                    else shapeRefs.current.delete(stall.id);
                  }}
                  x={stall.x} y={stall.y}
                  width={stall.w} height={stall.h}
                  fill={STALL_COLORS[stall.type]}
                  stroke={isSelected ? '#fff' : STALL_STROKE[stall.type]}
                  strokeWidth={isSelected ? 3 : 1.5}
                  draggable={tool === 'select'}
                  onClick={() => {
                    if (tool === 'select') { onSelectStall(stall.id); onSelectNode(null); }
                  }}
                  onDragEnd={e => {
                    onUpdateStall(stall.id, {
                      x: Math.round(e.target.x()),
                      y: Math.round(e.target.y()),
                    });
                  }}
                  onTransformEnd={e => handleTransformEnd(stall.id, e)}
                />
                <Text
                  x={stall.x + 4} y={stall.y + 4}
                  width={stall.w - 8}
                  text={stall.label}
                  fontSize={Math.max(10, Math.min(14, stall.h / 3))}
                  fill="#fff"
                  listening={false}
                  wrap="word"
                />
              </React.Fragment>
            );
          })}

          {/* Drawing preview */}
          {drawPreview && (
            <Rect
              x={drawPreview.x} y={drawPreview.y}
              width={drawPreview.w} height={drawPreview.h}
              fill="rgba(100,150,255,0.2)"
              stroke="#6496ff"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          )}

          <Transformer
            ref={trRef}
            boundBoxFunc={(_, newBox) => ({
              ...newBox,
              width: Math.max(10, newBox.width),
              height: Math.max(10, newBox.height),
            })}
          />
        </Layer>

        {/* ── Layer 4: nav nodes ── */}
        <Layer>
          {navNodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isFirst = connectFirstId === node.id;
            return (
              <Circle
                key={node.id}
                x={node.x} y={node.y}
                radius={isSelected || isFirst ? 10 : 7}
                fill={isFirst ? '#e74c3c' : isSelected ? '#f39c12' : '#f39c12'}
                stroke="#fff"
                strokeWidth={2}
                draggable
                onClick={() => {
                  if (tool === 'connect') onConnectNode(node.id);
                  else if (tool === 'select') { onSelectNode(node.id); onSelectStall(null); }
                }}
                onDragEnd={e => {
                  // Update node position (nodes are in context of App state)
                  // Expose via a prop callback if needed
                  void e;
                }}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

// React import needed for Fragment
import React from 'react';
