import * as THREE from 'three';
import { Inventory } from './inventory.js';
import { Mining } from './mining.js';
import { Survival } from './survival.js';
import { BLOCKS } from './blocks.js';
import { ITEM_DEFS, dropFor } from './items.js';

// Per-player gameplay state for multiplayer. Holds position, kinematics, look angles,
// inventory, mining progress, and survival meters. Pure data + small methods — does
// not touch the camera, scene, or DOM. The Game class drives one of these per peer
// using their synced DefaultInput.
//
// Mouse-look pattern (from netplayjs FPS example): netplayjs.Game's pointerLock=true
// makes DefaultInput.mousePosition accumulate movementX/Y under pointer-lock. We
// store lastMouseX/Y in player state and compute delta in tick() — so each peer's
// own mouse drives only their own player's yaw/pitch.

const HEIGHT = 1.7;
const RADIUS = 0.3;
const GRAVITY = 28;
const JUMP_V = 9.2;
const MOVE_SPEED = 5.4;
const MOUSE_SENS = 0.0025;

export class MPPlayer {
  constructor(spawnX = 0.5, spawnY = 14, spawnZ = 0.5) {
    this.x = spawnX; this.y = spawnY; this.z = spawnZ;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;
    this.lastMouseX = null; this.lastMouseY = null;
    this.onGround = false;
    this.alive = true;

    this.inventory = new Inventory(18, 9);
    this.inventory.add('pickaxe', 1);
    this.inventory.add('shovel', 1);
    this.inventory.add('axe', 1);
    this.inventory.add('concrete', 16);
    this.inventory.add('wood', 12);
    this.inventory.add('buttress', 6);
    this.inventory.add('torch', 8);
    this.inventory.add('wire', 16);
    this.inventory.add('water_tank', 1);
    this.inventory.add('food_locker', 1);
    this.inventory.add('generator', 1);
    this.inventory.add('bed', 1);
    this.inventory.setActive(0);

    this.mining = new Mining();
    this.survival = new Survival();
  }

  get position() { return { x: this.x, y: this.y, z: this.z }; }

  // FPS-style: accumulate yaw/pitch from synced mousePosition deltas.
  applyLook(input) {
    if (!input.mousePosition) return;
    if (this.lastMouseX !== null) {
      this.yaw   -= (input.mousePosition.x - this.lastMouseX) * MOUSE_SENS;
      this.pitch -= (input.mousePosition.y - this.lastMouseY) * MOUSE_SENS;
      const lim = Math.PI / 2 - 0.01;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    }
    this.lastMouseX = input.mousePosition.x;
    this.lastMouseY = input.mousePosition.y;
  }

  applyMovement(input, world, dt) {
    const wasd = input.wasd();
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const rgtX =  Math.cos(this.yaw), rgtZ = -Math.sin(this.yaw);
    let mx = fwdX * wasd.y + rgtX * wasd.x;
    let mz = fwdZ * wasd.y + rgtZ * wasd.x;
    const mag = Math.hypot(mx, mz);
    if (mag > 0) { mx /= mag; mz /= mag; }
    this.vx = mx * MOVE_SPEED;
    this.vz = mz * MOVE_SPEED;

    this.vy -= GRAVITY * dt;
    if (input.keysPressed?.[' '] && this.onGround) {
      this.vy = JUMP_V;
      this.onGround = false;
    }
    this.onGround = false;
    this._collideAndMove(world, dt);
  }

  _collideAndMove(world, dt) {
    const move = { x: this.vx * dt, y: this.vy * dt, z: this.vz * dt };
    for (const axis of ['x', 'y', 'z']) {
      this[axis] += move[axis];
      const minX = this.x - RADIUS, maxX = this.x + RADIUS;
      const minY = this.y - HEIGHT, maxY = this.y + 0.2;
      const minZ = this.z - RADIUS, maxZ = this.z + RADIUS;
      const ix0 = Math.floor(minX), ix1 = Math.floor(maxX);
      const iy0 = Math.floor(minY), iy1 = Math.floor(maxY);
      const iz0 = Math.floor(minZ), iz1 = Math.floor(maxZ);
      for (let x = ix0; x <= ix1; x++)
      for (let y = iy0; y <= iy1; y++)
      for (let z = iz0; z <= iz1; z++) {
        if (!world.isSolid(x, y, z)) continue;
        if (axis === 'x') {
          if (move.x > 0) this.x = x - RADIUS - 1e-4;
          else if (move.x < 0) this.x = (x + 1) + RADIUS + 1e-4;
          this.vx = 0;
        } else if (axis === 'y') {
          if (move.y > 0) { this.y = y - 0.2 - 1e-4; this.vy = 0; }
          else if (move.y < 0) {
            this.y = (y + 1) + HEIGHT + 1e-4;
            this.vy = 0; this.onGround = true;
          }
        } else {
          if (move.z > 0) this.z = z - RADIUS - 1e-4;
          else if (move.z < 0) this.z = (z + 1) + RADIUS + 1e-4;
          this.vz = 0;
        }
      }
    }
  }

  applyInventoryActions(input) {
    const pressed = input.keysPressed ?? {};
    for (const key of Object.keys(pressed)) {
      const m = /^invswap:(\d+):(\d+)$/.exec(key);
      if (!m) continue;
      const from = parseInt(m[1], 10);
      const to = parseInt(m[2], 10);
      this.inventory.swapSlots(from, to);
      this.mining.cancel();
    }
  }

  applyHotbar(input) {
    for (const k of ['1','2','3','4','5','6','7','8','9']) {
      if (!input.keysPressed?.[k]) continue;
      let idx = parseInt(k, 10) - 1;
      if (idx >= 0 && idx < this.inventory.hotbarSize) {
        this.inventory.setActive(idx);
        this.mining.cancel();
      }
    }
  }

  // Returns the raycast result from eye position along look direction.
  raycast(world) {
    const dx = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const dy =  Math.sin(this.pitch);
    const dz = -Math.cos(this.yaw) * Math.cos(this.pitch);
    const origin = new THREE.Vector3(this.x, this.y, this.z);
    const dir = new THREE.Vector3(dx, dy, dz);
    return world.raycast(origin, dir, 6);
  }

  // Hold-to-mine. Returns { x, y, z } of the broken cell on completion, else null.
  applyMining(input, world, dt) {
    const holdMine = !!input.keysHeld?.['f'];
    if (!holdMine) {
      this.mining.cancel();
      return null;
    }
    const r = this.raycast(world);
    if (!r) {
      this.mining.cancel();
      return null;
    }
    const tool = this.inventory.activeTool();
    const drop = dropFor(r.hit.id);
    if (drop && !this.inventory.canAdd(drop, 1)) {
      // Inventory full — refuse to mine. Caller can show a toast for the local player.
      this.mining.cancel();
      return { invFull: true };
    }
    if (!this.mining.matches(r.hit.x, r.hit.y, r.hit.z, r.hit.id, tool)) {
      this.mining.start(r.hit.x, r.hit.y, r.hit.z, r.hit.id, tool);
    }
    if (this.mining.tick(dt)) {
      const { x, y, z } = r.hit;
      world.setBlock(x, y, z, BLOCKS.AIR);
      if (drop) this.inventory.add(drop, 1);
      this.mining.cancel();
      return { x, y, z, broke: true };
    }
    return null;
  }

  // Press-to-place. Returns { x, y, z } of placed cell on completion, else null.
  applyPlace(input, world) {
    if (!input.keysPressed?.['r']) return null;
    const r = this.raycast(world);
    if (!r) return null;
    const blockSlot = this.inventory.activeBlockItem();
    if (!blockSlot) return null;
    const def = ITEM_DEFS[blockSlot.item];
    const p = r.place;
    // Don't place inside the player AABB.
    const px0 = Math.floor(this.x - RADIUS), px1 = Math.floor(this.x + RADIUS);
    const py0 = Math.floor(this.y - HEIGHT), py1 = Math.floor(this.y + 0.2);
    const pz0 = Math.floor(this.z - RADIUS), pz1 = Math.floor(this.z + RADIUS);
    if (p.x >= px0 && p.x <= px1 && p.y >= py0 && p.y <= py1 && p.z >= pz0 && p.z <= pz1) return null;
    world.setBlock(p.x, p.y, p.z, def.blockId);
    this.inventory.consumeActive();
    return { x: p.x, y: p.y, z: p.z, placed: true };
  }

  serialize() {
    return {
      x: this.x, y: this.y, z: this.z,
      yaw: this.yaw, pitch: this.pitch,
      alive: this.alive,
    };
  }

  deserialize(s) {
    this.x = s.x; this.y = s.y; this.z = s.z;
    this.yaw = s.yaw; this.pitch = s.pitch;
    this.alive = s.alive;
  }
}
