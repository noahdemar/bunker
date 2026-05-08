import * as THREE from 'three';

// Manages PointLights for placed light blocks. Capped to keep frame budget reasonable;
// when full, the oldest light is evicted.
export class LightManager {
  constructor(scene, max = 40) {
    this.scene = scene;
    this.max = max;
    this.lights = new Map(); // "x,y,z" -> PointLight
  }

  add(x, y, z) {
    const k = `${x},${y},${z}`;
    if (this.lights.has(k)) return;
    if (this.lights.size >= this.max) {
      // FIFO eviction. Map iteration order is insertion order in JS.
      const oldestKey = this.lights.keys().next().value;
      const old = this.lights.get(oldestKey);
      this.scene.remove(old);
      this.lights.delete(oldestKey);
    }
    const l = new THREE.PointLight(0xffaa55, 1.6, 12, 1.6);
    l.position.set(x + 0.5, y + 0.7, z + 0.5);
    l.castShadow = false;
    this.scene.add(l);
    this.lights.set(k, l);
  }

  remove(x, y, z) {
    const k = `${x},${y},${z}`;
    const l = this.lights.get(k);
    if (!l) return;
    this.scene.remove(l);
    this.lights.delete(k);
  }
}
