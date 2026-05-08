import * as THREE from 'three';
import { BLOCKS, isBombResistant } from './blocks.js';

export class BombSequence {
  constructor(scene, camera, world, atmosphere) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.atmosphere = atmosphere;
    this.detonated = false;
    this.t = 0;
    this.flashEl = document.getElementById('flash');
    this.shake = 0;
  }

  detonate(epicenter) {
    this.detonated = true;
    this.t = 0;
    this.epicenter = epicenter.clone();

    // Flash
    this.flashEl.style.transition = 'opacity 0.05s linear';
    this.flashEl.style.opacity = '1';
    setTimeout(() => {
      this.flashEl.style.transition = 'opacity 3.5s ease-out';
      this.flashEl.style.opacity = '0';
    }, 220);

    this.shake = 1.4;
    this.atmosphere.applyApocalypse();

    // Destruction shockwave a moment later (for visual punch).
    setTimeout(() => this._destroy(), 380);
  }

  _destroy() {
    const RAD = 38;
    const epi = this.epicenter;
    const t = this.world.terrain;
    const R = t.radius;
    const toRemove = [];

    for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const baseH = t.baseHeight(x, z);
      // Find highest non-air y at this column (covers placed blocks/trees/etc).
      let topY = baseH;
      for (let y = baseH + 1; y <= 26; y++) {
        if (t.blockAt(x, y, z) !== BLOCKS.AIR) topY = y;
      }
      for (let y = topY; y >= baseH - 4; y--) {
        const id = t.blockAt(x, y, z);
        if (id === BLOCKS.AIR) continue;
        const dx = x - epi.x, dy = y - epi.y, dz = z - epi.z;
        const d3 = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d3 > RAD) continue;
        // Resistance: bomb-resistant only survives near the outer 60% of the radius
        if (isBombResistant(id) && d3 > RAD * 0.45) continue;
        toRemove.push([x, y, z]);
      }
    }
    for (const [x, y, z] of toRemove) {
      this.world.setBlock(x, y, z, BLOCKS.AIR);
    }
  }

  update(dt) {
    if (!this.detonated) return;
    this.t += dt;
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 0.6);
    }
  }
}
