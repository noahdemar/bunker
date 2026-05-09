import * as THREE from 'three';
import { BLOCKS } from './blocks.js';

const SIZE = 64;

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return [c, c.getContext('2d')];
}

function speckle(ctx, baseRGB, jitter) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * jitter;
    img.data[i]   = clamp(baseRGB[0] + n);
    img.data[i+1] = clamp(baseRGB[1] + n * 0.95);
    img.data[i+2] = clamp(baseRGB[2] + n * 0.9);
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const clamp = v => Math.max(0, Math.min(255, v));

function bevel(ctx, dark = 0.25) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, `rgba(255,255,255,${dark * 0.4})`);
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = `rgba(0,0,0,${dark * 1.2})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
}

function blotches(ctx, color, count, sizeRange) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = color;
    const r = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    ctx.beginPath();
    ctx.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

function grassTopTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [88, 130, 58], 38);
  blotches(ctx, 'rgba(110,160,70,0.35)', 18, [3, 8]);
  blotches(ctx, 'rgba(60,90,40,0.35)', 12, [2, 5]);
  bevel(ctx, 0.18);
  return texFromCanvas(c);
}
function dirtTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [115, 82, 55], 36);
  blotches(ctx, 'rgba(80,55,35,0.35)', 14, [3, 7]);
  blotches(ctx, 'rgba(150,110,80,0.20)', 10, [2, 5]);
  bevel(ctx, 0.22);
  return texFromCanvas(c);
}
function grassSideTex() {
  // dirt with green strip on top
  const [c, ctx] = makeCanvas();
  speckle(ctx, [115, 82, 55], 36);
  blotches(ctx, 'rgba(80,55,35,0.35)', 12, [3, 7]);
  // green top strip
  const stripH = 14;
  const grad = ctx.createLinearGradient(0, 0, 0, stripH);
  grad.addColorStop(0, '#5a8240');
  grad.addColorStop(1, 'rgba(90,130,64,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, stripH);
  // a few jagged grass tufts hanging down
  ctx.fillStyle = '#5e8a44';
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * SIZE + Math.random() * 2;
    const h = 8 + Math.random() * 8;
    ctx.fillRect(x, 8, 2, h);
  }
  bevel(ctx, 0.22);
  return texFromCanvas(c);
}
function stoneTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [128, 128, 130], 28);
  blotches(ctx, 'rgba(80,80,84,0.35)', 16, [3, 9]);
  blotches(ctx, 'rgba(170,170,172,0.18)', 10, [2, 5]);
  // crack lines
  ctx.strokeStyle = 'rgba(50,50,52,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * SIZE, Math.random() * SIZE);
    for (let s = 0; s < 4; s++) {
      ctx.lineTo(Math.random() * SIZE, Math.random() * SIZE);
    }
    ctx.stroke();
  }
  bevel(ctx, 0.22);
  return texFromCanvas(c);
}
function sandTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [220, 200, 150], 18);
  blotches(ctx, 'rgba(200,180,135,0.35)', 14, [4, 10]);
  bevel(ctx, 0.14);
  return texFromCanvas(c);
}
function woodSideTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [98, 70, 40], 20);
  // vertical grain
  for (let x = 2; x < SIZE; x += 4) {
    ctx.fillStyle = `rgba(60,40,22,${0.2 + Math.random() * 0.3})`;
    ctx.fillRect(x, 0, 1 + Math.random() * 2, SIZE);
  }
  bevel(ctx, 0.28);
  return texFromCanvas(c);
}
function woodTopTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [140, 100, 60], 18);
  // rings
  ctx.strokeStyle = 'rgba(70,48,28,0.55)';
  ctx.lineWidth = 1;
  for (let r = 4; r < SIZE / 2; r += 4 + Math.random() * 2) {
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  bevel(ctx, 0.2);
  return texFromCanvas(c);
}
function leavesTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [60, 100, 50], 30);
  blotches(ctx, 'rgba(90,140,70,0.45)', 22, [3, 6]);
  blotches(ctx, 'rgba(40,70,30,0.35)', 16, [2, 5]);
  bevel(ctx, 0.18);
  return texFromCanvas(c);
}
function waterTankSideTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [50, 110, 160], 18);
  // wave band
  ctx.fillStyle = 'rgba(220,235,250,0.55)';
  for (let y = SIZE * 0.4; y < SIZE * 0.6; y += 4) {
    ctx.beginPath();
    for (let x = 0; x <= SIZE; x += 4) {
      ctx.lineTo(x, y + Math.sin((x / SIZE) * Math.PI * 4) * 2);
    }
    ctx.lineTo(SIZE, y + 3);
    ctx.lineTo(0, y + 3);
    ctx.closePath();
    ctx.fill();
  }
  // bolt corners
  ctx.fillStyle = '#1c4868';
  for (const [bx, by] of [[4, 4], [SIZE - 8, 4], [4, SIZE - 8], [SIZE - 8, SIZE - 8]]) {
    ctx.fillRect(bx, by, 4, 4);
  }
  bevel(ctx, 0.32);
  return texFromCanvas(c);
}
function waterTankTopTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [40, 95, 140], 14);
  // ripples
  ctx.strokeStyle = 'rgba(220,235,250,0.4)';
  ctx.lineWidth = 1;
  for (let r = 4; r < SIZE / 2; r += 6) {
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  bevel(ctx, 0.32);
  return texFromCanvas(c);
}

function foodLockerSideTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [96, 64, 50], 18);
  // green band
  ctx.fillStyle = '#3a6c34';
  ctx.fillRect(0, SIZE * 0.42, SIZE, SIZE * 0.16);
  // stencil-style stripes on the band
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 4; x < SIZE; x += 12) {
    ctx.fillRect(x, SIZE * 0.46, 6, SIZE * 0.08);
  }
  // hinge dots
  ctx.fillStyle = '#181010';
  ctx.fillRect(SIZE * 0.10, SIZE * 0.18, 4, 4);
  ctx.fillRect(SIZE * 0.85, SIZE * 0.18, 4, 4);
  ctx.fillRect(SIZE * 0.10, SIZE * 0.78, 4, 4);
  ctx.fillRect(SIZE * 0.85, SIZE * 0.78, 4, 4);
  bevel(ctx, 0.30);
  return texFromCanvas(c);
}
function foodLockerTopTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [76, 50, 38], 16);
  // handle
  ctx.fillStyle = '#202020';
  ctx.fillRect(SIZE * 0.30, SIZE * 0.46, SIZE * 0.40, SIZE * 0.08);
  ctx.fillStyle = '#404040';
  ctx.fillRect(SIZE * 0.32, SIZE * 0.48, SIZE * 0.36, SIZE * 0.04);
  bevel(ctx, 0.30);
  return texFromCanvas(c);
}

function generatorSideTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [60, 60, 66], 14);
  // vents
  ctx.fillStyle = '#181818';
  for (let y = SIZE * 0.20; y < SIZE * 0.80; y += 8) {
    ctx.fillRect(SIZE * 0.16, y, SIZE * 0.68, 3);
  }
  // status LED
  const lx = SIZE * 0.78, ly = SIZE * 0.16;
  const grad = ctx.createRadialGradient(lx, ly, 1, lx, ly, 6);
  grad.addColorStop(0, '#ff6040');
  grad.addColorStop(0.6, '#a02020');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(lx - 8, ly - 8, 16, 16);
  bevel(ctx, 0.36);
  return texFromCanvas(c);
}
function generatorTopTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [50, 50, 55], 12);
  // exhaust grille
  ctx.fillStyle = '#0a0a0a';
  for (let y = SIZE * 0.20; y < SIZE * 0.80; y += 6) {
    ctx.fillRect(SIZE * 0.16, y, SIZE * 0.68, 2);
  }
  bevel(ctx, 0.36);
  return texFromCanvas(c);
}

function doorClosedTex() {
  const [c, ctx] = makeCanvas();
  ctx.fillStyle = '#604025';
  ctx.fillRect(0, 0, SIZE, SIZE);
  speckle(ctx, [96, 64, 36], 16);
  // vertical planks
  ctx.strokeStyle = 'rgba(40,28,12,0.55)';
  ctx.lineWidth = 1;
  for (const x of [SIZE * 0.25, SIZE * 0.50, SIZE * 0.75]) {
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x, SIZE - 2);
    ctx.stroke();
  }
  // metal hinges + handle
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(SIZE * 0.06, SIZE * 0.18, SIZE * 0.10, 4);
  ctx.fillRect(SIZE * 0.06, SIZE * 0.78, SIZE * 0.10, 4);
  ctx.fillStyle = '#cfa040';
  ctx.fillRect(SIZE * 0.84, SIZE * 0.46, 5, 8);
  bevel(ctx, 0.30);
  return texFromCanvas(c);
}
function doorOpenTex() {
  const [c, ctx] = makeCanvas();
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Two thin vertical jambs at left/right edges, suggesting the door has swung aside.
  ctx.fillStyle = '#604025';
  ctx.fillRect(0, 0, SIZE * 0.07, SIZE);
  ctx.fillRect(SIZE * 0.93, 0, SIZE * 0.07, SIZE);
  // hinge marks
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, SIZE * 0.18, SIZE * 0.07, 4);
  ctx.fillRect(0, SIZE * 0.78, SIZE * 0.07, 4);
  return texFromCanvas(c);
}

function vaultClosedTex() {
  const [c, ctx] = makeCanvas();
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(0, 0, SIZE, SIZE);
  speckle(ctx, [70, 70, 76], 14);
  // big central wheel/disc
  const cx = SIZE / 2, cy = SIZE / 2;
  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, SIZE * 0.20);
  grad.addColorStop(0, '#7a7a82');
  grad.addColorStop(1, '#34343a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.20, 0, Math.PI * 2);
  ctx.fill();
  // spoke marks on the wheel
  ctx.strokeStyle = 'rgba(20,20,24,0.7)';
  ctx.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * SIZE * 0.06, cy + Math.sin(a) * SIZE * 0.06);
    ctx.lineTo(cx + Math.cos(a) * SIZE * 0.18, cy + Math.sin(a) * SIZE * 0.18);
    ctx.stroke();
  }
  // rivets in corners and edge midpoints
  for (const [px, py] of [
    [SIZE * 0.10, SIZE * 0.10], [SIZE * 0.90, SIZE * 0.10],
    [SIZE * 0.10, SIZE * 0.90], [SIZE * 0.90, SIZE * 0.90],
    [SIZE * 0.50, SIZE * 0.10], [SIZE * 0.50, SIZE * 0.90],
    [SIZE * 0.10, SIZE * 0.50], [SIZE * 0.90, SIZE * 0.50],
  ]) {
    const g = ctx.createRadialGradient(px, py, 0.5, px, py, 4);
    g.addColorStop(0, '#a8a8b0');
    g.addColorStop(0.7, '#3a3a40');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
  }
  bevel(ctx, 0.36);
  return texFromCanvas(c);
}
function vaultOpenTex() {
  const [c, ctx] = makeCanvas();
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Metal frame at left/right edges (door swung aside)
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(0, 0, SIZE * 0.09, SIZE);
  ctx.fillRect(SIZE - SIZE * 0.09, 0, SIZE * 0.09, SIZE);
  // edge rivets
  ctx.fillStyle = '#7a7a82';
  ctx.fillRect(SIZE * 0.02, SIZE * 0.18, SIZE * 0.05, 4);
  ctx.fillRect(SIZE * 0.02, SIZE * 0.78, SIZE * 0.05, 4);
  ctx.fillRect(SIZE - SIZE * 0.07, SIZE * 0.18, SIZE * 0.05, 4);
  ctx.fillRect(SIZE - SIZE * 0.07, SIZE * 0.78, SIZE * 0.05, 4);
  return texFromCanvas(c);
}

function bedSideTex() {
  // Wood frame, low profile
  const [c, ctx] = makeCanvas();
  speckle(ctx, [98, 70, 40], 20);
  for (let x = 2; x < SIZE; x += 4) {
    ctx.fillStyle = `rgba(60,40,22,${0.2 + Math.random() * 0.3})`;
    ctx.fillRect(x, 0, 1 + Math.random() * 2, SIZE);
  }
  // red blanket peeks above
  ctx.fillStyle = '#a83030';
  ctx.fillRect(0, 0, SIZE, SIZE * 0.18);
  bevel(ctx, 0.24);
  return texFromCanvas(c);
}
function bedTopTex() {
  const [c, ctx] = makeCanvas();
  // red blanket main
  speckle(ctx, [168, 48, 48], 20);
  // pillow at one end
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(SIZE * 0.06, SIZE * 0.06, SIZE * 0.30, SIZE * 0.30);
  ctx.fillStyle = '#cabaa0';
  ctx.fillRect(SIZE * 0.08, SIZE * 0.08, SIZE * 0.04, SIZE * 0.26);
  // stitching
  ctx.strokeStyle = 'rgba(60,10,10,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(SIZE * 0.10, SIZE * 0.42, SIZE * 0.80, SIZE * 0.50);
  bevel(ctx, 0.20);
  return texFromCanvas(c);
}


function concreteTex() {
  const [c, ctx] = makeCanvas();
  speckle(ctx, [122, 118, 110], 30);
  blotches(ctx, 'rgba(50,46,40,0.18)', 12, [4, 12]);
  // subtle rust streaks
  ctx.fillStyle = 'rgba(120,70,40,0.18)';
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * SIZE;
    ctx.fillRect(x, 0, 1, SIZE);
  }
  bevel(ctx, 0.28);
  return texFromCanvas(c);
}

// Per-block-type geometry. Most blocks are full 1x1x1 cubes; torches, buttresses,
// and wire are slim glyph shapes that occupy only the center of their cell so
// neighbours don't overlap or z-fight with their faces. Each glyph leaves a
// ~0.005-cell epsilon at the floor and ceiling so its bottom/top face is never
// coplanar with the adjacent block's face (which produced visible z-fighting
// shimmer on torches when they sat on a solid floor).
export function makeBlockGeometries() {
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const stick = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  stick.translate(0, -0.145, 0); // bottom at y=0.005, top at y=0.705 within the cell
  const column = new THREE.BoxGeometry(0.35, 0.99, 0.35);
  const strand = new THREE.BoxGeometry(0.10, 0.99, 0.10);
  return {
    [BLOCKS.TORCH]:    stick,
    [BLOCKS.BUTTRESS]: column,
    [BLOCKS.WIRE]:     strand,
    default: cube,
  };
}

// Build per-block 6-face material array. Order: +x, -x, +y, -y, +z, -z (Three's BoxGeometry default).
export function makeBlockMaterials() {
  const grassTop = new THREE.MeshStandardMaterial({ map: grassTopTex(), roughness: 0.95 });
  const grassSide = new THREE.MeshStandardMaterial({ map: grassSideTex(), roughness: 0.95 });
  const dirt = new THREE.MeshStandardMaterial({ map: dirtTex(), roughness: 0.95 });
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.92 });
  const sand = new THREE.MeshStandardMaterial({ map: sandTex(), roughness: 1.0 });
  const woodSide = new THREE.MeshStandardMaterial({ map: woodSideTex(), roughness: 0.9 });
  const woodTop = new THREE.MeshStandardMaterial({ map: woodTopTex(), roughness: 0.9 });
  const leaves = new THREE.MeshStandardMaterial({
    map: leavesTex(), roughness: 1.0, transparent: true, alphaTest: 0.3,
  });
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: 0.95 });
  // Torches/buttresses/wire are now rendered on slim per-type geometry, so the
  // glyph-on-transparent-cube approach is gone — solid materials suffice.
  const torchStickMat = new THREE.MeshStandardMaterial({
    color: 0x62421e, roughness: 0.7,
  });
  const torchFlameMat = new THREE.MeshStandardMaterial({
    color: 0xffb040, emissive: 0xffa040, emissiveIntensity: 1.1, roughness: 0.6,
  });

  // Helper: faces array [+x, -x, +y, -y, +z, -z]
  const all = m => [m, m, m, m, m, m];
  const split = (side, top, bottom) => [side, side, top, bottom, side, side];

  const materials = {};
  materials[BLOCKS.GRASS]    = split(grassSide, grassTop, dirt);
  materials[BLOCKS.DIRT]     = all(dirt);
  materials[BLOCKS.STONE]    = all(stone);
  materials[BLOCKS.SAND]     = all(sand);
  materials[BLOCKS.WOOD]     = split(woodSide, woodTop, woodTop);
  materials[BLOCKS.LEAVES]   = all(leaves);
  materials[BLOCKS.CONCRETE] = all(concrete);
  // Torch: stick on the sides/bottom, glowing flame cap on top.
  materials[BLOCKS.TORCH] = [
    torchStickMat, torchStickMat, torchFlameMat, torchStickMat, torchStickMat, torchStickMat,
  ];

  // Devices.
  const tankSide = new THREE.MeshStandardMaterial({ map: waterTankSideTex(), roughness: 0.7, metalness: 0.25 });
  const tankTop  = new THREE.MeshStandardMaterial({ map: waterTankTopTex(),  roughness: 0.55, metalness: 0.15 });
  materials[BLOCKS.WATER_TANK] = split(tankSide, tankTop, tankSide);

  const lockerSide = new THREE.MeshStandardMaterial({ map: foodLockerSideTex(), roughness: 0.85 });
  const lockerTop  = new THREE.MeshStandardMaterial({ map: foodLockerTopTex(),  roughness: 0.85 });
  materials[BLOCKS.FOOD_LOCKER] = split(lockerSide, lockerTop, lockerSide);

  const genSide = new THREE.MeshStandardMaterial({
    map: generatorSideTex(), roughness: 0.6, metalness: 0.4,
    emissive: 0x401010, emissiveIntensity: 0.3,
  });
  const genTop = new THREE.MeshStandardMaterial({ map: generatorTopTex(), roughness: 0.6, metalness: 0.4 });
  materials[BLOCKS.GENERATOR] = split(genSide, genTop, genSide);

  const bedSide = new THREE.MeshStandardMaterial({ map: bedSideTex(), roughness: 0.9 });
  const bedTop  = new THREE.MeshStandardMaterial({ map: bedTopTex(),  roughness: 0.95 });
  materials[BLOCKS.BED] = split(bedSide, bedTop, bedSide);

  // Buttress — wood pillar on its own slim geometry; solid materials.
  const buttressSide = new THREE.MeshStandardMaterial({ color: 0x6a4622, roughness: 0.8 });
  const buttressTop  = new THREE.MeshStandardMaterial({ color: 0x7a4f1c, roughness: 0.8 });
  materials[BLOCKS.BUTTRESS] = split(buttressSide, buttressTop, buttressTop);

  // Wire — copper strand on its own thin geometry.
  const wireMaterial = new THREE.MeshStandardMaterial({
    color: 0xc88848, roughness: 0.4, metalness: 0.6,
  });
  materials[BLOCKS.WIRE] = all(wireMaterial);

  // Doors — closed is solid wood, open is alphaTest jambs only.
  const doorClosed = new THREE.MeshStandardMaterial({ map: doorClosedTex(), roughness: 0.85 });
  const doorOpen = new THREE.MeshStandardMaterial({
    map: doorOpenTex(), transparent: true, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide,
  });
  materials[BLOCKS.DOOR_CLOSED] = all(doorClosed);
  materials[BLOCKS.DOOR_OPEN]   = all(doorOpen);

  // Vault doors — same idea but heavier metal.
  const vaultClosed = new THREE.MeshStandardMaterial({ map: vaultClosedTex(), roughness: 0.55, metalness: 0.5 });
  const vaultOpen = new THREE.MeshStandardMaterial({
    map: vaultOpenTex(), transparent: true, alphaTest: 0.5, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide,
  });
  materials[BLOCKS.VAULT_CLOSED] = all(vaultClosed);
  materials[BLOCKS.VAULT_OPEN]   = all(vaultOpen);

  return materials;
}
