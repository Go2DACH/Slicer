// Generates sample models into public/models so the deployed demo works
// out of the box:
//   - demo-room.glb     : a procedural scanned room (metric units)
//   - demo-textured.obj  + .mtl + .png : a textured box (OBJ multi-file set)
//
// Run with: npm run gen:samples
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
}

// Minimal FileReader polyfill so GLTFExporter's binary path works in Node.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend && this.onloadend();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b = Buffer.from(buf);
        this.result = `data:${blob.type || 'application/octet-stream'};base64,` + b.toString('base64');
        this.onloadend && this.onloadend();
      });
    }
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'models');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// 1) Procedural room -> GLB
// ---------------------------------------------------------------------------
function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function buildRoom() {
  const T = 0.2; // wall thickness
  const H = 2.6; // wall height
  const W = 5.0; // interior width (x)
  const D = 4.0; // interior depth (z)
  const parts = [];

  // floor (top surface at y=0)
  parts.push(box(W + 2 * T, 0.12, D + 2 * T, 0, -0.06, 0));
  // ceiling
  parts.push(box(W + 2 * T, 0.1, D + 2 * T, 0, H + 0.05, 0));

  const halfW = W / 2 + T / 2;
  const halfD = D / 2 + T / 2;

  // North wall (solid)
  parts.push(box(W + 2 * T, H, T, 0, H / 2, -halfD));

  // South wall with a door gap (door width 1.0, centered-left)
  const doorW = 1.0;
  const doorH = 2.05;
  const doorCenter = -1.0;
  // left segment
  const leftLen = doorCenter - doorW / 2 - -(W / 2 + T);
  parts.push(box(leftLen, H, T, -(W / 2 + T) + leftLen / 2, H / 2, halfD));
  // right segment
  const rightStart = doorCenter + doorW / 2;
  const rightLen = (W / 2 + T) - rightStart;
  parts.push(box(rightLen, H, T, rightStart + rightLen / 2, H / 2, halfD));
  // lintel above door
  parts.push(box(doorW, H - doorH, T, doorCenter, doorH + (H - doorH) / 2, halfD));

  // East wall with a window gap (sill 0.9, height 1.2, width 1.5)
  const winW = 1.5;
  const winSill = 0.9;
  const winH = 1.2;
  const winCenter = 0.5; // along z
  // bottom (below sill)
  parts.push(box(T, winSill, winW, halfW, winSill / 2, winCenter));
  // top (above window)
  const topStart = winSill + winH;
  parts.push(box(T, H - topStart, winW, halfW, topStart + (H - topStart) / 2, winCenter));
  // side fills of east wall (full height)
  const eastFrontLen = (D / 2 + T) - (winCenter + winW / 2);
  parts.push(box(T, H, eastFrontLen, halfW, H / 2, (winCenter + winW / 2) + eastFrontLen / 2));
  const eastBackLen = (winCenter - winW / 2) - -(D / 2 + T);
  parts.push(box(T, H, eastBackLen, halfW, H / 2, -(D / 2 + T) + eastBackLen / 2));

  // West wall (solid)
  parts.push(box(T, H, D + 2 * T, -halfW, H / 2, 0));

  // a table for scale reference
  parts.push(box(1.2, 0.08, 0.8, -1.4, 0.75, -0.8));
  parts.push(box(0.06, 0.75, 0.06, -1.95, 0.375, -1.15));
  parts.push(box(0.06, 0.75, 0.06, -0.85, 0.375, -1.15));
  parts.push(box(0.06, 0.75, 0.06, -1.95, 0.375, -0.45));
  parts.push(box(0.06, 0.75, 0.06, -0.85, 0.375, -0.45));

  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0xcfcabe, roughness: 0.9, metalness: 0 });
  return new THREE.Mesh(merged, material);
}

async function writeGlb() {
  const scene = new THREE.Scene();
  const room = buildRoom();
  room.name = 'DemoRoom';
  scene.add(room);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  const buffer = Buffer.from(result);
  writeFileSync(join(outDir, 'demo-room.glb'), buffer);
  console.log(`demo-room.glb  (${(buffer.length / 1024).toFixed(1)} kB)`);

  // Also export STL and PLY of the same room for format coverage.
  const stl = new STLExporter().parse(scene, { binary: false });
  writeFileSync(join(outDir, 'demo-room.stl'), stl);
  console.log('demo-room.stl');

  await new Promise((resolve) => {
    new PLYExporter().parse(
      scene,
      (ply) => {
        writeFileSync(join(outDir, 'demo-room.ply'), ply);
        console.log('demo-room.ply');
        resolve();
      },
      { binary: false },
    );
  });
}

// ---------------------------------------------------------------------------
// 1b) Colored point cloud (PLY, ASCII) sampled from the room surface
// ---------------------------------------------------------------------------
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function writeColoredPointCloud() {
  const room = buildRoom();
  const sampler = new MeshSurfaceSampler(room).build();
  const N = 60000;
  const pos = new THREE.Vector3();
  const lines = [];
  let minY = Infinity, maxY = -Infinity;
  const pts = [];
  for (let i = 0; i < N; i++) {
    sampler.sample(pos);
    pts.push([pos.x, pos.y, pos.z]);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }
  for (const [x, y, z] of pts) {
    const t = (y - minY) / (maxY - minY || 1);
    const jitter = (Math.random() - 0.5) * 0.08;
    const [r, g, b] = hslToRgb(Math.max(0, Math.min(300, t * 300 + jitter * 60)), 0.7, 0.55);
    lines.push(`${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)} ${r} ${g} ${b}`);
  }
  const header = [
    'ply',
    'format ascii 1.0',
    `element vertex ${pts.length}`,
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    'end_header',
  ].join('\n');
  writeFileSync(join(outDir, 'demo-pointcloud.ply'), header + '\n' + lines.join('\n') + '\n');
  console.log(`demo-pointcloud.ply  (${pts.length} colored points)`);
}

// ---------------------------------------------------------------------------
// 2) Textured OBJ set (OBJ + MTL + PNG)
// ---------------------------------------------------------------------------
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rest 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function buildBrickTexture(size = 256) {
  const rgba = Buffer.alloc(size * size * 4);
  const brickH = 32;
  const brickW = 64;
  const mortar = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / brickH);
      const offset = row % 2 ? brickW / 2 : 0;
      const bx = (x + offset) % brickW;
      const by = y % brickH;
      const isMortar = by < mortar || bx < mortar;
      const i = (y * size + x) * 4;
      let r, g, b;
      if (isMortar) {
        r = 200; g = 198; b = 190;
      } else {
        const n = (Math.sin(x * 12.9 + y * 78.2) * 43758.5) % 1;
        const v = 30 * Math.abs(n);
        r = 150 + v; g = 70 + v * 0.4; b = 55 + v * 0.3;
      }
      rgba[i] = Math.min(255, r);
      rgba[i + 1] = Math.min(255, g);
      rgba[i + 2] = Math.min(255, b);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

function writeTexturedObj() {
  const png = buildBrickTexture(256);
  writeFileSync(join(outDir, 'demo-brick.png'), png);

  const mtl = `# Demo material
newmtl brick
Ka 1.000 1.000 1.000
Kd 1.000 1.000 1.000
Ks 0.000 0.000 0.000
d 1.0
illum 2
map_Kd demo-brick.png
`;
  writeFileSync(join(outDir, 'demo-textured.mtl'), mtl);

  // a 2 x 2.5 x 0.3 m textured wall panel
  const w = 2, h = 2.5, d = 0.3;
  const x0 = -w / 2, x1 = w / 2, y0 = 0, y1 = h, z0 = -d / 2, z1 = d / 2;
  const v = [
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], // front
    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], // back
  ];
  const vt = [[0, 0], [w, 0], [w, h], [0, h]];
  let obj = `# Demo textured panel\nmtllib demo-textured.mtl\no Panel\n`;
  for (const p of v) obj += `v ${p[0]} ${p[1]} ${p[2]}\n`;
  for (const t of vt) obj += `vt ${t[0]} ${t[1]}\n`;
  obj += `usemtl brick\n`;
  // faces (1-indexed), with texture coords
  const faces = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [6, 1, 4, 7], // left
    [2, 5, 8, 3], // right
    [4, 3, 8, 7], // top
    [6, 5, 2, 1], // bottom
  ];
  const tt = [1, 2, 3, 4];
  for (const f of faces) {
    obj += `f ${f[0]}/${tt[0]} ${f[1]}/${tt[1]} ${f[2]}/${tt[2]} ${f[3]}/${tt[3]}\n`;
  }
  writeFileSync(join(outDir, 'demo-textured.obj'), obj);
  console.log('demo-textured.obj + .mtl + demo-brick.png');
}

await writeGlb();
writeColoredPointCloud();
writeTexturedObj();
console.log('Done. Samples written to public/models/');
