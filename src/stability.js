import { BLOCKS } from './blocks.js';

// Cantilever-based mine stability.
//
// We compute, for every solid cell in a window around the change site, the minimum
// "cantilever cost" needed to reach an anchor. Anchors are the bedrock layer plus the
// solid cells on the boundary of the analysis window (so we trust the world outside).
//
// Step costs:
//   - Vertical UP through stacked solids: 0  (a stacked column transmits weight freely)
//   - Horizontal step into a solid: cost depends on the destination's material
//   - Down moves: not allowed (a hanging block isn't supported by what's above it)
//
// Solid cells in the window NOT reached within MAX_CANTILEVER fall.

const MAT_COST = {
  [BLOCKS.STONE]:    1,
  [BLOCKS.CONCRETE]: 1,
  [BLOCKS.WOOD]:     1,
  [BLOCKS.DIRT]:     2,
  [BLOCKS.GRASS]:    2,
  [BLOCKS.SAND]:     3,
  [BLOCKS.LEAVES]:   99,
  [BLOCKS.TORCH]:    99,
};

const BEDROCK_Y = -5;
export const MAX_CANTILEVER = 4;
const REGION_HALF = 12;
const MAX_CASCADE_ITERS = 8;

function cost(id) { return MAT_COST[id] ?? 99; }

// Min-priority queue with sorted insertion. N is small here so O(n) insert is fine.
function pqInsert(pq, c, x, y, z) {
  let lo = 0, hi = pq.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pq[mid][0] < c) lo = mid + 1; else hi = mid;
  }
  pq.splice(lo, 0, [c, x, y, z]);
}

function findUnstable(world, cx, cy, cz) {
  const x0 = cx - REGION_HALF, x1 = cx + REGION_HALF;
  const y0 = Math.max(BEDROCK_Y, cy - REGION_HALF);
  const y1 = cy + REGION_HALF;
  const z0 = cz - REGION_HALF, z1 = cz + REGION_HALF;

  const cant = new Map();
  const pq = [];

  // Anchor seeds: bedrock layer.
  for (let x = x0; x <= x1; x++)
  for (let z = z0; z <= z1; z++) {
    const y = BEDROCK_Y;
    if (y < y0 || y > y1) continue;
    if (world.terrain.blockAt(x, y, z) !== BLOCKS.AIR) {
      const k = `${x},${y},${z}`;
      cant.set(k, 0);
      pqInsert(pq, 0, x, y, z);
    }
  }

  // Anchor seeds: any solid cell on the analysis-window boundary.
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) {
        if (world.terrain.blockAt(x, y, z) === BLOCKS.AIR) continue;
        const k = `${x},${y},${z}`;
        if (!cant.has(k)) { cant.set(k, 0); pqInsert(pq, 0, x, y, z); }
      }
    }
    for (let x = x0 + 1; x < x1; x++) {
      for (const z of [z0, z1]) {
        if (world.terrain.blockAt(x, y, z) === BLOCKS.AIR) continue;
        const k = `${x},${y},${z}`;
        if (!cant.has(k)) { cant.set(k, 0); pqInsert(pq, 0, x, y, z); }
      }
    }
  }

  // Dijkstra with the cantilever cost as the key.
  const deltas = [
    [ 1, 0, 0, false],
    [-1, 0, 0, false],
    [ 0, 0, 1, false],
    [ 0, 0,-1, false],
    [ 0, 1, 0, true ],   // up: free vertical chain
  ];
  while (pq.length) {
    const [c, x, y, z] = pq.shift();
    const k = `${x},${y},${z}`;
    if (cant.get(k) < c) continue;

    for (const [dx, dy, dz, vertical] of deltas) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || nz < z0 || nz > z1) continue;
      const id = world.terrain.blockAt(nx, ny, nz);
      if (id === BLOCKS.AIR) continue;
      const step = vertical ? 0 : cost(id);
      const nc = c + step;
      if (nc > MAX_CANTILEVER) continue;
      const nk = `${nx},${ny},${nz}`;
      const prev = cant.get(nk);
      if (prev === undefined || nc < prev) {
        cant.set(nk, nc);
        pqInsert(pq, nc, nx, ny, nz);
      }
    }
  }

  // Anything solid + fall-eligible in the interior that wasn't reached → unstable.
  // Leaves & torches are decorative fixtures: cost-99 means Dijkstra can't reach
  // them, but we don't want them spontaneously vanishing either.
  const out = [];
  for (let x = x0 + 1; x < x1; x++)
  for (let y = y0 + 1; y < y1; y++)
  for (let z = z0 + 1; z < z1; z++) {
    const id = world.terrain.blockAt(x, y, z);
    if (id === BLOCKS.AIR) continue;
    if (id === BLOCKS.LEAVES || id === BLOCKS.TORCH) continue;
    const k = `${x},${y},${z}`;
    if (!cant.has(k)) out.push([x, y, z]);
  }
  return out;
}

// Run stability around (cx, cy, cz). Cascades collapses up to MAX_CASCADE_ITERS times.
// `onCollapse(x, y, z, prevId)` fires for each cell as it transitions to air, so callers
// can spawn falling-block entities that animate the cave-in.
// Returns total cells collapsed.
export function applyStability(world, cx, cy, cz, onCollapse) {
  let total = 0;
  for (let i = 0; i < MAX_CASCADE_ITERS; i++) {
    const unstable = findUnstable(world, cx, cy, cz);
    if (unstable.length === 0) break;
    for (const [x, y, z] of unstable) {
      const prev = world.terrain.blockAt(x, y, z);
      world.setBlock(x, y, z, BLOCKS.AIR);
      if (onCollapse) onCollapse(x, y, z, prev);
    }
    total += unstable.length;
  }
  return total;
}
