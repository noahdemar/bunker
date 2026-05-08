import { BLOCKS, ELECTRICAL_BLOCKS } from './blocks.js';

// Electric power network.
//
// Three block types participate: GENERATOR (source), WIRE (conduit), TORCH (load).
// Any pair of electrical blocks within RANGE Euclidean cells is auto-connected — so
// you don't have to build a perfectly contiguous wire path: drop a wire near a
// generator, drop another wire near that one, drop a light near that one. BFS from
// every generator with charge > 0 marks every reachable electrical cell as powered.
//
// Recompute is sparse: world.onChange fires for any block edit, but we rebuild the
// electrical cache + powered set only when the changed block is itself electrical.
// On top of that, refresh() runs once per game tick from the main loop so generator
// charge depletion (driven by Survival) flips lights off when the tank runs dry.

const RANGE = 6;
const RANGE2 = RANGE * RANGE;

export class PowerNetwork {
  constructor(world, devices) {
    this.world = world;
    this.devices = devices;
    this.electrical = [];           // [{ x, y, z, type }]
    this.poweredCells = new Set();  // "x,y,z"
    this.lampPowerState = new Map();// "x,y,z" -> bool (only TORCH cells)
    this.listeners = [];
    this._lastPoweredHash = '';

    this._rebuildElectrical();
    this._recompute();

    world.onChange((x, y, z, prev, next) => {
      if (ELECTRICAL_BLOCKS.has(prev) || ELECTRICAL_BLOCKS.has(next)) {
        this._rebuildElectrical();
        this.refresh();
      }
    });
  }

  onChange(fn) { this.listeners.push(fn); }

  isPowered(x, y, z) {
    return this.poweredCells.has(`${x},${y},${z}`);
  }

  // Called from the main loop each tick. Recomputes only if generator charge state
  // has plausibly changed (cheap full BFS at our scale, but skip when nothing matters).
  refresh() {
    this._recompute();
    const hash = this.poweredCells.size + ':' + [...this.poweredCells].sort().join('|');
    if (hash === this._lastPoweredHash) return;
    this._lastPoweredHash = hash;
    for (const fn of this.listeners) fn(this.lampPowerState);
  }

  _rebuildElectrical() {
    this.electrical = [];
    for (const [k, id] of this.world.terrain.edits) {
      if (!ELECTRICAL_BLOCKS.has(id)) continue;
      const [x, y, z] = k.split(',').map(Number);
      this.electrical.push({ x, y, z, type: id });
    }
  }

  _recompute() {
    this.poweredCells = new Set();
    this.lampPowerState = new Map();
    if (this.electrical.length === 0) return;

    // Pre-populate lamp state to "unpowered" so listeners always see every lamp.
    for (const e of this.electrical) {
      if (e.type === BLOCKS.TORCH) {
        this.lampPowerState.set(`${e.x},${e.y},${e.z}`, false);
      }
    }

    // Sources: generators with charge > 0.
    const sources = this.electrical.filter(e => {
      if (e.type !== BLOCKS.GENERATOR) return false;
      const dev = this.devices.devices.get(`${e.x},${e.y},${e.z}`);
      return !!dev && dev.charge > 0;
    });
    if (sources.length === 0) return;

    // BFS through the proximity graph: each electrical cell connects to every other
    // electrical cell within RANGE.
    const visited = new Set();
    const queue = [...sources];
    while (queue.length) {
      const b = queue.shift();
      const k = `${b.x},${b.y},${b.z}`;
      if (visited.has(k)) continue;
      visited.add(k);
      this.poweredCells.add(k);
      if (b.type === BLOCKS.TORCH) this.lampPowerState.set(k, true);
      for (const other of this.electrical) {
        const ok = `${other.x},${other.y},${other.z}`;
        if (visited.has(ok)) continue;
        const dx = other.x - b.x;
        const dy = other.y - b.y;
        const dz = other.z - b.z;
        if (dx * dx + dy * dy + dz * dz > RANGE2) continue;
        queue.push(other);
      }
    }
  }
}
