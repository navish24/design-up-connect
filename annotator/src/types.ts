export type StallType = 'brand' | 'cafe' | 'lounge' | 'feature' | 'directory' | 'service' | 'entry' | 'exit';

export interface Stall {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: StallType;
}

export interface NavNode {
  id: string;
  x: number;
  y: number;
}

export type NavEdge = [string, string];

export interface VenueMap {
  refWidth: number;
  refHeight: number;
  stalls: Stall[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
}

export type Tool = 'select' | 'draw' | 'node' | 'connect';
