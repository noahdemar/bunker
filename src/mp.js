import * as THREE from 'three';
import * as netplayjs from 'netplayjs';
import { Atmosphere } from './atmosphere.js';
import { makeTerrain } from './terrain.js';
import { World } from './world.js';
import { BLOCKS } from './blocks.js';
import { LightManager } from './lights.js';
import { applyStability } from './stability.js';
import { DeviceManager } from './devices.js';
import { PowerNetwork } from './power.js';
import { HotbarUI, setMiningProgress } from './hotbar.js';
import { MetersHUD } from './metershud.js';
import { MPPlayer } from './mpplayer.js';
import { BlockOutline } from './blockoutline.js';
import { applyCartToInventory, catalogItem, cartCost, PLAYER_BUDGET } from './lobby.js';
import { LobbyUI } from './lobbyui.js';

const LOBBY_AUTO_START_MS = 100000;

// Multiplayer Bunker — full single-player feature set ported into a netplayjs Game.
//
// Mouse-look uses the FPS-example pattern: pointerLock=true makes DefaultInput
// .mousePosition accumulate movementX/Y under the lock; each player's last seen
// mousePosition is stored in MPPlayer state and the delta becomes yaw/pitch.
//
// netplayjs's DefaultInput doesn't sync mouse buttons, so we bind hold-to-mine to
// F and place-block to R (everything else matches single-player).
//
// State that's synced: timer, bomb-phase machine, per-player transform/alive state,
// and terrain edits. Local-only: camera shake, flash overlay timing, UI, and lights.

const SEED = 1337;
const WORLD_R = 30;
const COUNTDOWN = 30 * 60;
const BOMB_FLASH_MS = 400;
const BOMB_DESTROY_MS = 6000;
const SURVIVAL_GOAL = 600;        // 10-minute rescue window
const BOMB_RADIUS = 38;
const MP_STABILITY_LIMIT = { maxCells: 10, maxIters: 1 };

const COLORS = [0x4a90d0, 0xd05050, 0x6ac060, 0xd0a040, 0x9050c0, 0xe0a0c0];

// netplayjs LockstepNetcode.processLocalInput calls pollInput() twice per frame —
// the first result is broadcast, the second is queued for local execution. Since
// DefaultInputReader.getInput() clears keysPressed on every call, the locally
// queued input arrives empty for press-style keys (jump, hotbar 1-9, R/T/E
// virtual keys) — only keysHeld survives. Cache the first result for the
// duration of the synchronous tick so both calls return the same input. Also
// fold our virtual-key queue (mouse buttons, inventory swap) in here, replacing
// the lazy override that used to live in _dispatchVirtualKey.
window.__heldVirtualKeys = window.__heldVirtualKeys ?? new Set();
window.__pressedVirtualKeys = window.__pressedVirtualKeys ?? [];

const _origGetInput = netplayjs.DefaultInputReader.prototype.getInput;
let _frameCachedInput = null;
function _cloneInput(src) {
  const dst = new netplayjs.DefaultInput();
  dst.keysPressed = { ...src.keysPressed };
  dst.keysHeld = { ...src.keysHeld };
  dst.keysReleased = { ...src.keysReleased };
  if (src.mousePosition) dst.mousePosition = { ...src.mousePosition };
  dst.touches = src.touches ? src.touches.map((t) => ({ ...t })) : [];
  return dst;
}
netplayjs.DefaultInputReader.prototype.getInput = function () {
  if (_frameCachedInput) return _cloneInput(_frameCachedInput);
  const input = _origGetInput.call(this);
  for (const k of window.__pressedVirtualKeys) {
    input.keysPressed[k] = true;
    input.keysHeld[k] = true;
  }
  for (const k of window.__heldVirtualKeys) {
    input.keysHeld[k] = true;
  }
  window.__pressedVirtualKeys = [];
  _frameCachedInput = input;
  queueMicrotask(() => { _frameCachedInput = null; });
  return _cloneInput(input);
};

class BunkerMPGame extends netplayjs.Game {
  static timestep = 1000 / 60;
  static canvasSize = { width: 1280, height: 720 };
  static pointerLock = true;
  static deterministic = true;

  constructor(canvas, players) {
    super();
    this.players = players;
    this.localPlayer = players.find(p => p.isLocalPlayer());
    this.canvas = canvas;
    this._virtualMouseKeys = { f: false, r: false };
    this._movementKeys = ['w', 'a', 's', 'd', ' '];

    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(BunkerMPGame.canvasSize.width, BunkerMPGame.canvasSize.height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.atmosphere = new Atmosphere(this.scene, this.renderer);
    this.terrain = makeTerrain(SEED, WORLD_R);
    this.world = new World(this.scene, this.terrain);
    this.blockOutline = new BlockOutline(this.scene);
    this.devices = new DeviceManager(this.world);
    this.power = new PowerNetwork(this.world, this.devices);
    this.lights = new LightManager(this.scene, 40);
    this.lights.setPowerSource(this.power);

    // Per-player gameplay state. Remote players also get a small avatar mesh so the
    // local view sees them moving around.
    this.mp = new Map();
    this.avatars = new Map();
    const baseH = this.terrain.baseHeight(0, 0) ?? 1;
    for (let i = 0; i < players.length; i++) {
      const id = players[i].getID();
      const ps = new MPPlayer(i * 1.5 - 0.75 + 0.5, baseH + 2.5, 0.5, { skipLoadout: true });
      this.mp.set(id, ps);
      if (id !== this.localPlayer.getID()) {
        const mat = new THREE.MeshStandardMaterial({
          color: COLORS[i % COLORS.length], roughness: 0.7,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), mat);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.avatars.set(id, mesh);
      }
    }

    this.camera = new THREE.PerspectiveCamera(
      75,
      BunkerMPGame.canvasSize.width / BunkerMPGame.canvasSize.height,
      0.1, 500,
    );

    // Synced game state.
    this.gameState = 'LOBBY';    // LOBBY | PLAYING
    this.lobbyCarts = {};        // playerID → { catalogId: count }
    this.lobbyReady = {};        // playerID → bool
    this.lobbyStartCountdown = 0; // ms remaining once everyone is ready (cancellable)
    this.lobbyMaxTimer = LOBBY_AUTO_START_MS; // maximum lobby time
    for (const p of players) {
      this.lobbyCarts[p.getID()] = {};
      this.lobbyReady[p.getID()] = false;
    }
    this.timer = COUNTDOWN;
    this.bombPhase = 'NONE';     // NONE | FLASH | DESTROY | ARMED
    this.bombT = 0;
    this.epicenter = null;

    // Local-only HUD wired to local player.
    const localPS = this.mp.get(this.localPlayer.getID());
    this.hotbar = new HotbarUI(localPS.inventory, {
      onSwap: (from, to) => this._queueInventorySwap(from, to),
    });
    this.metersHud = new MetersHUD(localPS.survival);
    this.timerEl = document.getElementById('timer');
    this.survivalTimerEl = document.getElementById('survivaltimer');
    this.flashEl = document.getElementById('flash');
    this.toastEl = document.getElementById('toast');
    this.overlayEl = document.getElementById('overlay');

    this._toastTimer = null;
    this._localShake = 0;
    this._appliedApocalypse = false;
    this._lastBombPhase = 'NONE';

    this.lobbyUI = new LobbyUI(this.localPlayer.getID(), (action) => this._handleLobbyAction(action));
    if (this.gameState === 'LOBBY') {
      this.lobbyUI.show();
      document.exitPointerLock?.();
      this._refreshLobbyUI();
    }

    document.addEventListener('contextmenu', this._handleContextMenu);
    document.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('keydown', this._handleKeyDown, true);
    document.addEventListener('pointerlockchange', this._handlePointerLockChange);
    window.addEventListener('blur', this._releaseVirtualMouseKeys);
  }

  _showToast(text, ttl = 1400) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('visible');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('visible'), ttl);
  }

  _isMouseInputActive() {
    return document.pointerLockElement === this.canvas;
  }

  _dispatchVirtualKey(type, key) {
    if (key.startsWith('lobby:')) console.info('[lobby] dispatch', type, key);
    if (type === 'keydown') {
      window.__pressedVirtualKeys.push(key);
      window.__heldVirtualKeys.add(key);
    } else if (type === 'keyup') {
      window.__heldVirtualKeys.delete(key);
    }
  }

  _setVirtualMouseKey(key, down) {
    if (this._virtualMouseKeys[key] === down) return;
    this._virtualMouseKeys[key] = down;
    this._dispatchVirtualKey(down ? 'keydown' : 'keyup', key);
  }

  _queueInventorySwap(from, to) {
    const key = `invswap:${from}:${to}`;
    this._dispatchVirtualKey('keydown', key);
    this._dispatchVirtualKey('keyup', key);
  }

  _releaseMovementKeys() {
    for (const key of this._movementKeys) this._dispatchVirtualKey('keyup', key);
  }

  _releaseVirtualMouseKeys = () => {
    this._setVirtualMouseKey('f', false);
    this._setVirtualMouseKey('r', false);
  };

  _clearLocalGameplayInput() {
    this._releaseVirtualMouseKeys();
    this._releaseMovementKeys();
  }

  _handleKeyDown = (e) => {
    if (this.gameState === 'LOBBY') return;
    if (e.code !== 'KeyE') return;
    if (!this.hotbar) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    // E is overloaded: with the inventory open it always closes it. Otherwise,
    // if the crosshair is on an interactable (door, vault, bed) we send a
    // synced 'interact' tick so all peers apply the same state change. Only
    // when nothing under the crosshair will accept it do we open the inventory.
    if (!this.hotbar.isInventoryOpen() && this._isMouseInputActive()) {
      const localPS = this.mp.get(this.localPlayer.getID());
      const r = localPS?.alive ? localPS.raycast(this.world) : null;
      const id = r ? this.world.terrain.blockAt(r.hit.x, r.hit.y, r.hit.z) : 0;
      if (id === BLOCKS.DOOR_CLOSED || id === BLOCKS.DOOR_OPEN
       || id === BLOCKS.VAULT_CLOSED || id === BLOCKS.VAULT_OPEN) {
        this._dispatchVirtualKey('keydown', 'interact');
        this._dispatchVirtualKey('keyup', 'interact');
        return;
      }
      if (id === BLOCKS.BED) {
        this._dispatchVirtualKey('keydown', 'interact');
        this._dispatchVirtualKey('keyup', 'interact');
        return;
      }
    }
    const open = this.hotbar.toggleInventory();
    this._clearLocalGameplayInput();
    if (open) {
      document.exitPointerLock?.();
    } else {
      this.canvas.requestPointerLock();
    }
  };

  _handleContextMenu = (e) => {
    if (this._isMouseInputActive()) e.preventDefault();
  };

  _handleMouseDown = (e) => {
    if (this.gameState === 'LOBBY') return;
    if (this.hotbar?.isInventoryOpen()) return;
    if (!this._isMouseInputActive()) return;
    if (e.button === 0) {
      e.preventDefault();
      this._setVirtualMouseKey('f', true);
    }
    if (e.button === 2) {
      e.preventDefault();
      this._setVirtualMouseKey('r', true);
    }
  };

  _handleMouseUp = (e) => {
    if (e.button === 0) this._setVirtualMouseKey('f', false);
    if (e.button === 2) this._setVirtualMouseKey('r', false);
  };

  _handlePointerLockChange = () => {
    if (!this._isMouseInputActive()) this._clearLocalGameplayInput();
  };

  _showOverlay(title, body) {
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.querySelector('.panel').innerHTML =
      `<h1>${title}</h1><p>${body}</p>`
      + `<p style="opacity:0.7;margin-top:14px;">Reload to play again.</p>`;
  }

  // -- Lobby phase --

  _refreshLobbyUI() {
    const labels = this.players.map((p, i) => ({
      id: p.getID(),
      label: `Player ${i + 1}`,
    }));
    this.lobbyUI.update({
      carts: this.lobbyCarts,
      ready: this.lobbyReady,
      players: labels,
      starting: this.lobbyStartCountdown > 0 ? this.lobbyStartCountdown / 1000 : 0,
      maxTimer: this.lobbyMaxTimer / 1000,
    });
  }

  _lobbyBuy(playerID, catalogId) {
    const item = catalogItem(catalogId);
    if (!item) return;
    const cart = this.lobbyCarts[playerID] || (this.lobbyCarts[playerID] = {});
    if (cartCost(cart) + item.price > PLAYER_BUDGET) return;
    cart[catalogId] = (cart[catalogId] || 0) + 1;
    this.lobbyReady[playerID] = false; // edits invalidate ready
    this.lobbyStartCountdown = 0;
  }

  _lobbyUnbuy(playerID, catalogId) {
    const cart = this.lobbyCarts[playerID];
    if (!cart || !cart[catalogId]) return;
    cart[catalogId]--;
    if (cart[catalogId] <= 0) delete cart[catalogId];
    this.lobbyReady[playerID] = false;
    this.lobbyStartCountdown = 0;
  }

  _handleLobbyAction(action) {
    const localID = this.localPlayer.getID();
    const buyMatch = /^lobby:buy:(.+)$/.exec(action);
    const unbuyMatch = /^lobby:unbuy:(.+)$/.exec(action);
    if (buyMatch) {
      this._lobbyBuy(localID, buyMatch[1]);
      this._refreshLobbyUI();
    } else if (unbuyMatch) {
      this._lobbyUnbuy(localID, unbuyMatch[1]);
      this._refreshLobbyUI();
    } else if (action === 'lobby:ready') {
      this.lobbyReady[localID] = true;
      this._refreshLobbyUI();
      this._startGame();
    }
  }

  _startGame() {
    for (const [pid, ps] of this.mp) {
      applyCartToInventory(ps.inventory, this.lobbyCarts[pid] || {});
      ps.inventory.setActive(0);
    }
    this.gameState = 'PLAYING';
    this.lobbyUI.hide();
    console.info('[lobby] game starting with carts', this.lobbyCarts);
  }

  tickLobby(playerInputs) {
    const DT_MS = BunkerMPGame.timestep;
    let changed = false;

    if (this.lobbyMaxTimer > 0) {
      this.lobbyMaxTimer -= DT_MS;
      changed = true;
      if (this.lobbyMaxTimer <= 0) {
        this._startGame();
        return;
      }
    }

    if (changed) this._refreshLobbyUI();
  }

  tick(playerInputs) {
    if (this.gameState === 'LOBBY') {
      this.tickLobby(playerInputs);
      return;
    }
    const DT = BunkerMPGame.timestep / 1000;
    const localID = this.localPlayer.getID();

    for (const [player, input] of playerInputs) {
      const id = player.getID();
      const ps = this.mp.get(id);
      if (!ps || !ps.alive) continue;

      ps.applyLook(input);
      ps.applyMovement(input, this.world, DT);
      ps.applyInventoryActions(input);
      ps.applyHotbar(input);

      const mineEvt = ps.applyMining(input, this.world, DT);
      if (mineEvt?.broke) {
        applyStability(this.world, mineEvt.x, mineEvt.y, mineEvt.z, null, MP_STABILITY_LIMIT);
      }
      if (mineEvt?.invFull && id === localID) {
        this._showToast('INVENTORY FULL');
      }

      const placeEvt = ps.applyPlace(input, this.world);
      if (placeEvt?.placed) {
        applyStability(this.world, placeEvt.x, placeEvt.y, placeEvt.z, null, MP_STABILITY_LIMIT);
      }

      ps.applyInteract(input, this.world);

      if (ps.survival.armed && !ps.survival.dead) {
        ps.survival.update(DT, this.devices, ps.position);
        if (ps.survival.dead) ps.alive = false;
      }
    }

    // Power network — recompute generator-driven lights once per tick so charge
    // depletion (driven by survival) flicks lights off when fuel runs out.
    this.power.refresh();

    // Bomb state machine — pre-bomb counts down, then phases through flash/destroy/armed.
    if (this.bombPhase === 'NONE') {
      this.timer = Math.max(0, this.timer - DT);
      if (this.timer <= 0) {
        this.bombPhase = 'FLASH';
        this.bombT = 0;
        this.epicenter = { x: 0, y: 30, z: 0 };
        this._localShake = 1.4;
      }
    } else {
      this.bombT += DT * 1000;
      if (this.bombPhase === 'FLASH' && this.bombT > BOMB_FLASH_MS) {
        runDestruction(this.world, this.epicenter, BOMB_RADIUS);
        this.bombPhase = 'DESTROY';
        this.bombT = 0;
      } else if (this.bombPhase === 'DESTROY' && this.bombT > BOMB_DESTROY_MS) {
        for (const ps of this.mp.values()) {
          if (!ps.alive) continue;
          if (isPlayerSealed(this.world, ps, this.terrain)) {
            ps.survival.arm();
          } else {
            ps.alive = false;
            ps.survival.dead = true;
            ps.survival.deathCause = 'exposed';
          }
        }
        this.bombPhase = 'ARMED';
        this.bombT = 0;
      }
    }
  }

  draw(canvas) {
    const localPS = this.mp.get(this.localPlayer.getID());

    if (this.gameState === 'LOBBY') {
      // Floating overhead camera so the world is a living backdrop behind the lobby.
      const t = performance.now() * 0.0002;
      this.camera.position.set(Math.sin(t) * 16, 22, Math.cos(t) * 16);
      this.camera.lookAt(0, 6, 0);
      this.atmosphere.followTarget(new THREE.Vector3(0, 6, 0));
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Remote avatars
    for (const [id, mesh] of this.avatars) {
      const ps = this.mp.get(id);
      if (!ps) continue;
      mesh.position.set(ps.x, ps.y - 0.85, ps.z);
      mesh.rotation.y = ps.yaw;
      mesh.visible = ps.alive;
    }

    // Local first-person camera
    this.camera.position.set(localPS.x, localPS.y, localPS.z);
    this.camera.rotation.set(localPS.pitch, localPS.yaw, 0, 'YXZ');

    // Local-only effects driven by bombPhase
    if (this.bombPhase === 'FLASH' && this.bombT < 220) {
      this.flashEl.style.transition = 'opacity 0.05s linear';
      this.flashEl.style.opacity = '1';
    } else if (this.bombPhase !== 'NONE') {
      this.flashEl.style.transition = 'opacity 3.5s ease-out';
      this.flashEl.style.opacity = '0';
    }
    if ((this.bombPhase === 'DESTROY' || this.bombPhase === 'ARMED') && !this._appliedApocalypse) {
      this.atmosphere.applyApocalypse();
      this._appliedApocalypse = true;
    }
    if (this._isMouseInputActive() && !this.hotbar?.isInventoryOpen() && localPS.alive) {
      const r = localPS.raycast(this.world);
      if (r) this.blockOutline.show(r.hit.x, r.hit.y, r.hit.z);
      else this.blockOutline.hide();
    } else {
      this.blockOutline.hide();
    }
    if (this._localShake > 0) {
      const s = this._localShake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this._localShake = Math.max(0, this._localShake - 0.6 * (BunkerMPGame.timestep / 1000));
    }

    this.atmosphere.followTarget(new THREE.Vector3(localPS.x, localPS.y, localPS.z));
    this.renderer.render(this.scene, this.camera);

    // Local-only HUD
    const t = this.timer;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.timerEl.classList.toggle('warn', this.bombPhase === 'NONE' && t <= 60 && t > 10);
    this.timerEl.classList.toggle('critical', this.bombPhase === 'NONE' && t <= 10);

    setMiningProgress(localPS.mining.isActive() ? localPS.mining.progress() : 0);
    this.metersHud.update();

    if (this.bombPhase === 'ARMED') {
      this.survivalTimerEl.style.display = 'block';
      const st = localPS.survival.survivalTime;
      this.survivalTimerEl.textContent =
        `SURVIVAL ${Math.floor(st / 60)}:${Math.floor(st % 60).toString().padStart(2, '0')}`;
    } else {
      this.survivalTimerEl.style.display = 'none';
    }

    if (!localPS.alive) {
      this._showOverlay('YOU DIED', overlayBodyForCause(localPS.survival.deathCause));
    } else if (this.bombPhase === 'ARMED' && localPS.survival.survivalTime >= SURVIVAL_GOAL) {
      this._showOverlay('RESCUED', 'Your bunker held. Help has arrived.');
    } else {
      this.overlayEl.classList.add('hidden');
    }
  }

  serialize() {
    const players = {};
    for (const [id, ps] of this.mp) players[id] = ps.serialize();
    const edits = [];
    for (const [k, id] of this.terrain.edits) {
      const [x, y, z] = k.split(',').map(Number);
      edits.push([x, y, z, id]);
    }
    return {
      gameState: this.gameState,
      lobbyCarts: this.lobbyCarts,
      lobbyReady: this.lobbyReady,
      lobbyStartCountdown: this.lobbyStartCountdown,
      lobbyMaxTimer: this.lobbyMaxTimer,
      prevLobbyKeys: this.prevLobbyKeys,
      timer: this.timer,
      bombPhase: this.bombPhase, bombT: this.bombT, epicenter: this.epicenter,
      players, edits,
    };
  }

  deserialize(state) {
    const wasLobby = this.gameState === 'LOBBY';
    this.gameState = state.gameState ?? this.gameState;
    if (state.lobbyCarts) this.lobbyCarts = state.lobbyCarts;
    if (state.lobbyReady) this.lobbyReady = state.lobbyReady;
    if (typeof state.lobbyStartCountdown === 'number') {
      this.lobbyStartCountdown = state.lobbyStartCountdown;
    }
    if (typeof state.lobbyMaxTimer === 'number') {
      this.lobbyMaxTimer = state.lobbyMaxTimer;
    }
    if (state.prevLobbyKeys) this.prevLobbyKeys = state.prevLobbyKeys;
    this.timer = state.timer;
    this.bombPhase = state.bombPhase;
    this.bombT = state.bombT;
    this.epicenter = state.epicenter;

    if (wasLobby && this.gameState === 'PLAYING') {
      // Mid-flight transition (host started game while we were still in lobby UI).
      this.lobbyUI.hide();
    } else if (this.gameState === 'LOBBY') {
      this._refreshLobbyUI();
    }

    for (const idStr in state.players) {
      const id = Number(idStr);
      const ps = this.mp.get(id);
      if (ps) ps.deserialize(state.players[idStr]);
    }

    // Apply edits diff against the current world.
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

// Radial destruction — same shape as single-player BombSequence._destroy().
function runDestruction(world, epicenter, RAD) {
  const t = world.terrain;
  const R = t.radius;
  const toRemove = [];
  for (let x = -R; x <= R; x++)
  for (let z = -R; z <= R; z++) {
    const baseH = t.baseHeight(x, z);
    let topY = baseH;
    for (let y = baseH + 1; y <= 26; y++) {
      if (t.blockAt(x, y, z) !== BLOCKS.AIR) topY = y;
    }
    for (let y = topY; y >= baseH - 4; y--) {
      const id = t.blockAt(x, y, z);
      if (id === BLOCKS.AIR) continue;
      const dx = x - epicenter.x, dy = y - epicenter.y, dz = z - epicenter.z;
      const d3 = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (d3 > RAD) continue;
      const isResistant = (id === BLOCKS.CONCRETE || id === BLOCKS.STONE);
      if (isResistant && d3 > RAD * 0.45) continue;
      toRemove.push([x, y, z]);
    }
  }
  for (const [x, y, z] of toRemove) world.setBlock(x, y, z, BLOCKS.AIR);
}

// BFS through air cells from the player's standing cell — escape outside the bubble
// means the player isn't sealed in by surrounding blocks.
function isPlayerSealed(world, ps, terrain) {
  const start = {
    x: Math.floor(ps.x),
    y: Math.floor(ps.y - 1),
    z: Math.floor(ps.z),
  };
  if (world.isSolid(start.x, start.y, start.z)) return true;
  const visited = new Set();
  const queue = [start];
  const RADIUS2 = 22 * 22;
  const NB = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  while (queue.length) {
    const c = queue.shift();
    const k = `${c.x},${c.y},${c.z}`;
    if (visited.has(k)) continue;
    visited.add(k);
    const dx = c.x - start.x, dy = c.y - start.y, dz = c.z - start.z;
    if (dx * dx + dy * dy + dz * dz > RADIUS2) return false;
    for (const [nx, ny, nz] of NB) {
      const ax = c.x + nx, ay = c.y + ny, az = c.z + nz;
      if (terrain.blockAt(ax, ay, az) === BLOCKS.AIR) queue.push({ x: ax, y: ay, z: az });
    }
  }
  return true;
}

function overlayBodyForCause(cause) {
  switch (cause) {
    case 'exposed':    return 'The bomb caught you in the open.';
    case 'thirst':     return 'You died of thirst — the water tank ran dry.';
    case 'starvation': return 'You died of starvation — the food locker ran dry.';
    default:           return 'Game over.';
  }
}

new netplayjs.LockstepWrapper(BunkerMPGame).start();
