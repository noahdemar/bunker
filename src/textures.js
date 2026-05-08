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
  return materials;
}
