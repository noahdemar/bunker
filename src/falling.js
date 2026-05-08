import * as THREE from 'three';
import { BLOCKS } from './blocks.js';

// One free-falling block. Visually a single Mesh sharing the world's box geometry +
// per-type material array. When it reaches a cell whose floor is solid it snaps to
// that cell and writes back into the voxel grid. Stacking is handled by walking up
// to the first air cell — so multiple falling blocks land on top of each other.
export class FallingBlocks {
  constructor(scene, world, geo, materials) {
    this.scene = scene;
    this.world = world;
    this.geo = geo;
    this.materials = materials;
    this.active = [];
    this.GRAVITY = 22;
    this.MAX_FALL_VY = 30;
  }

  spawn(x, y, z, blockId) {
    const mat = this.materials[blockId];
    if (!mat) return;
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.active.push({ mesh, x, z, y: y + 0.5, vy: 0, blockId });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      f.vy = Math.max(-this.MAX_FALL_VY, f.vy - this.GRAVITY * dt);
      f.y += f.vy * dt;
      f.mesh.position.y = f.y;

      // Cell currently occupied by the entity's center.
      const curCellY = Math.floor(f.y);
      const belowSolid = this.world.isSolid(f.x, curCellY - 1, f.z);

      if (belowSolid) {
        // Walk up to the first air cell — handles stacking when several blocks pile up.
        let settleY = curCellY;
        const limit = curCellY + 16;
        while (
          settleY < limit &&
          this.world.terrain.blockAt(f.x, settleY, f.z) !== BLOCKS.AIR
        ) {
          settleY++;
        }
        this.world.setBlock(f.x, settleY, f.z, f.blockId);
        this.scene.remove(f.mesh);
        this.active.splice(i, 1);
        continue;
      }

      if (f.y < -40) {
        // Fell off the world.
        this.scene.remove(f.mesh);
        this.active.splice(i, 1);
      }
    }
  }
}
