import * as THREE from 'three';

export class BlockOutline {
  constructor(scene) {
    this.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04));
    this.material = new THREE.LineBasicMaterial({
      color: 0xfff2a8,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    this.mesh = new THREE.LineSegments(this.geometry, this.material);
    this.mesh.renderOrder = 999;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  show(x, y, z) {
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}
