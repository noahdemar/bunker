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

function buttressSideTex() {
  const [c, ctx] = makeCanvas();
  ctx.clearRect(0, 0, SIZE, SIZE);
  // wood pole in the central 20% strip
  const x0 = SIZE * 0.40, w = SIZE * 0.20;
  ctx.fillStyle = '#62421e';
  ctx.fillRect(x0, 0, w, SIZE);
  // grain
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(60,40,22,${0.25 + Math.random() * 0.4})`;
    ctx.fillRect(x0, Math.random() * SIZE, w, 1 + Math.random() * 2);
  }
  // metal banding (reinforcement) at top, middle, and bottom
  ctx.fillStyle = '#404040';
  for (const yy of [SIZE * 0.05, SIZE * 0.50, SIZE * 0.92]) {
    ctx.fillRect(x0 - 2, yy, w + 4, 3);
  }
  // highlight
  ctx.fillStyle = 'rgba(255,235,200,0.18)';
  ctx.fillRect(x0 + 2, 0, 2, SIZE);
  return texFromCanvas(c);
}
function buttressTopTex() {
  const [c, ctx] = makeCanvas();
  ctx.clearRect(0, 0, SIZE, SIZE);
  // round end-grain
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.18;
  ctx.fillStyle = '#7a4f1c';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // rings
  ctx.strokeStyle = 'rgba(40,28,12,0.6)';
  ctx.lineWidth = 1;
  for (let rr = 3; rr < r; rr += 3) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
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

function torchSideTex() {
  const [c, ctx] = makeCanvas();
  // warm fiery base across the whole face
  ctx.fillStyle = '#a83410';
  ctx.fillRect(0, 0, SIZE, SIZE);
  speckle(ctx, [184, 80, 28], 28);
  // central plume — bright yellow → orange → red
  const fx = SIZE * 0.5, fy = SIZE * 0.45;
  const grad = ctx.createRadialGradient(fx, fy * 0.7, 1, fx, fy, SIZE * 0.55);
  grad.addColorStop(0,    '#fffce0');
  grad.addColorStop(0.25, '#ffe080');
  grad.addColorStop(0.55, '#ff8a30');
  grad.addColorStop(1,    'rgba(120,30,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // flicker streaks
  ctx.fillStyle = 'rgba(255,220,140,0.45)';
  for (let i = 0; i < 6; i++) {
    const tx = SIZE * 0.30 + Math.random() * SIZE * 0.40;
    const ty = SIZE * 0.10 + Math.random() * SIZE * 0.30;
    ctx.fillRect(tx, ty, 2, 4 + Math.random() * 6);
  }
  bevel(ctx, 0.16);
  return texFromCanvas(c);
}
function torchEmissiveTex() {
  const [c, ctx] = makeCanvas();
  // fully-on emissive across the whole face, peaking in the center
  const fx = SIZE * 0.5, fy = SIZE * 0.5;
  ctx.fillStyle = '#603018';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const grad = ctx.createRadialGradient(fx, fy, 1, fx, fy, SIZE * 0.7);
  grad.addColorStop(0,    '#ffffff');
  grad.addColorStop(0.35, '#ffd680');
  grad.addColorStop(0.75, '#a04018');
  grad.addColorStop(1,    '#301008');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
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
  const torchSide = new THREE.MeshStandardMaterial({
    map: torchSideTex(),
    emissiveMap: torchEmissiveTex(),
    emissive: 0xffcc70,
    emissiveIntensity: 2.4,
    roughness: 0.6,
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
  materials[BLOCKS.TORCH]    = all(torchSide);

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

  // Buttress — alphaTest reveals only the central pole; surrounding cell edges are transparent.
  const buttressSide = new THREE.MeshStandardMaterial({
    map: buttressSideTex(), transparent: true, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide,
  });
  const buttressTop = new THREE.MeshStandardMaterial({
    map: buttressTopTex(), transparent: true, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide,
  });
  materials[BLOCKS.BUTTRESS] = split(buttressSide, buttressTop, buttressTop);

  return materials;
}
