import * as THREE from 'three';

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Pleasant pre-bomb day: warm sun, soft hemisphere, light fog.
    const sky = new THREE.Color(0xc6d4d8);
    scene.background = sky;
    scene.fog = new THREE.Fog(0xc6d4d8, 35, 130);
    renderer.setClearColor(scene.background);

    this.hemi = new THREE.HemisphereLight(0xeae3cf, 0x4a5238, 0.65);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffe9c0, 1.05);
    this.sun.position.set(60, 90, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.fill = new THREE.AmbientLight(0xfff3df, 0.22);
    scene.add(this.fill);
  }

  followTarget(pos) {
    // Keep the shadow camera centered on the player so shadows don't disappear at distance.
    this.sun.target.position.set(pos.x, pos.y, pos.z);
    this.sun.position.set(pos.x + 60, pos.y + 90, pos.z + 40);
  }

  applyApocalypse() {
    const ash = new THREE.Color(0x3a1a0e);
    this.scene.background = ash;
    this.scene.fog.color.copy(ash);
    this.scene.fog.near = 8;
    this.scene.fog.far = 50;
    this.renderer.setClearColor(ash);
    this.hemi.color.setHex(0xa64a26);
    this.hemi.groundColor.setHex(0x140805);
    this.hemi.intensity = 0.7;
    this.sun.color.setHex(0xff6a30);
    this.sun.intensity = 0.85;
  }
}
