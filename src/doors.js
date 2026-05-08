import { BLOCKS } from './blocks.js';

// Doors and vault doors. Each door is a multi-cell structure where every cell holds
// the same block ID — DOOR_CLOSED/OPEN for 1×2 wood doors, VAULT_CLOSED/OPEN for 3×2
// vault doors. State (closed vs open) lives in the cell itself, so the door's full
// state is implicitly part of world.terrain.edits and rides the same MP sync path
// as every other block edit.
//
// Connectivity is recovered with a small bounded flood-fill, so we don't keep a
// separate "door registry". This means two adjacent doors of the same type would
// merge — placement intentionally requires every target cell to be air, so adjacency
// only happens if a player deliberately stacks them.

const DOOR_TYPES = {
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
};

export function isDoorBlock(id) {
  return id === BLOCKS.DOOR_CLOSED  || id === BLOCKS.DOOR_OPEN
      || id === BLOCKS.VAULT_CLOSED || id === BLOCKS.VAULT_OPEN;
}

export function isDoorPassable(id) {
  return id === BLOCKS.DOOR_OPEN || id === BLOCKS.VAULT_OPEN;
}

function doorTypeForBlock(id) {
  if (id === BLOCKS.DOOR_CLOSED  || id === BLOCKS.DOOR_OPEN)  return 'door';
  if (id === BLOCKS.VAULT_CLOSED || id === BLOCKS.VAULT_OPEN) return 'vault_door';
  return null;
}

function cellsForDoor(type, anchor, axis) {
  const def = DOOR_TYPES[type];
  const cells = [];
  if (def.width === 1) {
    for (let dy = 0; dy < def.height; dy++) {
      cells.push({ x: anchor.x, y: anchor.y + dy, z: anchor.z });
    }
    return cells;
  }
  // 3×2: 3 cells along the chosen horizontal axis, 2 stacked vertically.
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

// Try to place a door of `type` with its anchor at `place`. Returns true on success.
// `placer` must expose { x, y, z, yaw } so we can choose the vault door's horizontal
// axis (perpendicular to the placer's facing) and avoid placing inside their AABB.
export function tryPlaceDoor(world, placer, place, type) {
  const def = DOOR_TYPES[type];
  if (!def) return false;
  // Vault axis: perpendicular to player's primary facing direction.
  const facingX = Math.abs(Math.sin(placer.yaw)) > Math.abs(Math.cos(placer.yaw));
  const axis = def.width === 1 ? 'x' : (facingX ? 'z' : 'x');
  const cells = cellsForDoor(type, place, axis);
  for (const c of cells) {
    if (world.terrain.blockAt(c.x, c.y, c.z) !== BLOCKS.AIR) return false;
    if (cellInsidePlayer(placer, c.x, c.y, c.z)) return false;
  }
  for (const c of cells) {
    world.setBlock(c.x, c.y, c.z, def.closedId);
  }
  return true;
}

// Bounded flood-fill: every connected cell of the same door type, within a 5-cell
// radius of the seed (covers a 3×2 vault door comfortably).
function connectedDoorCells(world, x, y, z) {
  const startId = world.terrain.blockAt(x, y, z);
  if (!isDoorBlock(startId)) return [];
  const type = doorTypeForBlock(startId);
  const def = DOOR_TYPES[type];
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

// Toggle every connected cell of the door at (x,y,z) between closed and open.
export function tryToggleDoor(world, x, y, z) {
  const id = world.terrain.blockAt(x, y, z);
  if (!isDoorBlock(id)) return false;
  const type = doorTypeForBlock(id);
  const def = DOOR_TYPES[type];
  const cells = connectedDoorCells(world, x, y, z);
  if (cells.length === 0) return false;
  const newId = id === def.closedId ? def.openId : def.closedId;
  for (const [cx, cy, cz] of cells) {
    if (world.terrain.blockAt(cx, cy, cz) !== newId) {
      world.setBlock(cx, cy, cz, newId);
    }
  }
  return true;
}

// Remove the entire door given any cell. Returns the item id ('door' / 'vault_door')
// to refund to the breaker, or null if the cell wasn't a door.
export function removeDoor(world, x, y, z) {
  const id = world.terrain.blockAt(x, y, z);
  if (!isDoorBlock(id)) return null;
  const type = doorTypeForBlock(id);
  const cells = connectedDoorCells(world, x, y, z);
  for (const [cx, cy, cz] of cells) {
    world.setBlock(cx, cy, cz, BLOCKS.AIR);
  }
  return type;
}
