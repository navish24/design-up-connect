// dijkstra.ts
// Path-finding over a JSON-driven NavGraph.
// No module-level venue map — callers pass navGraph and stalls directly.

export interface NavNode {
  id: string;
  x: number;
  y: number;
  type: string;
}

export interface Route {
  nodes: NavNode[];
  totalDist: number;
  instructions: string[];
}

// ─── Types accepted by public API ────────────────────────────────────────────

type NavGraphParam = {
  nodes: NavNode[];
  edges: Array<{ from: string; to: string; distance: number }>;
};

type StallParam = {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  brandName?: string;
};

type Adj = Map<string, Array<{ node: NavNode; dist: number }>>;

// ─── Graph helpers ────────────────────────────────────────────────────────────

function buildAdj(
  navGraph: NavGraphParam,
  blockedEdge?: [string, string],
): Adj {
  const adj: Adj = new Map();
  for (const n of navGraph.nodes) adj.set(n.id, []);

  for (const edge of navGraph.edges) {
    const { from: aId, to: bId, distance } = edge;

    if (blockedEdge) {
      const [ba, bb] = blockedEdge;
      if ((aId === ba && bId === bb) || (aId === bb && bId === ba)) continue;
    }

    const a = navGraph.nodes.find((n) => n.id === aId);
    const b = navGraph.nodes.find((n) => n.id === bId);
    if (!a || !b) continue;

    adj.get(aId)!.push({ node: b, dist: distance });
    adj.get(bId)!.push({ node: a, dist: distance });
  }

  return adj;
}

function runDijkstra(
  startId: string,
  endId: string,
  adj: Adj,
  nodes: NavNode[],
): NavNode[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const n of nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(startId, 0);

  const queue: { id: string; d: number }[] = [{ id: startId, d: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d);
    const { id: uId } = queue.shift()!;
    if (visited.has(uId)) continue;
    visited.add(uId);
    if (uId === endId) break;

    for (const { node: v, dist: w } of adj.get(uId) ?? []) {
      const alt = dist.get(uId)! + w;
      if (alt < dist.get(v.id)!) {
        dist.set(v.id, alt);
        prev.set(v.id, uId);
        queue.push({ id: v.id, d: alt });
      }
    }
  }

  if (dist.get(endId) === Infinity) return null;

  const path: NavNode[] = [];
  let cur: string | null = endId;
  while (cur) {
    const node = nodes.find((n) => n.id === cur);
    if (!node) break;
    path.unshift(node);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

// ─── Path utilities ───────────────────────────────────────────────────────────

function pathsEqual(a: NavNode[], b: NavNode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((n, i) => n.id === b[i].id);
}

function pathDist(nodes: NavNode[]): number {
  return nodes.reduce((s, n, i) => {
    if (i === 0) return s;
    const prev = nodes[i - 1];
    return s + Math.sqrt((n.x - prev.x) ** 2 + (n.y - prev.y) ** 2);
  }, 0);
}

// ─── Instruction helpers ──────────────────────────────────────────────────────

function bearing(a: NavNode, b: NavNode): number {
  return Math.atan2(b.x - a.x, a.y - b.y) * (180 / Math.PI);
}

function turnWord(delta: number): string {
  const d = ((delta % 360) + 360) % 360;
  if (d < 30 || d > 330) return 'Continue straight';
  if (d < 100) return 'Turn right';
  if (d > 260) return 'Turn left';
  return 'Turn around';
}

// Search for the nearest named stall/zone around any of the given nav nodes.
// Expanded radius (200 units) to reliably find landmarks in corridors.
function nearbyLandmark(checkNodes: NavNode[], stalls: StallParam[]): string | null {
  const RADIUS = 200;
  let best: StallParam | null = null;
  let bestDist = RADIUS;

  for (const node of checkNodes) {
    for (const s of stalls) {
      const cx = s.x + (s.w ?? 0) / 2;
      const cy = s.y + (s.h ?? 0) / 2;
      const d  = Math.sqrt((cx - node.x) ** 2 + (cy - node.y) ** 2);
      if (d < bestDist) { bestDist = d; best = s; }
    }
  }
  return best?.label ?? best?.brandName ?? null;
}

function buildInstructions(nodes: NavNode[], stalls: StallParam[], destName?: string): string[] {
  const arrival = `You have arrived at ${destName ?? 'your destination'}.`;
  if (nodes.length < 2) return [arrival];

  const steps: string[] = [];
  let prevWord: string | null = null;
  let prevLandmark: string | null = null;

  for (let i = 1; i < nodes.length - 1; i++) {
    const b1   = bearing(nodes[i - 1], nodes[i]);
    const b2   = bearing(nodes[i], nodes[i + 1]);
    const word = turnWord(b2 - b1);

    // Suppress consecutive "Continue straight" — emit only the first of a run
    if (word === 'Continue straight' && prevWord === 'Continue straight') continue;

    // Search current node plus immediate neighbours in the path for a landmark
    const searchNodes: NavNode[] = [nodes[i]];
    if (i > 0)                  searchNodes.push(nodes[i - 1]);
    if (i < nodes.length - 1)   searchNodes.push(nodes[i + 1]);

    const lmRaw = nearbyLandmark(searchNodes, stalls);
    // Don't reuse the same landmark for back-to-back instructions (avoids "Turn X at FOO / Turn Y at FOO")
    const lm = lmRaw !== prevLandmark ? lmRaw : null;

    let instruction: string;
    if (word === 'Continue straight') {
      instruction = lm ? `Continue straight past ${lm}` : 'Continue straight';
    } else {
      // Turns always get a reference — "at [landmark]" or fallback corridor hint
      instruction = lm ? `${word} at ${lm}` : `${word} toward the main corridor`;
    }

    // Suppress identical consecutive instructions (e.g. two turns near the same node)
    if (steps.length > 0 && instruction === steps[steps.length - 1]) {
      prevWord = word;
      prevLandmark = lmRaw;
      continue;
    }

    steps.push(instruction);
    prevWord = word;
    prevLandmark = lmRaw;
  }

  steps.push(arrival);
  return steps;
}

function makeRoute(path: NavNode[], stalls: StallParam[], destName?: string): Route {
  return {
    nodes: path,
    totalDist: pathDist(path),
    instructions: buildInstructions(path, stalls, destName),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find the shortest route between two nav-node IDs in the given graph.
 * Pass stall.nearestNodeId as fromNodeId / toNodeId.
 */
export function findRoute(
  fromNodeId: string,
  toNodeId: string,
  navGraph: NavGraphParam,
  stalls: StallParam[],
  destName?: string,
): Route | null {
  if (fromNodeId === toNodeId) return null;
  const adj = buildAdj(navGraph);
  const path = runDijkstra(fromNodeId, toNodeId, adj, navGraph.nodes);
  return path ? makeRoute(path, stalls, destName) : null;
}

/**
 * Returns up to two distinct routes: the shortest path, then the best
 * alternative found by blocking each segment of the first path in turn.
 */
export function findTwoRoutes(
  fromNodeId: string,
  toNodeId: string,
  navGraph: NavGraphParam,
  stalls: StallParam[],
  destName?: string,
): [Route | null, Route | null] {
  if (fromNodeId === toNodeId) return [null, null];

  const path1 = runDijkstra(fromNodeId, toNodeId, buildAdj(navGraph), navGraph.nodes);
  if (!path1) return [null, null];
  const route1 = makeRoute(path1, stalls, destName);

  let route2: Route | null = null;
  let best2Dist = Infinity;

  for (let i = 0; i < path1.length - 1; i++) {
    const blocked: [string, string] = [path1[i].id, path1[i + 1].id];
    const alt = runDijkstra(
      fromNodeId,
      toNodeId,
      buildAdj(navGraph, blocked),
      navGraph.nodes,
    );
    if (alt && !pathsEqual(alt, path1)) {
      const d = pathDist(alt);
      if (d < best2Dist) {
        best2Dist = d;
        route2 = makeRoute(alt, stalls, destName);
      }
    }
  }

  return [route1, route2];
}
