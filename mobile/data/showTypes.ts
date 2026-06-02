// showTypes.ts — Full TypeScript interfaces for show JSON exported by the annotation tool.

// ── Core enums ───────────────────────────────────────────────────────────────

export type StallType = 'brand' | 'service' | 'entry' | 'exit' | 'washroom';

export type ZoneType =
  | 'cafe'
  | 'lounge'
  | 'curated'
  | 'directory'
  | 'pro-directory'
  | 'washroom';

// ── Show metadata ─────────────────────────────────────────────────────────────

export interface ShowMeta {
  id?: string;
  name: string;
  venue: string;
  address?: string;
  dates: { start: string; end: string };
  /** Single human-readable hours string, e.g. "11:00 AM – 8:00 PM" */
  hours: string;
  /**
   * Optional remote URL for updated ShowJSON. When present the data service
   * fetches it in the background and refreshes the local cache.
   */
  dataUrl?: string | null;
}

// ── Canvas & halls ────────────────────────────────────────────────────────────

export interface CanvasDimensions {
  width: number;
  height: number;
}

/**
 * imageUrl formats:
 *   "local:<filename>"  — bundled asset under mobile/assets/
 *   any other string    — treated as a remote URI
 */
export interface Hall {
  id: string;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Stalls ───────────────────────────────────────────────────────────────────

export interface Stall {
  id: string;
  brandId?: string;
  brandName: string;
  category: string;
  stallType: StallType;
  hallId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Nearest nav-node id. Computed at runtime via enrichStalls() if absent. */
  nearestNodeId?: string;
}

// ── Navigation graph ──────────────────────────────────────────────────────────

export type NavNodeType = 'junction' | 'entry' | 'exit' | 'corridor';

export interface NavNode {
  id: string;
  x: number;
  y: number;
  type: NavNodeType;
  hallId?: string;
}

export interface NavEdge {
  from: string;
  to: string;
  distance: number;
}

export interface NavGraph {
  nodes: NavNode[];
  edges: NavEdge[];
}

// ── Special zones ─────────────────────────────────────────────────────────────

export interface ZoneItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  stallId?: string;
}

export interface SpecialZone {
  id: string;
  type: ZoneType;
  name: string;
  hallId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  linkedNodeId: string;
  items?: ZoneItem[];
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface ShowEvent {
  id: string;
  day: 1 | 2;
  time: string;
  title: string;
  description: string;
  locationZoneId: string;
  inviteOnly: boolean;
}

// ── Root document ─────────────────────────────────────────────────────────────

export interface ShowJSON {
  meta: ShowMeta;
  canvas: CanvasDimensions;
  /** Bounding box of the actual map content within the canvas. Written by the annotation tool. */
  mapBounds?: { x: number; y: number; width: number; height: number };
  halls: Hall[];
  stalls: Stall[];
  navGraph: NavGraph;
  specialZones: SpecialZone[];
  events: ShowEvent[];
}

// ── UI state ──────────────────────────────────────────────────────────────────

export interface ActiveFilters {
  brandCategories: string[];
  zoneTypes: ZoneType[];
}
