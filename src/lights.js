import * as THREE from 'three';

// Spawns / removes a THREE.PointLight at every electrical lamp cell that is currently
// powered. Wiring: subscribe a PowerNetwork instance via setPowerSource(network) and
// the light state will follow the network's lampPowerState map. Capped to keep frame
// budget reasonable; FIFO eviction when full.
export class LightManager {
  constructor(scene, max = 40) {
    this.scene = scene;
    this.max = max;
    this.lights = new Map(); // "x,y,z" -> PointLight
  }

  setPowerSource(network) {
    network.onChange((lampPowerState) => this.applyLampState(lampPowerState));
    this.applyLampState(network.lampPowerState);
  }

  applyLampState(lampPowerState) {
    // Evict lights whose lamp no longer exists.
    for (const k of [...this.lights.keys()]) {
      if (!lampPowerState.has(k)) this._remove(k);
    }
    // Add/remove lights based on each lamp's powered flag.
    for (const [k, isPowered] of lampPowerState) {
      const has = this.lights.has(k);
      if (isPowered && !has) this._add(k);
      else if (!isPowered && has) this._remove(k);
    }
  }

  _add(k) {
    if (this.lights.size >= this.max) {
      const oldestKey = this.lights.keys().next().value;
      this._remove(oldestKey);
    }
    const [x, y, z] = k.split(',').map(Number);
    const l = new THREE.PointLight(0xfff0c0, 1.6, 12, 1.6);
    l.position.set(x + 0.5, y + 0.7, z + 0.5);
    l.castShadow = false;
    this.scene.add(l);
    this.lights.set(k, l);
  }

  _remove(k) {
    const l = this.lights.get(k);
    if (!l) return;
    this.scene.remove(l);
    this.lights.delete(k);
  }
}
