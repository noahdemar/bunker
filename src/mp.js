import * as THREE from 'three';
import * as netplayjs from 'netplayjs';
import { Atmosphere } from './atmosphere.js';
import { makeTerrain } from './terrain.js';
import { World } from './world.js';
import { BLOCKS } from './blocks.js';

// Multiplayer Bunker — keyboard-only, third-person, lockstep-deterministic.
// Each peer runs the full game; netplayjs syncs inputs/state via WebRTC.
//
// Trimmed feature set vs single-player so state-per-tick stays small:
//   - Shared procedural world (seed = 1337)
//   - Player avatars (cube), auto-orient toward movement
//   - Keyboard place/break of CONCRETE one cell forward
//   - No survival sim, no inventory, no falling-block physics, no bomb sequence
//
// Run two browser tabs, share the host link printed by netplayjs.

const PLAYER_COLORS = [0x4080c0, 0xc04040, 0x40c060, 0xc0a040];
const SPEED = 5.5;
const GRAVITY = 22;
const JUMP_V = 8.0;
const PLAYER_HALF_HEIGHT = 0.8;
const SEED = 1337;
const WORLD_R = 30;

class BunkerMPGame extends netplayjs.Game {
  static timestep = 1000 / 30;
  static canvasSize = { width: 1280, height: 720 };
  static deterministic = true;

  constructor(canvas, players) {
    super();
    this.players = players;
    this.localPlayer = players.find(p => p.isLocalPlayer());

    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.background = '#000';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(BunkerMPGame.canvasSize.width, BunkerMPGame.canvasSize.height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.atmosphere = new Atmosphere(this.scene, this.renderer);
    this.terrain = makeTerrain(SEED, WORLD_R);
    this.world = new World(this.scene, this.terrain);

    this.camera = new THREE.PerspectiveCamera(
      75,
      BunkerMPGame.canvasSize.width / BunkerMPGame.canvasSize.height,
      0.1, 500,
    );

    this.avatars = new Map(); // playerID -> { mesh, x, y, z, vy, yaw }
    const baseH = this.terrain.baseHeight(0, 0) ?? 1;
    for (let i = 0; i < players.length; i++) {
      const id = players[i].getID();
      const mat = new THREE.MeshStandardMaterial({
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        roughness: 0.7,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.avatars.set(id, {
        mesh,
        x: i * 1.5 - 0.75,
        y: baseH + 2.5,
        z: 0.5,
        vy: 0,
        yaw: 0,
      });
    }
  }

  // Lockstep tick — applies each player's input to its avatar deterministically.
  tick(playerInputs) {
    const DT = BunkerMPGame.timestep / 1000;

    for (const [player, input] of playerInputs) {
      const av = this.avatars.get(player.getID());
      if (!av) continue;

      const wasd = input.wasd();          // {x: D-A, y: W-S}
      let mx = wasd.x, mz = -wasd.y;      // forward (W) goes -Z
      const mag = Math.hypot(mx, mz);
      if (mag > 0) {
        mx /= mag; mz /= mag;
        av.x += mx * SPEED * DT;
        av.z += mz * SPEED * DT;
        av.yaw = Math.atan2(mx, -mz);
      }

      // Jump
      const grounded = this._grounded(av);
      if (input.keysPressed?.[' '] && grounded) av.vy = JUMP_V;

      // Gravity + simple ground collide
      av.vy -= GRAVITY * DT;
      av.y += av.vy * DT;
      const fx = Math.floor(av.x), fz = Math.floor(av.z);
      const feetY = Math.floor(av.y - PLAYER_HALF_HEIGHT);
      if (this.world.isSolid(fx, feetY, fz)) {
        av.y = feetY + 1 + PLAYER_HALF_HEIGHT;
        av.vy = 0;
      }

      // Edits — single press only (avoid stream while held).
      const fwd = this._forwardCell(av, 1);
      if (input.keysPressed?.['e'] && this._inBounds(fwd)) {
        if (this.terrain.blockAt(fwd.x, fwd.y, fwd.z) === BLOCKS.AIR) {
          this.world.setBlock(fwd.x, fwd.y, fwd.z, BLOCKS.CONCRETE);
        }
      }
      if (input.keysPressed?.['q'] && this._inBounds(fwd)) {
        if (this.terrain.blockAt(fwd.x, fwd.y, fwd.z) !== BLOCKS.AIR) {
          this.world.setBlock(fwd.x, fwd.y, fwd.z, BLOCKS.AIR);
        }
      }

      av.mesh.position.set(av.x, av.y - 0.1, av.z);
      av.mesh.rotation.y = av.yaw;
    }
  }

  _grounded(av) {
    const fx = Math.floor(av.x), fz = Math.floor(av.z);
    const below = Math.floor(av.y - PLAYER_HALF_HEIGHT - 0.05);
    return this.world.isSolid(fx, below, fz);
  }

  _forwardCell(av, dist) {
    const cx = av.x + Math.sin(av.yaw) * dist;
    const cz = av.z - Math.cos(av.yaw) * dist;
    return { x: Math.floor(cx), y: Math.floor(av.y), z: Math.floor(cz) };
  }

  _inBounds(c) {
    const r = this.terrain.radius;
    return Math.abs(c.x) <= r && Math.abs(c.z) <= r && c.y >= -8 && c.y <= 24;
  }

  draw(canvas) {
    const av = this.avatars.get(this.localPlayer.getID());
    if (av) {
      // Third-person camera trailing the player along their yaw.
      const angle = av.yaw + Math.PI;
      this.camera.position.set(
        av.x + Math.sin(angle) * 6.5,
        av.y + 4.5,
        av.z + Math.cos(angle) * 6.5,
      );
      this.camera.lookAt(av.x, av.y + 0.5, av.z);
      this.atmosphere.followTarget(new THREE.Vector3(av.x, av.y, av.z));
    }
    this.renderer.render(this.scene, this.camera);
  }

  // State sync — terrain edits (sparse map) + per-player kinematics.
  serialize() {
    const avatars = {};
    for (const [id, av] of this.avatars) {
      avatars[id] = { x: av.x, y: av.y, z: av.z, vy: av.vy, yaw: av.yaw };
    }
    const edits = [];
    for (const [k, id] of this.terrain.edits) {
      const [x, y, z] = k.split(',').map(Number);
      edits.push([x, y, z, id]);
    }
    return { avatars, edits };
  }

  deserialize(state) {
    for (const idStr in state.avatars) {
      const id = Number(idStr);
      const av = this.avatars.get(id);
      if (!av) continue;
      const s = state.avatars[idStr];
      av.x = s.x; av.y = s.y; av.z = s.z; av.vy = s.vy; av.yaw = s.yaw;
      av.mesh.position.set(av.x, av.y - 0.1, av.z);
      av.mesh.rotation.y = av.yaw;
    }
    // Diff edits — apply incoming, revert any local edit not in incoming.
    const incoming = new Map();
    for (const [x, y, z, id] of state.edits) {
      incoming.set(`${x},${y},${z}`, id);
    }
    for (const k of [...this.terrain.edits.keys()]) {
      if (!incoming.has(k)) {
        const [x, y, z] = k.split(',').map(Number);
        this.world.setBlock(x, y, z, this.terrain.baseBlockAt(x, y, z));
      }
    }
    for (const [k, id] of incoming) {
      const [x, y, z] = k.split(',').map(Number);
      if (this.terrain.blockAt(x, y, z) !== id) {
        this.world.setBlock(x, y, z, id);
      }
    }
  }
}

new netplayjs.LockstepWrapper(BunkerMPGame).start();
