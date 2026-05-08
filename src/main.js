import * as THREE from 'three';
import { Atmosphere } from './atmosphere.js';
import { makeTerrain } from './terrain.js';
import { World } from './world.js';
import { Player } from './player.js';
import { HUD } from './hud.js';
import { BombSequence } from './bomb.js';
import { BLOCKS } from './blocks.js';
import { ITEM_DEFS, dropFor } from './items.js';
import { Inventory } from './inventory.js';
import { Mining } from './mining.js';
import { HotbarUI, setMiningProgress } from './hotbar.js';
import { LightManager } from './lights.js';
import { applyStability } from './stability.js';
import { FallingBlocks } from './falling.js';
import { DeviceManager } from './devices.js';
import { Survival } from './survival.js';
import { MetersHUD } from './metershud.js';
import { BlockOutline } from './blockoutline.js';
import { PowerNetwork } from './power.js';
import { tryPlaceDoor, tryToggleDoor, removeDoor, isDoorBlock } from './doors.js';

// --- renderer + scene ---
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const canvas = renderer.domElement;
document.getElementById('app').appendChild(canvas);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const scene = new THREE.Scene();
const atmosphere = new Atmosphere(scene, renderer);

const seed = Math.floor(Math.random() * 100000);
const terrain = makeTerrain(seed, 48);
const world = new World(scene, terrain);
const blockOutline = new BlockOutline(scene);
const player = new Player(camera, world);
player.spawnOnSurface(terrain);
const hud = new HUD(30 * 60);
const bomb = new BombSequence(scene, camera, world, atmosphere);

// --- inventory + tools ---
const inventory = new Inventory(18, 9);
inventory.add('pickaxe', 1);
inventory.add('shovel', 1);
inventory.add('axe', 1);
inventory.add('concrete', 16);
inventory.add('wood', 12);
inventory.add('buttress', 6);
inventory.add('torch', 8);
inventory.add('wire', 16);
inventory.add('water_tank', 1);
inventory.add('food_locker', 1);
inventory.add('generator', 1);
inventory.add('bed', 1);
inventory.add('door', 2);
inventory.add('vault_door', 1);
inventory.setActive(0);
const hotbar = new HotbarUI(inventory);
const mining = new Mining();

// --- falling-block entities (cave-in physics) ---
const falling = new FallingBlocks(scene, world, world.geo, world.materials);
function spawnFalling(x, y, z, blockId) { falling.spawn(x, y, z, blockId); }
const SP_STABILITY_LIMIT = { maxCells: 32, maxIters: 2, shouldCollapse: (x, y, z) => !isPlayerSupportCell(x, y, z) };

function isPlayerSupportCell(x, y, z) {
  const px0 = Math.floor(player.position.x - player.RADIUS - 0.75);
  const px1 = Math.floor(player.position.x + player.RADIUS + 0.75);
  const py0 = Math.floor(player.position.y - player.HEIGHT - 1);
  const py1 = Math.floor(player.position.y + 0.2);
  const pz0 = Math.floor(player.position.z - player.RADIUS - 0.75);
  const pz1 = Math.floor(player.position.z + player.RADIUS + 0.75);
  return x >= px0 && x <= px1 && y >= py0 && y <= py1 && z >= pz0 && z <= pz1;
}

// --- devices + survival ---
const devices = new DeviceManager(world);
const survival = new Survival();
const metersHud = new MetersHUD(survival);
const survivalTimerEl = document.getElementById('survivaltimer');

// --- electric power network + lighting ---
// Lights only emit when a generator (with charge > 0) is reachable through the
// 6-block proximity graph of generator/wire/light cells. PowerNetwork rebuilds the
// graph whenever an electrical block is placed/mined/collapsed, and refresh() is
// called each tick so lights flick off the moment a generator's tank runs dry.
const power = new PowerNetwork(world, devices);
const lights = new LightManager(scene, 40);
lights.setPowerSource(power);

// --- pointer lock + input ---
const overlay = document.getElementById('overlay');
let locked = false;
const input = { W: false, A: false, S: false, D: false, Space: false };
const mouse = { left: false, right: false };

function clearGameplayInput() {
  input.W = false;
  input.A = false;
  input.S = false;
  input.D = false;
  input.Space = false;
  mouse.left = false;
  mining.cancel();
  setMiningProgress(0);
}

overlay.addEventListener('click', () => {
  if (!hud.fired && !hotbar.isInventoryOpen()) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!hud.fired) overlay.classList.toggle('hidden', locked || hotbar.isInventoryOpen());
  if (!locked) clearGameplayInput();
});
document.addEventListener('mousemove', (e) => {
  if (locked) player.applyMouse(e.movementX, e.movementY);
});

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    if (hud.gameOver) return;
    if (!hotbar.isInventoryOpen() && !overlay.classList.contains('hidden')) return;
    e.preventDefault();
    const open = hotbar.toggleInventory();
    clearGameplayInput();
    if (open) {
      document.exitPointerLock?.();
    } else {
      canvas.requestPointerLock();
    }
    return;
  }
  if (hotbar.isInventoryOpen()) return;
  // Toggle door under crosshair.
  if (e.code === 'KeyT' && locked) {
    const r = currentRaycast();
    if (r && isDoorBlock(world.terrain.blockAt(r.hit.x, r.hit.y, r.hit.z))) {
      tryToggleDoor(world, r.hit.x, r.hit.y, r.hit.z);
      return;
    }
  }
  switch (e.code) {
    case 'KeyW': input.W = true; break;
    case 'KeyA': input.A = true; break;
    case 'KeyS': input.S = true; break;
    case 'KeyD': input.D = true; break;
    case 'Space': input.Space = true; break;
  }
  if (e.code.startsWith('Digit')) {
    let idx = parseInt(e.code.slice(5), 10) - 1;
    if (idx >= 0 && idx < inventory.hotbarSize) {
      inventory.setActive(idx);
      mining.cancel();
      setMiningProgress(0);
    }
  }
});
addEventListener('keyup', (e) => {
  if (hotbar.isInventoryOpen()) return;
  switch (e.code) {
    case 'KeyW': input.W = false; break;
    case 'KeyA': input.A = false; break;
    case 'KeyS': input.S = false; break;
    case 'KeyD': input.D = false; break;
    case 'Space': input.Space = false; break;
  }
});
addEventListener('wheel', (e) => {
  if (!locked || hotbar.isInventoryOpen()) return;
  const dir = Math.sign(e.deltaY);
  const next = (inventory.active + dir + inventory.hotbarSize) % inventory.hotbarSize;
  inventory.setActive(next);
  mining.cancel();
  setMiningProgress(0);
}, { passive: true });

addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousedown', (e) => {
  if (!locked || hotbar.isInventoryOpen()) return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) {
    // single-action place
    const r = currentRaycast();
    if (!r) return;
    const blockSlot = inventory.activeBlockItem();
    if (!blockSlot) return;
    const def = ITEM_DEFS[blockSlot.item];
    const p = r.place;
    // don't place inside player AABB
    const px0 = Math.floor(player.position.x - player.RADIUS);
    const px1 = Math.floor(player.position.x + player.RADIUS);
    const py0 = Math.floor(player.position.y - player.HEIGHT);
    const py1 = Math.floor(player.position.y + 0.2);
    const pz0 = Math.floor(player.position.z - player.RADIUS);
    const pz1 = Math.floor(player.position.z + player.RADIUS);
    if (p.x >= px0 && p.x <= px1 && p.y >= py0 && p.y <= py1 && p.z >= pz0 && p.z <= pz1) return;

    // Multi-cell doors take a different placement path.
    if (def.multiCell) {
      const placer = { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw };
      if (tryPlaceDoor(world, placer, p, def.multiCell.type)) {
        inventory.consumeActive();
      }
      return;
    }

    world.setBlock(p.x, p.y, p.z, def.blockId);
    inventory.consumeActive();
    // Mid-air placements with no chain to bedrock collapse and fall.
    applyStability(world, p.x, p.y, p.z, spawnFalling, SP_STABILITY_LIMIT);
  }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    mouse.left = false;
    mining.cancel();
    setMiningProgress(0);
  }
});

function currentRaycast() {
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return world.raycast(origin, dir, 6);
}

function updateBlockOutline() {
  if (!locked || hotbar.isInventoryOpen()) {
    blockOutline.hide();
    return;
  }
  const r = currentRaycast();
  if (r) blockOutline.show(r.hit.x, r.hit.y, r.hit.z);
  else blockOutline.hide();
}

function tickMining(dt) {
  if (!mouse.left) {
    if (mining.isActive()) { mining.cancel(); setMiningProgress(0); }
    return;
  }
  const r = currentRaycast();
  if (!r) {
    if (mining.isActive()) { mining.cancel(); setMiningProgress(0); }
    return;
  }
  const tool = inventory.activeTool();
  // Inventory-full gate: don't even start mining if we can't accept the drop.
  const wouldDrop = dropFor(r.hit.id);
  if (wouldDrop && !inventory.canAdd(wouldDrop, 1)) {
    if (mining.isActive()) { mining.cancel(); setMiningProgress(0); }
    hotbar.showToast('INVENTORY FULL');
    return;
  }
  if (!mining.matches(r.hit.x, r.hit.y, r.hit.z, r.hit.id, tool)) {
    mining.start(r.hit.x, r.hit.y, r.hit.z, r.hit.id, tool);
  }
  if (mining.tick(dt)) {
    const drop = dropFor(r.hit.id);
    const mx = r.hit.x, my = r.hit.y, mz = r.hit.z;
    if (isDoorBlock(r.hit.id)) {
      // Whole door comes apart; one item refunded.
      const itemId = removeDoor(world, mx, my, mz);
      if (itemId) inventory.add(itemId, 1);
    } else {
      world.setBlock(mx, my, mz, BLOCKS.AIR);
      if (drop) inventory.add(drop, 1);
    }
    mining.cancel();
    setMiningProgress(0);
    // Stability: pulled material may de-anchor neighbors; cave-in blocks fall as entities.
    applyStability(world, mx, my, mz, spawnFalling, SP_STABILITY_LIMIT);
  } else {
    setMiningProgress(mining.progress());
  }
}

// --- main loop ---
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!hotbar.isInventoryOpen() && (locked || bomb.detonated)) player.update(input, dt);
  atmosphere.followTarget(player.position);
  falling.update(dt);

  if (locked && !hotbar.isInventoryOpen()) tickMining(dt);
  updateBlockOutline();
  power.refresh();

  if (hud.update(dt)) {
    const epi = new THREE.Vector3(
      player.position.x + (Math.random() - 0.5) * 8,
      player.position.y + 25,
      player.position.z + (Math.random() - 0.5) * 8,
    );
    bomb.detonate(epi);
    setTimeout(() => {
      if (!isPlayerSealed()) {
        hud.showResult('died-exposed');
        document.exitPointerLock?.();
        locked = false;
      } else {
        // Sealed → enter survival sim. Meters drain; nearby devices replenish.
        survival.arm();
        survivalTimerEl.style.display = 'block';
      }
    }, 6500);
  }
  bomb.update(dt);

  // Survival sim runs once armed (post-bomb).
  if (survival.armed && !survival.dead && !hud.gameOver) {
    if (survival.update(dt, devices, player.position)) {
      hud.showResult('died-' + survival.deathCause);
      document.exitPointerLock?.();
      locked = false;
    } else {
      const m = Math.floor(survival.survivalTime / 60);
      const s = Math.floor(survival.survivalTime % 60);
      survivalTimerEl.textContent = `SURVIVAL ${m}:${s.toString().padStart(2, '0')}`;
      // 10-minute survival window → rescue.
      if (survival.survivalTime >= 600) {
        hud.showResult('rescued');
        document.exitPointerLock?.();
        locked = false;
      }
    }
  }
  metersHud.update();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

function isPlayerSealed() {
  const start = {
    x: Math.floor(player.position.x),
    y: Math.floor(player.position.y - 1),
    z: Math.floor(player.position.z),
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
    if (dx*dx + dy*dy + dz*dz > RADIUS2) return false;
    for (const [nx, ny, nz] of NB) {
      const ax = c.x + nx, ay = c.y + ny, az = c.z + nz;
      if (terrain.blockAt(ax, ay, az) === BLOCKS.AIR) queue.push({ x: ax, y: ay, z: az });
    }
  }
  return true;
}
