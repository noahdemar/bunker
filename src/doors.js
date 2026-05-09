import { BLOCKS } from './blocks.js';

// Multi-cell structures (doors, beds). Each structure is a set of connected cells
// sharing the same block ID (or state-variant IDs like DOOR_CLOSED/OPEN).
// State lives in the cell block IDs themselves.
//
// Connectivity is recovered via flood-fill when interacting/mining.

const STRUCT_TYPES = {
  door: {
    closedId: BLOCKS.DOOR_CLOSED,
    openId:   BLOCKS.DOOR_OPEN,
    width: 1, height: 2,
  },
  vault_door: {
    closedId: BLOCKS.VAULT_CLOSED,
    openId:   BLOCKS.VAULT_OPEN,
    width: 3, height: 2,
  },
  bed: {
    closedId: BLOCKS.BED,
    openId:   BLOCKS.BED,
    width: 2, height: 1, horizontal: true,
  }
};

export function isDoorBlock(id) {
  return id === BLOCKS.DOOR_CLOSED  || id === BLOCKS.DOOR_OPEN
      || id === BLOCKS.VAULT_CLOSED || id === BLOCKS.VAULT_OPEN
      || id === BLOCKS.BED;
}

export function isDoorPassable(id) {
  return id === BLOCKS.DOOR_OPEN || id === BLOCKS.VAULT_OPEN;
}

function structTypeForBlock(id) {
  if (id === BLOCKS.DOOR_CLOSED  || id === BLOCKS.DOOR_OPEN)  return 'door';
  if (id === BLOCKS.VAULT_CLOSED || id === BLOCKS.VAULT_OPEN) return 'vault_door';
  if (id === BLOCKS.BED) return 'bed';
  return null;
}

function cellsForStruct(type, anchor, axis) {
  const def = STRUCT_TYPES[type];
  const cells = [];
  if (def.horizontal) {
    // 2x1 horizontal: along the chosen axis (facing).
    for (let dw = 0; dw < def.width; dw++) {
      const cx = anchor.x + (axis === 'x' ? dw : 0);
      const cz = anchor.z + (axis === 'z' ? dw : 0);
      cells.push({ x: cx, y: anchor.y, z: cz });
    }
    return cells;
  }
  if (def.width === 1) {
    // 1xN vertical.
    for (let dy = 0; dy < def.height; dy++) {
      cells.push({ x: anchor.x, y: anchor.y + dy, z: anchor.z });
    }
    return cells;
  }
  // MxN vertical (vault door): M cells along horizontal axis, N stacked.
  const half = Math.floor(def.width / 2);
  for (let dy = 0; dy < def.height; dy++) {
    for (let dw = -half; dw <= half; dw++) {
      const cx = anchor.x + (axis === 'x' ? dw : 0);
      const cz = anchor.z + (axis === 'z' ? dw : 0);
      cells.push({ x: cx, y: anchor.y + dy, z: cz });
    }
  }
  return cells;
}

function cellInsidePlayer(player, x, y, z) {
  const RADIUS = 0.3, HEIGHT = 1.7;
  const px0 = Math.floor(player.x - RADIUS), px1 = Math.floor(player.x + RADIUS);
  const py0 = Math.floor(player.y - HEIGHT), py1 = Math.floor(player.y + 0.2);
  const pz0 = Math.floor(player.z - RADIUS), pz1 = Math.floor(player.z + RADIUS);
  return x >= px0 && x <= px1 && y >= py0 && y <= py1 && z >= pz0 && z <= pz1;
}

export function tryPlaceDoor(world, placer, place, type) {
  const def = STRUCT_TYPES[type];
  if (!def) return false;

  // Horizontal structs (bed) align WITH the player's facing.
  // Vertical width>1 structs (vault door) align PERPENDICULAR to facing.
  const facingX = Math.abs(Math.sin(placer.yaw)) > Math.abs(Math.cos(placer.yaw));
  let axis;
  if (def.horizontal) {
    axis = facingX ? 'x' : 'z';
  } else {
    axis = def.width === 1 ? 'x' : (facingX ? 'z' : 'x');
  }

  const cells = cellsForStruct(type, place, axis);
  for (const c of cells) {
    if (world.terrain.blockAt(c.x, c.y, c.z) !== BLOCKS.AIR) return false;
    if (cellInsidePlayer(placer, c.x, c.y, c.z)) return false;
  }
  for (const c of cells) {
    world.setBlock(c.x, c.y, c.z, def.closedId);
  }
  return true;
}

function connectedStructCells(world, x, y, z) {
  const startId = world.terrain.blockAt(x, y, z);
  const type = structTypeForBlock(startId);
  if (!type) return [];
  const def = STRUCT_TYPES[type];
  const cells = [];
  const visited = new Set();
  const queue = [[x, y, z]];
  while (queue.length) {
    const [cx, cy, cz] = queue.shift();
    const k = `${cx},${cy},${cz}`;
    if (visited.has(k)) continue;
    visited.add(k);
    if (Math.abs(cx - x) > 5 || Math.abs(cy - y) > 5 || Math.abs(cz - z) > 5) continue;
    const id = world.terrain.blockAt(cx, cy, cz);
    if (id !== def.closedId && id !== def.openId) continue;
    cells.push([cx, cy, cz]);
    queue.push([cx + 1, cy, cz], [cx - 1, cy, cz],
               [cx, cy + 1, cz], [cx, cy - 1, cz],
               [cx, cy, cz + 1], [cx, cy, cz - 1]);
  }
  return cells;
}

export function tryToggleDoor(world, x, y, z) {
  const id = world.terrain.blockAt(x, y, z);
  const type = structTypeForBlock(id);
  if (!type) return false;
  const def = STRUCT_TYPES[type];
  if (def.closedId === def.openId) return false; // Not toggleable (bed)
  const cells = connectedStructCells(world, x, y, z);
  if (cells.length === 0) return false;
  const newId = id === def.closedId ? def.openId : def.closedId;
  for (const [cx, cy, cz] of cells) {
    if (world.terrain.blockAt(cx, cy, cz) !== newId) {
      world.setBlock(cx, cy, cz, newId);
    }
  }
  return true;
}

export function removeDoor(world, x, y, z) {
  const id = world.terrain.blockAt(x, y, z);
  const type = structTypeForBlock(id);
  if (!type) return null;
  const cells = connectedStructCells(world, x, y, z);
  for (const [cx, cy, cz] of cells) {
    world.setBlock(cx, cy, cz, BLOCKS.AIR);
  }
  return type;
}
