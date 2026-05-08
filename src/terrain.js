// Deterministic procedural terrain. Heightmap from value-noise fBm, plus tree placement.
import { BLOCKS } from './blocks.js';

// Hash & noise — deterministic from a seed.
function seeded(seed) {
  let s = (seed | 0) || 1;
  // 32-bit xorshift
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function hash2(seed, x, y) {
  let h = (x * 374761393 + y * 668265263 + seed * 1013) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}
const smooth = t => t * t * (3 - 2 * t);

function valueNoise(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(seed, xi,     yi    );
  const b = hash2(seed, xi + 1, yi    );
  const c = hash2(seed, xi,     yi + 1);
  const d = hash2(seed, xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return ((1 - u) * (1 - v)) * a + (u * (1 - v)) * b + ((1 - u) * v) * c + (u * v) * d;
}

function fbm(seed, x, y, octaves = 5) {
  let v = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise(seed + i * 7, x * freq, y * freq);
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / max;
}

export function makeTerrain(seed = 1337, radius = 48) {
  const HALF = radius;
  // Sea-ish low ground around 0; hills up to ~12.
  const heightAt = (x, z) => {
    const n = fbm(seed, x * 0.025, z * 0.025, 5);
    // Bias toward gentle hills with occasional peaks
    const shaped = Math.pow(n, 1.4);
    return Math.floor(shaped * 18) - 3; // -3..14
  };

  // Biome type at column from height + secondary noise.
  const biomeAt = (x, z, h) => {
    if (h <= 0) return BLOCKS.SAND;
    if (h >= 10) return BLOCKS.STONE;
    return BLOCKS.GRASS;
  };

  // Pre-compute heightmap and biome map for the world bounds.
  const heights = new Map();
  const biomes = new Map();
  for (let x = -HALF; x <= HALF; x++) {
    for (let z = -HALF; z <= HALF; z++) {
      const h = heightAt(x, z);
      const b = biomeAt(x, z, h);
      heights.set(`${x},${z}`, h);
      biomes.set(`${x},${z}`, b);
    }
  }

  // Sparse "edits" map: key "x,y,z" -> blockId (0 = removed/air).
  // The world is fully derived from heights + biomes + edits, so we can mutate cheaply.
  const edits = new Map();

  const baseHeight = (x, z) => heights.get(`${x},${z}`);
  const baseBiome  = (x, z) => biomes.get(`${x},${z}`);

  // What block sits at (x,y,z) by default before edits?
  // Stone deep, dirt shallow, top = biome.
  const baseBlockAt = (x, y, z) => {
    const h = baseHeight(x, z);
    if (h === undefined) return BLOCKS.AIR;          // outside world bounds
    if (y > h) return BLOCKS.AIR;
    if (y === h) return baseBiome(x, z);
    if (y >= h - 3) return BLOCKS.DIRT;
    return BLOCKS.STONE;
  };

  const blockAt = (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (edits.has(k)) return edits.get(k);
    return baseBlockAt(x, y, z);
  };

  const setBlock = (x, y, z, id) => {
    const k = `${x},${y},${z}`;
    if (id === baseBlockAt(x, y, z)) {
      edits.delete(k);
    } else {
      edits.set(k, id);
    }
  };

  // Trees: deterministic placement on grass columns.
  const trees = [];
  for (let x = -HALF + 2; x <= HALF - 2; x++) {
    for (let z = -HALF + 2; z <= HALF - 2; z++) {
      const h = baseHeight(x, z);
      if (baseBiome(x, z, h) !== BLOCKS.GRASS) continue;
      // sparse, deterministic
      if (hash2(seed + 91, x, z) < 0.012) {
        // ensure room: skip if too close to another (rough check via hash)
        if (hash2(seed + 92, Math.floor(x / 4), Math.floor(z / 4)) < 0.7) {
          trees.push({ x, y: h + 1, z });
        }
      }
    }
  }

  // Place trees as edits (so they participate in collision/breaking).
  for (const t of trees) {
    const trunkH = 4 + Math.floor(hash2(seed + 5, t.x, t.z) * 2);
    for (let i = 0; i < trunkH; i++) {
      setBlock(t.x, t.y + i, t.z, BLOCKS.WOOD);
    }
    const top = t.y + trunkH;
    // 5x5x3 leafy crown
    for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
    for (let dy = 0; dy <= 2; dy++) {
      const dist2 = dx*dx + dz*dz + dy*dy * 0.5;
      if (dist2 > 5.5) continue;
      // corner skip for shape
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy !== 1) continue;
      const cx = t.x + dx, cy = top + dy - 1, cz = t.z + dz;
      // don't overwrite trunk
      if (blockAt(cx, cy, cz) !== BLOCKS.AIR) continue;
      setBlock(cx, cy, cz, BLOCKS.LEAVES);
    }
  }

  return {
    radius,
    seed,
    heights,
    biomes,
    edits,
    baseHeight,
    baseBiome,
    baseBlockAt,
    blockAt,
    setBlock,
  };
}
