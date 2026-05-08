import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { makeBlockMaterials } from './textures.js';

// Renders the terrain via per-block-type InstancedMesh.
// Maintains a sparse "instance" map: world position -> { type, index } for incremental updates.
// Visibility = "non-air block with at least one air-neighbor" (faces hidden by neighbors are skipped).
const NEIGHBORS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

export class World {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.materials = makeBlockMaterials();
    this.meshes = {};        // typeId -> InstancedMesh
    this.indexToKey = {};    // typeId -> array; the inverse of instanceMap for swap-remove
    this.instanceMap = new Map(); // "x,y,z" -> { type, index }
    this._dummy = new THREE.Object3D();
    this._mat4 = new THREE.Matrix4();
    this.changeListeners = []; // (x, y, z, prev, next) — fires on every setBlock that changes state
    this._build();
  }

  onChange(fn) { this.changeListeners.push(fn); }

  _isVisible(x, y, z) {
    if (this.terrain.blockAt(x, y, z) === BLOCKS.AIR) return false;
    for (const [dx, dy, dz] of NEIGHBORS) {
      if (this.terrain.blockAt(x + dx, y + dy, z + dz) === BLOCKS.AIR) return true;
    }
    return false;
  }

  _build() {
    const r = this.terrain.radius;
    const Y_LO = -8, Y_HI = 24;
    const visible = {};
    for (const id of Object.values(BLOCKS)) {
      if (id === BLOCKS.AIR) continue;
      visible[id] = [];
    }

    for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) {
      for (let y = Y_LO; y <= Y_HI; y++) {
        const id = this.terrain.blockAt(x, y, z);
        if (id === BLOCKS.AIR) continue;
        if (!this._isVisible(x, y, z)) continue;
        visible[id].push([x, y, z]);
      }
    }

    const PAD = 3000; // headroom for placed concrete
    for (const id of Object.values(BLOCKS)) {
      if (id === BLOCKS.AIR) continue;
      const cap = visible[id].length + PAD;
      const m = new THREE.InstancedMesh(this.geo, this.materials[id], cap);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      this.meshes[id] = m;
      this.indexToKey[id] = new Array(cap);
      this.scene.add(m);

      const list = visible[id];
      for (let i = 0; i < list.length; i++) {
        const [x, y, z] = list[i];
        this._dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        this._dummy.updateMatrix();
        m.setMatrixAt(i, this._dummy.matrix);
        const k = `${x},${y},${z}`;
        this.indexToKey[id][i] = k;
        this.instanceMap.set(k, { type: id, index: i });
      }
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  _addInstance(x, y, z, typeId) {
    const k = `${x},${y},${z}`;
    if (this.instanceMap.has(k)) return;
    const m = this.meshes[typeId];
    const cap = m.instanceMatrix.count;
    if (m.count >= cap) {
      // realloc not implemented; drop silently
      return;
    }
    this._dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
    this._dummy.updateMatrix();
    m.setMatrixAt(m.count, this._dummy.matrix);
    this.indexToKey[typeId][m.count] = k;
    this.instanceMap.set(k, { type: typeId, index: m.count });
    m.count++;
    m.instanceMatrix.needsUpdate = true;
  }

  _removeInstance(x, y, z) {
    const k = `${x},${y},${z}`;
    const e = this.instanceMap.get(k);
    if (!e) return;
    const { type, index } = e;
    const m = this.meshes[type];
    const last = m.count - 1;
    if (index !== last) {
      m.getMatrixAt(last, this._mat4);
      m.setMatrixAt(index, this._mat4);
      const lastKey = this.indexToKey[type][last];
      this.indexToKey[type][index] = lastKey;
      this.instanceMap.set(lastKey, { type, index });
    }
    this.indexToKey[type][last] = null;
    m.count--;
    m.instanceMatrix.needsUpdate = true;
    this.instanceMap.delete(k);
  }

  // After a block change at (x,y,z), refresh that cell + 6 neighbors' visibility.
  _refreshAround(x, y, z) {
    const cells = [[x,y,z],[x+1,y,z],[x-1,y,z],[x,y+1,z],[x,y-1,z],[x,y,z+1],[x,y,z-1]];
    for (const [px, py, pz] of cells) {
      const k = `${px},${py},${pz}`;
      const id = this.terrain.blockAt(px, py, pz);
      const visible = id !== BLOCKS.AIR && this._isVisible(px, py, pz);
      const has = this.instanceMap.get(k);
      if (has && (!visible || has.type !== id)) this._removeInstance(px, py, pz);
      if (visible && !this.instanceMap.has(k)) this._addInstance(px, py, pz, id);
    }
  }

  setBlock(x, y, z, id) {
    const prev = this.terrain.blockAt(x, y, z);
    if (prev === id) return;
    this.terrain.setBlock(x, y, z, id);
    this._refreshAround(x, y, z);
    for (const fn of this.changeListeners) fn(x, y, z, prev, id);
  }

  // Solid for movement collision. Leaves, lights, buttresses, and wires are passable.
  isSolid(x, y, z) {
    const id = this.terrain.blockAt(x, y, z);
    return id !== BLOCKS.AIR
      && id !== BLOCKS.LEAVES
      && id !== BLOCKS.TORCH
      && id !== BLOCKS.BUTTRESS
      && id !== BLOCKS.WIRE;
  }

  // Voxel raycast (Amanatides–Woo). Returns { hit:{x,y,z,id}, place:{x,y,z}, normal:[dx,dy,dz] } or null.
  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(dir.x) | 0;
    const sy = Math.sign(dir.y) | 0;
    const sz = Math.sign(dir.z) | 0;
    const tDx = sx === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDy = sy === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDz = sz === 0 ? Infinity : Math.abs(1 / dir.z);
    const fx = origin.x - x, fy = origin.y - y, fz = origin.z - z;
    let tMx = sx > 0 ? (1 - fx) * tDx : sx < 0 ? fx * tDx : Infinity;
    let tMy = sy > 0 ? (1 - fy) * tDy : sy < 0 ? fy * tDy : Infinity;
    let tMz = sz > 0 ? (1 - fz) * tDz : sz < 0 ? fz * tDz : Infinity;
    let face = [0, 0, 0];
    let dist = 0;
    while (dist <= maxDist) {
      const id = this.terrain.blockAt(x, y, z);
      if (id !== BLOCKS.AIR) {
        return {
          hit:    { x, y, z, id },
          place:  { x: x + face[0], y: y + face[1], z: z + face[2] },
          normal: face,
        };
      }
      if (tMx < tMy && tMx < tMz) {
        x += sx; dist = tMx; tMx += tDx; face = [-sx, 0, 0];
      } else if (tMy < tMz) {
        y += sy; dist = tMy; tMy += tDy; face = [0, -sy, 0];
      } else {
        z += sz; dist = tMz; tMz += tDz; face = [0, 0, -sz];
      }
    }
    return null;
  }
}
