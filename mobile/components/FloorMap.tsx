import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated, PanResponder, ActivityIndicator,
  Keyboard, Platform, Alert,
} from 'react-native';
import Svg, { Rect, Polyline, Circle, Text as SvgText, G, Line, Polygon } from 'react-native-svg';
import * as Location from 'expo-location';

import { getShowData } from '../lib/showDataService';
import { findTwoRoutes } from '../lib/dijkstra';
import walkways from '../data/venue-walkways.json';
import ZoneCard from './ZoneCard';

import type { ShowJSON, Stall, SpecialZone, ZoneType, StallType } from '../data/showTypes';
import type { Route } from '../lib/dijkstra';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAX_SCALE = 5;
const STRIP_H   = 56;   // nav strip height

type NavPhase      = 'idle' | 'choosing' | 'preview' | 'navigating';
type QuickFilter   = 'brands' | 'cafe' | 'lounge' | 'facilities';

// ─── Palette ──────────────────────────────────────────────────────────────────

const STALL_COLORS = {
  regular:    { fill: '#FFF5F0', label: '#900b09', border: '#900b09' },
  cafe:       { fill: '#900b09', label: '#FFFFFF', border: '#900b09' },
  lounge:     { fill: '#7B5EA7', label: '#FFFFFF', border: '#7B5EA7' },
  featured:   { fill: '#900b09', label: '#FFFFFF', border: '#900b09' },
  entry_exit: { fill: '#2D7D46', label: '#FFFFFF', border: '#2D7D46' },
};

function stallColorKey(stall: Stall): keyof typeof STALL_COLORS {
  if (stall.category === 'Cafe')   return 'cafe';
  if (stall.category === 'Lounge') return 'lounge';
  if (stall.category === 'Featured') return 'featured';
  if (stall.stallType === 'entry' || stall.stallType === 'exit') return 'entry_exit';
  return 'regular';
}
const ZONE_COLORS: Record<ZoneType, string> = {
  cafe: '#e67e22', lounge: '#8e44ad', curated: '#c0392b',
  directory: '#4a4aaa', 'pro-directory': '#2c3e50', washroom: '#4a4aaa',
};
const ROUTE_A = '#1565C0';
const ROUTE_B = '#d35400';

// Wall rects extracted from venue-map.svg (canvas 2285×2958).
// Rendered directly in the SVG canvas, replacing the PNG background.
const VENUE_WALLS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 1949, y: 8,    w: 134, h: 2923 }, { x: 1340, y: 8,    w: 168, h: 2665 },
  { x: 734,  y: 396,  w: 115, h: 2277 }, { x: 902,  y: 2252, w: 455, h: 73   },
  { x: 902,  y: 2549, w: 455, h: 124  }, { x: 1298, y: 2325, w: 59,  h: 224  },
  { x: 902,  y: 2325, w: 38,  h: 224  }, { x: 902,  y: 1685, w: 455, h: 121  },
  { x: 842,  y: 1015, w: 515, h: 129  }, { x: 826,  y: 151,  w: 76,  h: 864  },
  { x: 902,  y: 662,  w: 455, h: 114  }, { x: 902,  y: 151,  w: 455, h: 71   },
  { x: 1495, y: 345,  w: 464, h: 130  }, { x: 1495, y: 760,  w: 473, h: 131  },
  { x: 1495, y: 1743, w: 473, h: 126  }, { x: 1495, y: 2153, w: 473, h: 129  },
  { x: 1495, y: 2558, w: 473, h: 51   }, { x: 1506, y: 2840, w: 453, h: 91   },
  { x: 205,  y: 479,  w: 89,  h: 284  }, { x: 205,  y: 887,  w: 94,  h: 284  },
  { x: 205,  y: 1297, w: 89,  h: 433  }, { x: 205,  y: 1860, w: 89,  h: 284  },
  { x: 1495, y: 1171, w: 473, h: 126  }, { x: 1495, y: 8,    w: 473, h: 50   },
  { x: 205,  y: 1730, w: 529, h: 134  }, { x: 383,  y: 2549, w: 351, h: 134  },
  { x: 383,  y: 2683, w: 265, h: 134  }, { x: 205,  y: 2136, w: 540, h: 134  },
  { x: 205,  y: 1163, w: 554, h: 134  }, { x: 205,  y: 763,  w: 540, h: 128  },
  { x: 205,  y: 396,  w: 529, h: 83   }, { x: 4,    y: 2427, w: 287, h: 161  },
  { x: 205,  y: 2270, w: 86,  h: 195  }, { x: 835,  y: 1685, w: 67,  h: 988  },
  { x: 4,    y: 2821, w: 1125,h: 66   }, { x: 4,    y: 2582, w: 23,  h: 235  },
  { x: 4,    y: 396,  w: 212, h: 83   }, { x: 826,  y: 8,    w: 531, h: 143  },
  { x: 2042, y: 394,  w: 236, h: 189  }, { x: 291,  y: 2549, w: 103, h: 39   },
  { x: 2037, y: 2307, w: 230, h: 624  },
];

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function abbrev(name: string, maxChars: number) {
  if (name.length <= maxChars) return name;
  return name.slice(0, Math.max(2, maxChars - 1)) + '…';
}

// Returns lines + fontSize for a stall label.
// Tries decreasing font sizes (10→4) and up to 4 lines to show the full name
// before falling back to abbreviation.
function computeLabel(
  name: string, sW: number, sH: number,
): { lines: string[]; fontSize: number } {
  const CHAR_W = 0.62; // bold (fontWeight=700) glyphs are wider than normal
  const PAD    = 0.78; // ~11% margin each side keeps text clear of stall edges
  const MAX_FS = 10;
  const MIN_FS = 4;   // allows long names to fit in 3–4 lines at small size

  const cpl = (fs: number) => Math.max(2, Math.floor(sW * PAD / (fs * CHAR_W)));

  if (sH < MIN_FS * 1.4 || sW < MIN_FS * 2) return { lines: [], fontSize: 0 };

  const words = name.split(' ');

  // 1. Single line
  for (let fs = MAX_FS; fs >= MIN_FS; fs--) {
    if (sH < fs * 1.4) continue;
    if (name.length <= cpl(fs)) return { lines: [name], fontSize: fs };
  }

  // 2. Two lines
  if (words.length >= 2) {
    for (let fs = MAX_FS; fs >= MIN_FS; fs--) {
      if (sH < fs * 3.0) continue;
      const chars = cpl(fs);
      // At min font size, allow text to reach the stall edge (drop padding margin).
      const limit = fs === MIN_FS ? Math.max(chars, Math.floor(sW / (fs * CHAR_W))) : chars;
      let bestSplit = 1, bestMax = Infinity;
      for (let i = 1; i < words.length; i++) {
        const m = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
        if (m < bestMax) { bestMax = m; bestSplit = i; }
      }
      if (bestMax <= limit) {
        return {
          lines: [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')],
          fontSize: fs,
        };
      }
    }
  }

  // 3. Three lines
  if (words.length >= 3) {
    for (let fs = MAX_FS; fs >= MIN_FS; fs--) {
      if (sH < fs * 4.2) continue;
      const chars = cpl(fs);
      let bestLines: string[] = [];
      let bestMax = Infinity;
      for (let i = 1; i < words.length - 1; i++) {
        for (let j = i + 1; j < words.length; j++) {
          const a = words.slice(0, i).join(' ');
          const b = words.slice(i, j).join(' ');
          const c = words.slice(j).join(' ');
          const m = Math.max(a.length, b.length, c.length);
          if (m < bestMax) { bestMax = m; bestLines = [a, b, c]; }
        }
      }
      if (bestMax <= chars) return { lines: bestLines, fontSize: fs };
    }
  }

  // 4. Four lines (handles 5-word names that don't fit in 3 lines at MIN_FS)
  if (words.length >= 4) {
    for (let fs = MAX_FS; fs >= MIN_FS; fs--) {
      if (sH < fs * 5.5) continue;
      const chars = cpl(fs);
      let bestLines: string[] = [];
      let bestMax = Infinity;
      for (let i = 1; i < words.length - 2; i++) {
        for (let j = i + 1; j < words.length - 1; j++) {
          for (let k = j + 1; k < words.length; k++) {
            const a = words.slice(0, i).join(' ');
            const b = words.slice(i, j).join(' ');
            const c = words.slice(j, k).join(' ');
            const d = words.slice(k).join(' ');
            const m = Math.max(a.length, b.length, c.length, d.length);
            if (m < bestMax) { bestMax = m; bestLines = [a, b, c, d]; }
          }
        }
      }
      if (bestMax <= chars) return { lines: bestLines, fontSize: fs };
    }
  }

  // 5. Abbreviate at minimum font size
  const chars = cpl(MIN_FS);
  if (words.length >= 2 && sH >= MIN_FS * 3.0) {
    let bestSplit = 1, bestMax = Infinity;
    for (let i = 1; i < words.length; i++) {
      const m = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
      if (m < bestMax) { bestMax = m; bestSplit = i; }
    }
    return {
      lines: [abbrev(words.slice(0, bestSplit).join(' '), chars), abbrev(words.slice(bestSplit).join(' '), chars)],
      fontSize: MIN_FS,
    };
  }
  return { lines: [abbrev(name, chars)], fontSize: MIN_FS };
}
function ArrowHead({ tipX, tipY, prevX, prevY, color, size = 14 }: {
  tipX: number; tipY: number; prevX: number; prevY: number; color: string; size?: number;
}) {
  const angle = Math.atan2(tipY - prevY, tipX - prevX);
  const wing  = 0.5;
  const pts   = [
    `${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    `${(tipX - size * Math.cos(angle - wing)).toFixed(1)},${(tipY - size * Math.sin(angle - wing)).toFixed(1)}`,
    `${(tipX - size * Math.cos(angle + wing)).toFixed(1)},${(tipY - size * Math.sin(angle + wing)).toFixed(1)}`,
  ].join(' ');
  return <Polygon points={pts} fill={color} />;
}
function fmtDist(dist: number) {
  const m = Math.round(dist * 0.065);
  return `~${m}m`;
}
function walkTime(dist: number) {
  const secs = Math.round(dist * 0.065 / 1.2);
  if (secs < 60) return '< 1 min';
  return `~${Math.ceil(secs / 60)} min`;
}

// Tiered fuzzy match: substring → all words present → all chars in sequence
function fuzzyMatch(brand: string, query: string): boolean {
  const b = brand.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (b.includes(q)) return true;
  if (q.split(/\s+/).every(w => b.includes(w))) return true;
  // All chars of query appear in brand in order (catches minor typos)
  let bi = 0;
  for (const ch of q) {
    bi = b.indexOf(ch, bi);
    if (bi === -1) return false;
    bi++;
  }
  return true;
}

// ─── MapCanvas ───────────────────────────────────────────────────────────────

interface CanvasProps {
  show: ShowJSON;
  scaleX: number; scaleY: number;
  displayW: number; displayH: number;
  pointA: Stall | null; pointB: Stall | null;
  quickFilters: Set<QuickFilter>;
  routes: [Route | null, Route | null] | null;
  selectedRoute: Route | null;
  phase: NavPhase;
  highlightZone: SpecialZone | null;
  mapRotation: number;
  onTapStall: (s: Stall) => void;
  onTapZone:  (z: SpecialZone) => void;
  onSelectRoute: (idx: 0 | 1) => void;
}

function MapCanvas({
  show, scaleX, scaleY, displayW, displayH,
  pointA, pointB, quickFilters,
  routes, selectedRoute, phase, highlightZone,
  mapRotation,
  onTapStall, onTapZone, onSelectRoute,
}: CanvasProps) {

  function isStallDimmed(s: Stall) {
    if (s.id === pointA?.id || s.id === pointB?.id) return false;
    if (s.category === 'Featured') return false;   // featured stalls always fully opaque
    if (quickFilters.size === 0) return false;
    if (quickFilters.has('brands')     && s.stallType === 'brand')    return false;
    if (quickFilters.has('facilities') && (s.stallType === 'service' || s.stallType === 'washroom')) return false;
    return true;
  }
  function isZoneDimmed(z: SpecialZone) {
    if (z.id === highlightZone?.id) return false;
    if (quickFilters.size === 0) return false;
    if (quickFilters.has('cafe')   && z.type === 'cafe')   return false;
    if (quickFilters.has('lounge') && z.type === 'lounge') return false;
    return true;
  }
  function routePts(route: Route): string {
    const pts: string[] = [];
    if (pointA) pts.push(`${(pointA.x + pointA.width / 2) * scaleX},${(pointA.y + pointA.height / 2) * scaleY}`);
    route.nodes.forEach(n => pts.push(`${n.x * scaleX},${n.y * scaleY}`));
    if (pointB) pts.push(`${(pointB.x + pointB.width / 2) * scaleX},${(pointB.y + pointB.height / 2) * scaleY}`);
    return pts.join(' ');
  }

  const routesToDraw: { route: Route; color: string; idx: 0 | 1 }[] = [];
  if ((phase === 'navigating' || phase === 'preview') && selectedRoute) {
    routesToDraw.push({ route: selectedRoute, color: ROUTE_A, idx: 0 });
  } else if (phase === 'choosing' && routes) {
    if (routes[0]) routesToDraw.push({ route: routes[0], color: ROUTE_A, idx: 0 });
    if (routes[1]) routesToDraw.push({ route: routes[1], color: ROUTE_B, idx: 1 });
  }

  const rotTransform = `rotate(${-mapRotation}, ${(displayW / 2).toFixed(1)}, ${(displayH / 2).toFixed(1)})`;

  return (
    <>
      <Svg width={displayW} height={displayH} style={{ position: 'absolute', top: 0, left: 0 }}>

        {/* Static background — stays unrotated so no white gap appears */}
        <Rect x={0} y={0} width={displayW} height={displayH} fill="#F5F5F5" />

        {/* Rotatable map layer — all map content rotates together */}
        <G transform={rotTransform}>

          {/* ── Venue walls ── */}
          {VENUE_WALLS.map((r, i) => (
            <Rect key={`wall-${i}`}
              x={r.x * scaleX} y={r.y * scaleY}
              width={r.w * scaleX} height={r.h * scaleY}
              fill="#522504" />
          ))}

          {/* ── Walkway corridors ── */}
          {walkways.edges.map((edge, i) => {
            const from = walkways.nodes.find(n => n.id === edge.from);
            const to   = walkways.nodes.find(n => n.id === edge.to);
            if (!from || !to) return null;
            return (
              <Line key={`corridor-${i}`}
                x1={from.x * scaleX} y1={from.y * scaleY}
                x2={to.x   * scaleX} y2={to.y   * scaleY}
                stroke="#522504" strokeWidth={28} strokeLinecap="round"
                opacity={0.15} />
            );
          })}

          {/* ── Routes ── */}
          {routesToDraw.map(({ route, color, idx }) => {
            const pts = routePts(route);
            return (
              <React.Fragment key={`route-${idx}`}>
                {phase === 'choosing' && (
                  <Polyline points={pts} stroke="transparent" strokeWidth={22} fill="none"
                    onPress={() => onSelectRoute(idx)} />
                )}
                <Polyline points={pts} stroke={color}
                  strokeWidth={6}
                  strokeDasharray={idx === 0 && phase === 'navigating' ? '14,9' : undefined}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </React.Fragment>
            );
          })}

          {/* Route arrowheads at destination */}
          {routesToDraw.map(({ route, color, idx }) => {
            if (route.nodes.length < 2) return null;
            const lastNode = route.nodes[route.nodes.length - 1];
            const prevNode = route.nodes[route.nodes.length - 2];
            const tipX = pointB ? (pointB.x + pointB.width  / 2) * scaleX : lastNode.x * scaleX;
            const tipY = pointB ? (pointB.y + pointB.height / 2) * scaleY : lastNode.y * scaleY;
            return (
              <ArrowHead key={`arrowhead-${idx}`}
                tipX={tipX} tipY={tipY}
                prevX={prevNode.x * scaleX} prevY={prevNode.y * scaleY}
                color={color} size={15} />
            );
          })}

          {/* Route badges (choosing only) */}
          {phase === 'choosing' && routesToDraw.map(({ route, color, idx }) => {
            const mid = route.nodes[Math.floor(route.nodes.length / 2)];
            if (!mid) return null;
            return (
              <React.Fragment key={`badge-${idx}`}>
                <Circle cx={mid.x * scaleX} cy={mid.y * scaleY} r={13} fill={color}
                  onPress={() => onSelectRoute(idx)} />
                <SvgText x={mid.x * scaleX} y={mid.y * scaleY + 5}
                  textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold"
                  onPress={() => onSelectRoute(idx)}>{idx + 1}</SvgText>
              </React.Fragment>
            );
          })}

          {/* Special zones */}
          {show.specialZones.map(z => {
            const dimmed   = isZoneDimmed(z);
            const zx = z.x * scaleX, zy = z.y * scaleY;
            const zw = z.width * scaleX, zh = z.height * scaleY;
            const col      = ZONE_COLORS[z.type] ?? '#888';
            const fOpacity = dimmed ? 0.12 : 0.55;
            const maxChars = Math.max(4, Math.floor(z.width / 12));
            const label    = abbrev(z.name, maxChars);
            const fontSize = clamp(Math.min(zw / label.length * 0.8, zh * 0.3), 6, 11);
            return (
              <G key={z.id} onPress={() => onTapZone(z)}>
                <Rect x={zx} y={zy} width={zw} height={zh} rx={3 * scaleX}
                  fill={col} fillOpacity={fOpacity} stroke={col} strokeWidth={1.2} />
                {fontSize >= 6 && label.length * fontSize * 0.65 <= zw * 0.85 && (
                  <SvgText x={zx + zw / 2} y={zy + zh / 2 + fontSize * 0.35}
                    textAnchor="middle" fill="#fff" fontSize={fontSize} fontWeight="700">
                    {label}
                  </SvgText>
                )}
              </G>
            );
          })}

          {/* Stall rects — pass 1 */}
          {show.stalls.map(s => {
            const isA    = s.id === pointA?.id;
            const isB    = s.id === pointB?.id;
            const dimmed = isStallDimmed(s);
            const colors = STALL_COLORS[stallColorKey(s)];
            const fill   = isA ? ROUTE_A : isB ? '#27ae60' : colors.fill;
            const sx = s.x * scaleX, sy = s.y * scaleY;
            const sW = s.width * scaleX, sH = s.height * scaleY;
            return (
              <Rect key={`rect-${s.id}`}
                x={sx} y={sy} width={sW} height={sH} rx={2 * scaleX}
                fill={fill} opacity={dimmed ? 0.15 : 1}
                stroke={isA || isB ? fill : colors.border} strokeWidth={isA || isB ? 2 : 0.8}
                onPress={() => onTapStall(s)} />
            );
          })}

          {/* Stall labels — pass 2 */}
          {show.stalls.map(s => {
            if (!s.brandName) return null;   // stalls with no name (pathway-area boxes) show no label
            const isA    = s.id === pointA?.id;
            const isB    = s.id === pointB?.id;
            const dimmed = isStallDimmed(s);
            if (dimmed && !isA && !isB) return null;
            const colors    = STALL_COLORS[stallColorKey(s)];
            const labelFill = isA || isB ? '#FFFFFF' : colors.label;
            const sx = s.x * scaleX, sy = s.y * scaleY;
            const sW = s.width * scaleX, sH = s.height * scaleY;
            const { lines, fontSize } = computeLabel(s.brandName, sW, sH);
            if (lines.length === 0) return null;
            const lineH  = fontSize + 2;
            const totalH = lines.length * lineH - 2;
            const baseY  = sy + sH / 2 - totalH / 2 + fontSize * 0.85;
            return (
              <G key={`label-${s.id}`} pointerEvents="none">
                {lines.map((line, li) => (
                  <SvgText key={li}
                    x={sx + sW / 2} y={baseY + li * lineH}
                    textAnchor="middle" fill={labelFill}
                    fontSize={fontSize} fontWeight="700">
                    {line}
                  </SvgText>
                ))}
              </G>
            );
          })}

        </G>
      </Svg>
    </>
  );
}

// ─── StallMiniCard ────────────────────────────────────────────────────────────

function StallMiniCard({ stall, bottomInset = 0, onNavigateHere, onViewProfile, onDismiss }: {
  stall: Stall; bottomInset?: number;
  onNavigateHere: () => void; onViewProfile: () => void; onDismiss: () => void;
}) {
  const col = STALL_COLORS[stallColorKey(stall)].fill;
  return (
    <View style={[styles.bottomSheet, { paddingBottom: 32 + bottomInset }]}>
      <View style={styles.sheetHandle} />
      <View style={styles.cardHeader}>
        <View style={[styles.cardDot, { backgroundColor: col }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={2}>{stall.brandName}</Text>
          <Text style={styles.cardSub}>{stall.category}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={12}>
          <Text style={styles.cardClose}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardBtns}>
        <TouchableOpacity style={[styles.cardBtn, styles.cardBtnPrimary]} onPress={onNavigateHere} activeOpacity={0.85}>
          <Text style={styles.cardBtnPrimaryText}>Navigate Here</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cardBtn, styles.cardBtnSecondary]} onPress={onViewProfile} activeOpacity={0.85}>
          <Text style={styles.cardBtnSecondaryText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── RouteChoiceCard ──────────────────────────────────────────────────────────

function RouteChoiceCard({ routes, bottomInset = 0, onSelect }: {
  routes: [Route | null, Route | null]; bottomInset?: number;
  onSelect: (idx: 0 | 1) => void;
}) {
  const colors = [ROUTE_A, ROUTE_B];
  const labels = ['Shorter', 'Alternative'];
  return (
    <View style={[styles.bottomSheet, { paddingBottom: 32 + bottomInset }]}>
      <View style={styles.sheetHandle} />
      <Text style={styles.routeHint}>Tap a route on the map or choose below</Text>
      <View style={styles.routeRow}>
        {routes.map((r, i) => r && (
          <TouchableOpacity key={i} style={[styles.routeOpt, { borderColor: colors[i] }]}
            onPress={() => onSelect(i as 0 | 1)} activeOpacity={0.8}>
            <View style={[styles.routeBadge, { backgroundColor: colors[i] }]}>
              <Text style={styles.routeBadgeTxt}>{i + 1}</Text>
            </View>
            <Text style={[styles.routeDist, { color: colors[i] }]}>{fmtDist(r.totalDist)}</Text>
            <Text style={styles.routeLbl}>{labels[i]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── RoutePreviewCard ─────────────────────────────────────────────────────────

function RoutePreviewCard({ route, from, to, bottomInset = 0, onStart, onDismiss }: {
  route: Route; from: Stall; to: Stall; bottomInset?: number;
  onStart: () => void; onDismiss: () => void;
}) {
  return (
    <View style={[styles.previewCard, { paddingBottom: 20 + bottomInset }]}>
      <View style={styles.sheetHandle} />
      <View style={styles.previewRouteRow}>
        <View style={[styles.previewDot, { backgroundColor: ROUTE_A }]} />
        <Text style={styles.previewRouteLabel} numberOfLines={1}>{from.brandName}</Text>
        <Text style={styles.previewArrow}>→</Text>
        <View style={[styles.previewDot, { backgroundColor: '#27ae60' }]} />
        <Text style={styles.previewRouteLabel} numberOfLines={1}>{to.brandName}</Text>
      </View>
      <View style={styles.previewMeta}>
        <Text style={styles.previewMetaTxt}>{route.instructions.length} steps</Text>
        <Text style={styles.previewMetaDot}>·</Text>
        <Text style={styles.previewMetaTxt}>{walkTime(route.totalDist)}</Text>
        <Text style={styles.previewMetaDot}>·</Text>
        <Text style={styles.previewMetaTxt}>{fmtDist(route.totalDist)}</Text>
      </View>
      <TouchableOpacity style={styles.startNavBtn} onPress={onStart} activeOpacity={0.87}>
        <Text style={styles.startNavBtnTxt}>Start Navigation</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── NavStrip ─────────────────────────────────────────────────────────────────

function NavStrip({ route, bottomInset = 0, onExpand, onEnd }: {
  route: Route; bottomInset?: number;
  onExpand: () => void; onEnd: () => void;
}) {
  const firstInstr = route.instructions[0] ?? 'Follow the route';
  const steps      = route.instructions.length;
  return (
    <TouchableOpacity
      style={[styles.navStrip, { paddingBottom: 8 + bottomInset, height: STRIP_H + bottomInset }]}
      onPress={onExpand}
      activeOpacity={0.93}
    >
      <Text style={styles.navStripArrow}>→</Text>
      <Text style={styles.navStripInstr} numberOfLines={1}>{firstInstr}</Text>
      <Text style={styles.navStripSteps}>{steps} steps</Text>
      <TouchableOpacity style={styles.navStripEnd} onPress={onEnd} hitSlop={14}>
        <Text style={styles.navStripEndTxt}>✕ End</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string; dotColor: string; stall: Stall | null;
  search: string; placeholder: string;
  onChangeText: (t: string) => void; onClear: () => void; onFocus: () => void;
}
function FieldRow({ label, dotColor, stall, search, placeholder, onChangeText, onClear, onFocus }: FieldProps) {
  return (
    <View style={styles.fieldRow}>
      <View style={[styles.fieldDot, { backgroundColor: dotColor }]} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {stall ? (
          <View style={styles.chip}>
            <Text style={[styles.chipText, { color: dotColor }]} numberOfLines={1}>{stall.brandName}</Text>
            <TouchableOpacity onPress={onClear} hitSlop={10}>
              <Text style={styles.chipClear}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput style={styles.fieldInput} value={search} onChangeText={onChangeText}
            placeholder={placeholder} placeholderTextColor="#bbb"
            onFocus={onFocus} returnKeyType="search" autoCorrect={false} />
        )}
      </View>
    </View>
  );
}

// ─── FloorMap ─────────────────────────────────────────────────────────────────

interface FloorMapProps {
  bottomInset?: number;
  initialZoneId?: string | null;
  onViewEvents?: () => void;
  exhibitionId?: string;
}

export default function FloorMap({ bottomInset = 0, initialZoneId, onViewEvents, exhibitionId: _exhibitionId }: FloorMapProps) {
  const [show, setShow]       = useState<ShowJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // ── Navigation state ──
  const [phase, setPhase]                 = useState<NavPhase>('idle');
  const [pointA, setPointA]               = useState<Stall | null>(null);
  const [pointB, setPointB]               = useState<Stall | null>(null);
  const [searchA, setSearchA]             = useState('');
  const [searchB, setSearchB]             = useState('');
  const [activeField, setActiveField]     = useState<'A' | 'B'>('A');
  const [routes, setRoutes]               = useState<[Route | null, Route | null] | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  // ── UI state ──
  const [quickFilters, setQuickFilters]       = useState<Set<QuickFilter>>(new Set());
  const [showSearchSheet, setShowSearchSheet] = useState(false);
  const [expandNavSheet, setExpandNavSheet]   = useState(false);
  const [tappedZone, setTappedZone]           = useState<SpecialZone | null>(null);
  const [tappedStall, setTappedStall]         = useState<Stall | null>(null);
  const [keyboardH, setKeyboardH]             = useState(0);

  // ── Map rotation + heading-lock ──
  const [mapRotation, setMapRotation]     = useState(0);
  const [headingLocked, setHeadingLocked] = useState(false);
  const locationSubRef                    = useRef<Location.LocationSubscription | null>(null);

  // ── Heading-lock subscription ──
  useEffect(() => {
    if (!headingLocked) {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      setMapRotation(0);
      return;
    }
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHeadingLocked(false);
        Alert.alert('Location needed', 'Allow location access to lock the map to your heading.');
        return;
      }
      locationSubRef.current = await Location.watchHeadingAsync((h: Location.LocationHeadingObject) => {
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        setMapRotation(deg);
      });
    })();
    return () => { locationSubRef.current?.remove(); locationSubRef.current = null; };
  }, [headingLocked]);

  // ── Keyboard height tracking (Fix 11) ──
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, e => setKeyboardH(e.endCoordinates.height));
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  // ── Pan / zoom refs ──
  const pan          = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset    = useRef({ x: 0, y: 0 });
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const currentScale = useRef(1);
  const lastScale    = useRef(1);
  const initialDist  = useRef<number | null>(null);

  const containerH  = useRef(SCREEN_H - 160);
  const displayHRef = useRef(SCREEN_W);
  const minScaleRef = useRef(1);

  // ── Load show data ──
  useEffect(() => {
    getShowData()
      .then(data => {
        const dH = SCREEN_W * (data.canvas.height / data.canvas.width);
        displayHRef.current = dH;
        // Fit the full map on screen: scale=1 fits width exactly (displayW=SCREEN_W),
        // containerH/dH fits height. Use the smaller so the entire map is visible.
        const sc = Math.min(1, containerH.current / dH, MAX_SCALE);
        minScaleRef.current = sc;
        // Center the map in the container (works for any sc)
        const ty = (containerH.current - dH) / 2;
        pan.setValue({ x: 0, y: ty });
        panOffset.current = { x: 0, y: ty };
        scaleAnim.setValue(sc);
        currentScale.current = sc;
        lastScale.current    = sc;
        setShow(data);
        setLoading(false);
      })
      .catch(() => { setOffline(true); setLoading(false); });
  }, [pan, scaleAnim]);

  // ── Open zone card from Events tab ──
  useEffect(() => {
    if (!initialZoneId || !show) return;
    const zone = show.specialZones.find(z => z.id === initialZoneId);
    if (!zone) return;
    setTappedZone(zone);
    setTappedStall(null);
  }, [initialZoneId, show]);

  // ── Canvas metrics ──
  const displayW = SCREEN_W;
  const displayH = show ? SCREEN_W * (show.canvas.height / show.canvas.width) : SCREEN_W;
  const scaleX   = show ? SCREEN_W / show.canvas.width : 1;
  const scaleY   = show ? SCREEN_W / show.canvas.width : 1;

  const allSearchable = show ? show.stalls.filter(s => s.stallType === 'brand' && !!s.brandName) : [];

  // ── Transform helpers ──
  const applyTransform = useCallback((sc: number, tx: number, ty: number) => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: sc, useNativeDriver: true }),
      Animated.spring(pan, { toValue: { x: tx, y: ty }, useNativeDriver: true }),
    ]).start();
    currentScale.current = sc;
    lastScale.current    = sc;
    panOffset.current    = { x: tx, y: ty };
  }, [pan, scaleAnim]);

  const focusStall = useCallback((stall: Stall) => {
    const px = (stall.x + stall.width  / 2) * scaleX;
    const py = (stall.y + stall.height / 2) * scaleY;
    const sc = 2.2;
    const cx = displayW / 2, cy = displayH / 2;
    applyTransform(sc,
      SCREEN_W / 2 - cx - sc * (px - cx),
      containerH.current * 0.45 - cy - sc * (py - cy),
    );
  }, [scaleX, scaleY, displayW, displayH, applyTransform]);

  const fitBothStalls = useCallback((a: Stall, b: Stall) => {
    const minX = Math.min(a.x, b.x), minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);
    const bw   = (maxX - minX + 520) * scaleX;
    const bh   = (maxY - minY + 760) * scaleY;
    const cH   = containerH.current;
    const sc   = clamp(Math.min(SCREEN_W / bw, (cH * 0.78) / bh), minScaleRef.current, MAX_SCALE);
    const cx   = ((minX + maxX) / 2) * scaleX;
    const cy   = ((minY + maxY) / 2) * scaleY;
    applyTransform(sc,
      SCREEN_W / 2 - displayW / 2 - sc * (cx - displayW / 2),
      cH * 0.44    - displayH / 2 - sc * (cy - displayH / 2),
    );
  }, [scaleX, scaleY, displayW, displayH, applyTransform]);

  const recenterMap = useCallback(() => {
    const dH = displayHRef.current;
    const sc = minScaleRef.current;
    applyTransform(sc, 0, (containerH.current - dH) / 2);
  }, [applyTransform]);

  // ── Route computation ──
  function computeRoutes(from: Stall, to: Stall) {
    if (!show) return;
    // Include zones so instructions can say "Turn right at AD CAFÉ" (Fix 12)
    const landmarks = [
      ...show.stalls.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.width, h: s.height, brandName: s.brandName })),
      ...show.specialZones.map(z => ({ id: z.id, x: z.x, y: z.y, w: z.width, h: z.height, brandName: z.name })),
    ];
    const [r1, r2] = findTwoRoutes(
      from.nearestNodeId!, to.nearestNodeId!,
      show.navGraph,
      landmarks,
      to.brandName,
    );
    setRoutes([r1, r2]);
    setSelectedRoute(null);
    setPhase('choosing');
    fitBothStalls(from, to);
  }

  // ── Point setters ──
  function applyA(stall: Stall) {
    setPointA(stall); setSearchA(''); setActiveField('B');
    setTappedStall(null);
    if (pointB && pointB.id !== stall.id) {
      setShowSearchSheet(false);
      computeRoutes(stall, pointB);
    } else {
      focusStall(stall);
    }
  }
  function applyB(stall: Stall, fromA: Stall) {
    setPointB(stall); setSearchB('');
    setTappedStall(null);
    setShowSearchSheet(false);
    computeRoutes(fromA, stall);
  }

  // ── Tap handlers ──
  const handleStallTap = useCallback((stall: Stall) => {
    if (phase === 'navigating' || phase === 'preview') return;
    if (!pointA && !pointB) {
      setTappedStall(stall); setTappedZone(null);
      focusStall(stall);
      return;
    }
    if (!pointA) { applyA(stall); return; }
    if (stall.id === pointA.id) return;
    applyB(stall, pointA);
  }, [phase, pointA, pointB, focusStall]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoneTap = useCallback((zone: SpecialZone) => {
    if (phase === 'navigating' || phase === 'preview') return;
    setTappedZone(zone); setTappedStall(null);
  }, [phase]);

  function handleZoneNavigateHere(zone: SpecialZone) {
    setTappedZone(null);
    const syntheticStall: Stall = {
      id: zone.id, brandId: '', brandName: zone.name,
      category: zone.type, stallType: 'service' as StallType,
      hallId: zone.hallId, x: zone.x, y: zone.y,
      width: zone.width, height: zone.height,
      nearestNodeId: zone.linkedNodeId,
    };
    if (pointA) applyB(syntheticStall, pointA);
    else { setPointB(syntheticStall); setSearchB(''); setActiveField('A'); focusStall(syntheticStall); }
  }

  function handleZoneNavigateToStall(stallId: string) {
    if (!show) return;
    setTappedZone(null);
    const stall = show.stalls.find(s => s.id === stallId);
    if (!stall) return;
    if (pointA) applyB(stall, pointA);
    else { setPointB(stall); setSearchB(''); setActiveField('A'); focusStall(stall); }
  }

  function handleNavigateHere(stall: Stall) {
    setTappedStall(null); setTappedZone(null);
    if (pointA) applyB(stall, pointA);
    else { setPointB(stall); setSearchB(''); setActiveField('A'); focusStall(stall); }
  }

  // ── Route selection → preview ──
  function handleSelectRoute(idx: 0 | 1) {
    const r = routes?.[idx];
    if (!r) return;
    setSelectedRoute(r);
    setPhase('preview');
    if (pointA && pointB) fitBothStalls(pointA, pointB);
  }

  // ── Start navigation from preview ──
  function handleStartNav() {
    setPhase('navigating');
    if (pointA && pointB) fitBothStalls(pointA, pointB);
  }

  // ── Reset everything → idle ──
  function resetAll() {
    setSelectedRoute(null); setRoutes(null);
    setPointA(null); setPointB(null);
    setSearchA(''); setSearchB('');
    setPhase('idle'); setActiveField('A');
    setShowSearchSheet(false); setExpandNavSheet(false);
    setTappedStall(null); setTappedZone(null);
  }

  function handleClearA() {
    setPointA(null); setSearchA('');
    setRoutes(null); setSelectedRoute(null); setPhase('idle');
    setActiveField('A');
  }
  function handleClearB() {
    setPointB(null); setSearchB('');
    setRoutes(null); setSelectedRoute(null); setPhase('idle');
    setActiveField('B');
  }

  function handleSwap() {
    const [na, nb] = [pointB, pointA];
    setPointA(na); setPointB(nb);
    setSearchA(''); setSearchB(''); setSelectedRoute(null);
    if (na && nb) computeRoutes(na, nb);
    else { setRoutes(null); setPhase('idle'); setActiveField(na ? 'B' : 'A'); }
  }

  function toggleQuickFilter(f: QuickFilter) {
    setQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  // ── Pan / zoom ──
  function pinchDist(touches: any[]) {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampPan(tx: number, ty: number, sc: number) {
    const h  = containerH.current;
    const dH = displayHRef.current;
    const maxTx = SCREEN_W * (sc - 1) / 2;
    const nx = sc > 1 ? clamp(tx, -maxTx, maxTx) : 0;
    // When map is larger than container: keep map covering the viewport (no whitespace gaps).
    // When map fits inside container: allow free pan within container edges (don't snap to center).
    const ny = dH * sc > h
      ? clamp(ty, h - dH * (1 + sc) / 2, dH * (sc - 1) / 2)
      : clamp(ty, dH * (sc - 1) / 2, h - dH * (1 + sc) / 2);
    return { x: nx, y: ny };
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      pan.setOffset({ x: panOffset.current.x, y: panOffset.current.y });
      pan.setValue({ x: 0, y: 0 });
      initialDist.current = null;
    },
    onPanResponderMove: (evt, g) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length === 2) {
        const d = pinchDist(touches as any);
        if (initialDist.current === null) initialDist.current = d;
        const newSc = clamp(lastScale.current * (d / initialDist.current!), minScaleRef.current, 5);
        scaleAnim.setValue(newSc);
        currentScale.current = newSc;
      } else {
        pan.setValue({ x: g.dx, y: g.dy });
      }
    },
    onPanResponderRelease: (_, g) => {
      const rawTx = panOffset.current.x + g.dx;
      const rawTy = panOffset.current.y + g.dy;
      const sc    = currentScale.current;
      const { x, y } = clampPan(rawTx, rawTy, sc);
      panOffset.current = { x, y };
      pan.flattenOffset();
      pan.setValue({ x, y });
      lastScale.current   = sc;
      initialDist.current = null;
    },
  })).current;

  // ── Autocomplete ──
  const matchA    = searchA.trim() ? allSearchable.filter(s => fuzzyMatch(s.brandName, searchA)) : [];
  const matchB    = searchB.trim() ? allSearchable.filter(s => fuzzyMatch(s.brandName, searchB)) : [];
  const showDropA = matchA.length > 0 && activeField === 'A' && !pointA;
  const showDropB = matchB.length > 0 && activeField === 'B' && !pointB;



  // Heights above the nav strip
  const aboveStrip = STRIP_H + bottomInset + 12;

  const QUICK_CHIPS: { key: QuickFilter; label: string }[] = [
    { key: 'brands',     label: 'Brands' },
    { key: 'cafe',       label: 'Cafés' },
    { key: 'lounge',     label: 'Lounges' },
    { key: 'facilities', label: 'Facilities' },
  ];

  const measureContainer = (h: number) => { containerH.current = h; };

  // ─── Loading / offline ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingWrap} onLayout={e => measureContainer(e.nativeEvent.layout.height)}>
        <ActivityIndicator size="large" color="#2980b9" />
        <Text style={styles.loadingTxt}>Loading venue map…</Text>
      </View>
    );
  }
  if (offline || !show) {
    return (
      <View style={styles.loadingWrap} onLayout={e => measureContainer(e.nativeEvent.layout.height)}>
        <Text style={styles.offlineIcon}>📶</Text>
        <Text style={styles.offlineTitle}>No internet connection</Text>
        <Text style={styles.offlineSub}>
          You need an internet connection to load this map for the first time.
          Once loaded it works offline.
        </Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root} onLayout={e => measureContainer(e.nativeEvent.layout.height)}>

      {/* ── Canvas (always interactive) ── */}
      <Animated.View
        style={[styles.canvas, { width: displayW, height: displayH,
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: scaleAnim }] }]}
        {...panResponder.panHandlers}
      >
        <MapCanvas
          show={show} scaleX={scaleX} scaleY={scaleY}
          displayW={displayW} displayH={displayH}
          pointA={pointA} pointB={pointB}
          quickFilters={quickFilters}
          routes={routes} selectedRoute={selectedRoute}
          phase={phase} highlightZone={tappedZone}
          mapRotation={mapRotation}
          onTapStall={handleStallTap}
          onTapZone={handleZoneTap}
          onSelectRoute={handleSelectRoute}
        />
      </Animated.View>

      {/* ── Floating pill + filter chips (idle / choosing, sheet closed) ──
          pointerEvents="box-none" so the map canvas receives pan gestures
          anywhere outside the pill and chip elements themselves.            */}
      {(phase === 'idle' || phase === 'choosing') && !showSearchSheet && (
        <View style={styles.topOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.searchPill}
            onPress={() => setShowSearchSheet(true)}
            activeOpacity={0.88}
          >
            <Text style={styles.searchPillIcon}>⌕</Text>
            <Text style={styles.searchPillText} numberOfLines={1}>
              {(pointA || pointB)
                ? `${pointA?.brandName ?? '…'}  →  ${pointB?.brandName ?? '…'}`
                : 'Search booths…'}
            </Text>
            {(pointA || pointB) && (
              <TouchableOpacity onPress={resetAll} hitSlop={12}>
                <Text style={styles.searchPillClear}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <View style={styles.chipRow} pointerEvents="box-none">
            {QUICK_CHIPS.map(({ key, label }) => {
              const active = quickFilters.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => toggleQuickFilter(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickChipTxt, active && styles.quickChipTxtActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Back button — top-left, all non-idle phases (Fix 9) ── */}
      {phase !== 'idle' && (
        <TouchableOpacity style={styles.backBtn} onPress={resetAll} activeOpacity={0.85}>
          <Text style={styles.backBtnTxt}>←</Text>
        </TouchableOpacity>
      )}

      {/* ── Compass / heading-lock button ──
          Idle: tap once to enable heading-lock (auto-rotates map to compass).
          Locked: shown in blue; tap to disable and snap back to north.
          Rotated but not locked: tap to snap back to north (0°).          */}
      <TouchableOpacity
        style={[styles.compassBtn, headingLocked && styles.compassBtnLocked]}
        onPress={() => {
          if (headingLocked) {
            setHeadingLocked(false);
          } else if (Math.round(mapRotation) !== 0) {
            setMapRotation(0);
          } else {
            setHeadingLocked(true);
          }
        }}
        activeOpacity={0.85}
      >
        <Text style={[
          styles.compassArrow,
          headingLocked && styles.compassArrowLocked,
          { transform: [{ rotate: `${mapRotation}deg` }] },
        ]}>
          ↑
        </Text>
        <Text style={[styles.compassLabel, headingLocked && styles.compassLabelLocked]}>
          {headingLocked ? 'HDG' : 'N'}
        </Text>
      </TouchableOpacity>

      {/* ── Dev warning: mapBounds missing (Fix 10) ── */}
      {__DEV__ && !show.mapBounds && (
        <View style={styles.devWarning} pointerEvents="none">
          <Text style={styles.devWarningTxt}>⚠ mapBounds missing in showData — add it via annotation tool</Text>
        </View>
      )}

      {/* ── Stall mini card ── */}
      {tappedStall && phase === 'idle' && (
        <StallMiniCard
          stall={tappedStall}
          bottomInset={bottomInset}
          onNavigateHere={() => handleNavigateHere(tappedStall)}
          onViewProfile={() => setTappedStall(null)}
          onDismiss={() => setTappedStall(null)}
        />
      )}

      {/* ── Zone card ── */}
      {tappedZone && phase === 'idle' && (
        <ZoneCard
          zone={tappedZone}
          events={show.events}
          onNavigateHere={handleZoneNavigateHere}
          onNavigateToStall={handleZoneNavigateToStall}
          onViewAllEvents={() => { setTappedZone(null); onViewEvents?.(); }}
          onDismiss={() => setTappedZone(null)}
        />
      )}

      {/* ── Route choice card ── */}
      {phase === 'choosing' && routes && !tappedStall && (
        <RouteChoiceCard routes={routes} bottomInset={bottomInset} onSelect={handleSelectRoute} />
      )}

      {/* ── Route preview card (Fix 4) ── */}
      {phase === 'preview' && selectedRoute && pointA && pointB && (
        <RoutePreviewCard
          route={selectedRoute} from={pointA} to={pointB}
          bottomInset={bottomInset}
          onStart={handleStartNav}
          onDismiss={resetAll}
        />
      )}

      {/* ── Slim nav strip (Fix 7) ── */}
      {phase === 'navigating' && selectedRoute && (
        <NavStrip
          route={selectedRoute}
          bottomInset={bottomInset}
          onExpand={() => setExpandNavSheet(true)}
          onEnd={resetAll}
        />
      )}

      {/* ── Re-centre button — visible in all phases when search sheet is closed ── */}
      {!showSearchSheet && (
        <TouchableOpacity
          style={[styles.recentreBtn, { bottom: phase === 'navigating' ? aboveStrip : bottomInset + 16 }]}
          onPress={() => {
            if (phase === 'navigating' && pointA && pointB) {
              fitBothStalls(pointA, pointB);
            } else {
              recenterMap();
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.recentreBtnTxt}>⊙</Text>
        </TouchableOpacity>
      )}

      {/* ── Search bottom sheet (Fix 1) ──
          Occupies bottom 45%. Top 55% remains pannable (nothing covers it). */}
      {showSearchSheet && (
        <View style={styles.searchSheet}>
          <View style={styles.sheetHandleRow}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity
              style={styles.sheetDoneBtn}
              onPress={() => setShowSearchSheet(false)}
              hitSlop={12}
            >
              <Text style={styles.sheetDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={{ position: 'relative' }}>
            <FieldRow
              label="FROM" dotColor={ROUTE_A}
              stall={pointA} search={searchA}
              placeholder="Search source booth…"
              onChangeText={t => { setSearchA(t); setActiveField('A'); }}
              onClear={handleClearA} onFocus={() => setActiveField('A')}
            />
            <View style={styles.connector} />
            <FieldRow
              label="TO" dotColor="#27ae60"
              stall={pointB} search={searchB}
              placeholder="Search destination booth…"
              onChangeText={t => { setSearchB(t); setActiveField('B'); }}
              onClear={handleClearB} onFocus={() => setActiveField('B')}
            />
            {(pointA || pointB) && (
              <TouchableOpacity style={styles.swapBtn} onPress={handleSwap} hitSlop={10}>
                <Text style={styles.swapBtnTxt}>⇅</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      )}

      {/* ── Autocomplete overlay — floats above keyboard (Fix 11) ──
          Rendered outside the search sheet so keyboard never covers it.
          When keyboard is open: sits at bottom = keyboardHeight + 8.
          When keyboard is hidden: sits at bottom = sheet height + 8.     */}
      {showSearchSheet && (showDropA || showDropB) && (
        <View style={[styles.suggestionOverlay,
          { bottom: keyboardH > 0 ? keyboardH + 8 : SCREEN_H * 0.47 + 8 }]}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 4 * 52 }}
          >
            {showDropA && matchA.slice(0, 4).map(s => (
              <TouchableOpacity key={s.id} style={styles.dropRow}
                onPress={() => { setSearchA(''); applyA(s); }}>
                <View style={[styles.dropDot, { backgroundColor: ROUTE_A }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropLabel} numberOfLines={1}>{s.brandName}</Text>
                  <Text style={styles.dropSub}>{s.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {showDropB && matchB.slice(0, 4).map(s => (
              <TouchableOpacity key={s.id} style={styles.dropRow}
                onPress={() => {
                  setSearchB('');
                  if (pointA) applyB(s, pointA);
                  else applyA(s);
                }}>
                <View style={[styles.dropDot, { backgroundColor: '#27ae60' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropLabel} numberOfLines={1}>{s.brandName}</Text>
                  <Text style={styles.dropSub}>{s.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Nav instructions expanded sheet ── */}
      {expandNavSheet && selectedRoute && (
        <View style={styles.instrBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setExpandNavSheet(false)} />
          <View style={styles.instrSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.instrSheetTitle}>Turn-by-turn directions</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedRoute.instructions.map((step, i) => {
                const isLast = i === selectedRoute.instructions.length - 1;
                return (
                  <View key={i} style={styles.instrRow}>
                    <View style={[styles.instrBullet, isLast && styles.instrBulletArrival]} />
                    <Text style={styles.instrStep}>{step}</Text>
                  </View>
                );
              })}
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  canvas: { position: 'absolute' },

  // Loading / offline
  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f0f0ec' },
  loadingTxt:   { marginTop: 12, fontSize: 14, color: '#888' },
  offlineIcon:  { fontSize: 40, marginBottom: 12 },
  offlineTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  offlineSub:   { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },

  // Top overlay container — pointerEvents="box-none" set via JSX prop
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 16, paddingHorizontal: 16,
    zIndex: 40,
  },

  // Search pill (Fix 1)
  searchPill: {
    height: 56, borderRadius: 28,
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16, shadowRadius: 12, elevation: 10,
  },
  searchPillIcon:  { fontSize: 20, color: '#aaa' },
  searchPillText:  { flex: 1, fontSize: 15, color: '#aaa', fontWeight: '500' },
  searchPillClear: { fontSize: 16, color: '#bbb', paddingLeft: 4 },

  // Filter chips (Fix 3)
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quickChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  quickChipActive:    { backgroundColor: '#2980b9', borderColor: '#2980b9' },
  quickChipTxt:       { fontSize: 13, color: '#444', fontWeight: '600' },
  quickChipTxtActive: { color: '#fff' },

  // Back button — top-left (Fix 9)
  backBtn: {
    position: 'absolute', top: 16, left: 16, zIndex: 50,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 8,
  },
  backBtnTxt: { fontSize: 20, color: '#333', fontWeight: '700', lineHeight: 24 },

  // Dev warning
  devWarning:    { position: 'absolute', top: 80, left: 0, right: 0, backgroundColor: '#FEF3C7', paddingVertical: 6, alignItems: 'center', zIndex: 99 },
  devWarningTxt: { fontSize: 11, color: '#D97706', fontWeight: '600' },

  // Shared bottom sheet base
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.13, shadowRadius: 12, elevation: 18, zIndex: 60,
  },
  sheetHandle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 14 },
  sheetHandleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  sheetDoneBtn:   { position: 'absolute', right: 0 },
  sheetDoneTxt:   { fontSize: 14, color: '#2980b9', fontWeight: '600' },

  // Stall card
  cardHeader:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  cardDot:              { width: 12, height: 12, borderRadius: 6, flexShrink: 0, marginTop: 3 },
  cardName:             { fontSize: 17, fontWeight: '700', color: '#111' },
  cardSub:              { fontSize: 12, color: '#888', marginTop: 2 },
  cardClose:            { fontSize: 18, color: '#bbb', paddingLeft: 8 },
  cardBtns:             { flexDirection: 'row', gap: 10 },
  cardBtn:              { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cardBtnPrimary:       { backgroundColor: '#2980b9' },
  cardBtnSecondary:     { backgroundColor: '#f4f4f4' },
  cardBtnPrimaryText:   { color: '#fff', fontWeight: '800', fontSize: 14 },
  cardBtnSecondaryText: { color: '#333', fontWeight: '700', fontSize: 14 },

  // Route choice
  routeHint:     { fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 12 },
  routeRow:      { flexDirection: 'row', gap: 12 },
  routeOpt:      { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 2, backgroundColor: '#fafafa', gap: 4 },
  routeBadge:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  routeBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  routeDist:     { fontSize: 18, fontWeight: '800' },
  routeLbl:      { fontSize: 12, color: '#888', fontWeight: '600' },

  // Route preview card (Fix 4)
  previewCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.13, shadowRadius: 12, elevation: 18, zIndex: 60,
  },
  previewRouteRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  previewDot:        { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  previewRouteLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111' },
  previewArrow:      { fontSize: 14, color: '#bbb' },
  previewMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  previewMetaTxt:    { fontSize: 12, color: '#888' },
  previewMetaDot:    { fontSize: 12, color: '#ddd' },
  startNavBtn:    { backgroundColor: '#27ae60', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  startNavBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Nav strip — slim 56px (Fix 7)
  navStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(15,42,68,0.94)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, gap: 8,
    zIndex: 60,
  },
  navStripArrow:  { fontSize: 18, color: '#5dade2' },
  navStripInstr:  { flex: 1, fontSize: 13, color: '#fff', fontWeight: '600' },
  navStripSteps:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  navStripEnd:    { paddingHorizontal: 6, paddingVertical: 4 },
  navStripEndTxt: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  // Re-centre button (Fix 6)
  recentreBtn: {
    position: 'absolute', right: 16, zIndex: 55,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 4, elevation: 6,
  },
  recentreBtnTxt: { fontSize: 20, color: '#2980b9' },

  // Search bottom sheet (Fix 1)
  searchSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.47,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 22, zIndex: 70,
  },
  // Floating autocomplete overlay — above keyboard, outside search sheet
  suggestionOverlay: {
    position: 'absolute', left: 12, right: 12,
    backgroundColor: '#fff',
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 24,
    zIndex: 75,
  },

  // Field row
  fieldRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 52 },
  fieldDot:   { width: 13, height: 13, borderRadius: 7, marginTop: 18, flexShrink: 0 },
  fieldBody:  { flex: 1, paddingTop: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  fieldInput: { fontSize: 15, color: '#111', paddingVertical: 3 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f4f4f4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  chipText:   { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chipClear:  { fontSize: 14, color: '#bbb' },
  connector:  { width: 1, height: 10, backgroundColor: '#ddd', marginLeft: 22, marginVertical: 2 },
  swapBtn:    { position: 'absolute', right: 0, top: '40%', width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  swapBtnTxt: { fontSize: 18, color: '#666' },

  // Autocomplete drop rows
  dropRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f4f4f4' },
  dropDot:   { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  dropLabel: { fontSize: 14, color: '#111', fontWeight: '600' },
  dropSub:   { fontSize: 11, color: '#aaa' },

  // Instructions expanded sheet
  instrBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 80,
  },
  instrSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10,
    maxHeight: SCREEN_H * 0.62,
  },
  instrSheetTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 12, marginTop: 4 },
  instrRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f6f6f6' },
  instrBullet:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2980b9', marginTop: 6, flexShrink: 0 },
  instrBulletArrival: { backgroundColor: '#27ae60' },
  instrStep:       { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },

  // Compass / heading-lock button
  compassBtn: {
    position: 'absolute', top: 90, right: 16, zIndex: 50,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 6, elevation: 8,
  },
  compassBtnLocked:    { backgroundColor: '#1565C0' },
  compassArrow:        { fontSize: 18, color: '#900b09', fontWeight: '700', lineHeight: 20 },
  compassArrowLocked:  { color: '#fff' },
  compassLabel:        { fontSize: 9, color: '#900b09', fontWeight: '700', letterSpacing: 0.4 },
  compassLabelLocked:  { color: 'rgba(255,255,255,0.85)' },
});
