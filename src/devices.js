import { BLOCKS, DEVICE_BLOCKS } from './blocks.js';

// Tracks placed device blocks and their charge state. Subscribes to world.onChange so
// placement / removal / cave-in / bomb destruction all stay in sync.
//
// A device is { type, x, y, z, charge }. Charge is depleted by Survival when the device
// is actively replenishing the player. The bed has no charge field (always "available")
// — it's a binary shelter signal.
export class DeviceManager {
  constructor(world) {
    this.world = world;
    this.devices = new Map();      // "x,y,z" -> device
    this._byType = new Map();      // typeId -> Set<device>
    world.onChange((x, y, z, prev, next) => {
      if (DEVICE_BLOCKS.has(prev) && prev !== next) this._remove(x, y, z);
      if (DEVICE_BLOCKS.has(next) && prev !== next) this._add(x, y, z, next);
    });
  }

  _add(x, y, z, type) {
    const k = `${x},${y},${z}`;
    const d = { type, x, y, z, charge: 100 };
    this.devices.set(k, d);
    if (!this._byType.has(type)) this._byType.set(type, new Set());
    this._byType.get(type).add(d);
  }

  _remove(x, y, z) {
    const k = `${x},${y},${z}`;
    const d = this.devices.get(k);
    if (!d) return;
    this.devices.delete(k);
    this._byType.get(d.type)?.delete(d);
  }

  // Nearest device of `type` within `radius` of (px, py, pz). Returns null if none.
  nearest(type, px, py, pz, radius = 6) {
    const set = this._byType.get(type);
    if (!set || set.size === 0) return null;
    const r2 = radius * radius;
    let best = null;
    let bestD2 = Infinity;
    for (const d of set) {
      const dx = (d.x + 0.5) - px;
      const dy = (d.y + 0.5) - py;
      const dz = (d.z + 0.5) - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      if (d2 < bestD2) { best = d; bestD2 = d2; }
    }
    return best;
  }

  hasNearby(type, px, py, pz, radius = 8) {
    return this.nearest(type, px, py, pz, radius) !== null;
  }
}
