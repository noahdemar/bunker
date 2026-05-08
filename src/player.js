import * as THREE from 'three';

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(0.5, 14, 0.5);
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.HEIGHT = 1.7;
    this.RADIUS = 0.3;
    this.GRAVITY = 28;
    this.JUMP_V = 9.2;
    this.MOVE_SPEED = 5.4;
    this.yaw = 0;
    this.pitch = 0;
  }

  spawnOnSurface(terrain) {
    const h = terrain.baseHeight(0, 0) ?? 1;
    this.position.set(0.5, h + 2.0, 0.5);
    this.velocity.set(0, 0, 0);
  }

  applyMouse(dx, dy) {
    this.yaw -= dx * 0.0025;
    this.pitch -= dy * 0.0025;
    const lim = Math.PI / 2 - 0.01;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }

  update(input, dt) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (input.W) wish.add(fwd);
    if (input.S) wish.sub(fwd);
    if (input.D) wish.add(right);
    if (input.A) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(this.MOVE_SPEED);

    this.velocity.x = wish.x;
    this.velocity.z = wish.z;
    this.velocity.y -= this.GRAVITY * dt;
    if (input.Space && this.onGround) {
      this.velocity.y = this.JUMP_V;
      this.onGround = false;
    }
    this.onGround = false;
    this._collideAndMove(dt);

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  _collideAndMove(dt) {
    const move = this.velocity.clone().multiplyScalar(dt);
    for (const axis of ['x', 'y', 'z']) {
      this.position[axis] += move[axis];
      const minX = this.position.x - this.RADIUS;
      const maxX = this.position.x + this.RADIUS;
      const minY = this.position.y - this.HEIGHT;
      const maxY = this.position.y + 0.2;
      const minZ = this.position.z - this.RADIUS;
      const maxZ = this.position.z + this.RADIUS;
      const ix0 = Math.floor(minX), ix1 = Math.floor(maxX);
      const iy0 = Math.floor(minY), iy1 = Math.floor(maxY);
      const iz0 = Math.floor(minZ), iz1 = Math.floor(maxZ);

      for (let x = ix0; x <= ix1; x++)
      for (let y = iy0; y <= iy1; y++)
      for (let z = iz0; z <= iz1; z++) {
        if (!this.world.isSolid(x, y, z)) continue;
        if (axis === 'x') {
          if (move.x > 0) this.position.x = x - this.RADIUS - 1e-4;
          else if (move.x < 0) this.position.x = (x + 1) + this.RADIUS + 1e-4;
          this.velocity.x = 0;
        } else if (axis === 'y') {
          if (move.y > 0) {
            this.position.y = y - 0.2 - 1e-4;
            this.velocity.y = 0;
          } else if (move.y < 0) {
            this.position.y = (y + 1) + this.HEIGHT + 1e-4;
            this.velocity.y = 0;
            this.onGround = true;
          }
        } else {
          if (move.z > 0) this.position.z = z - this.RADIUS - 1e-4;
          else if (move.z < 0) this.position.z = (z + 1) + this.RADIUS + 1e-4;
          this.velocity.z = 0;
        }
      }
    }
  }
}
