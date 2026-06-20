import * as THREE from 'three';
import type { Wall, Opening } from '../types';

/**
 * Build a THREE.Group of the drawn BIM model (walls + openings) in RAW model
 * coordinates so it overlays the scan exactly. Real-unit dimensions (thickness,
 * height, opening sizes) are divided by scaleFactor to convert to raw units.
 *
 * Openings cut real gaps into the wall: doors leave a full-height void, windows
 * leave a void between sill and header (with sill/header pieces kept solid).
 */
export function buildBimGroup(
  walls: Wall[],
  openings: Opening[],
  scaleFactor: number,
  opts: { transparent?: boolean } = {},
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bim';
  const s = scaleFactor || 1;
  const transparent = opts.transparent ?? true;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x6f9bff,
    roughness: 0.75,
    metalness: 0.0,
    transparent,
    opacity: transparent ? 0.55 : 1,
    side: THREE.DoubleSide,
  });

  for (const wall of walls) {
    const sx = wall.start[0];
    const sz = wall.start[2];
    const ex = wall.end[0];
    const ez = wall.end[2];
    const dx = ex - sx;
    const dz = ez - sz;
    const rawLen = Math.hypot(dx, dz);
    if (rawLen < 1e-6) continue;
    const ux = dx / rawLen;
    const uz = dz / rawLen;
    const thicknessRaw = wall.thickness / s;
    const heightRaw = wall.height / s;
    const rotY = Math.atan2(-uz, ux);

    // Add a box piece spanning param range [p0, p1] of the wall, between
    // yBottom..yTop (raw units).
    const addPiece = (p0: number, p1: number, yBottom: number, yTop: number) => {
      const segLen = (p1 - p0) * rawLen;
      const h = yTop - yBottom;
      if (segLen <= 1e-5 || h <= 1e-5) return;
      const geom = new THREE.BoxGeometry(segLen, h, thicknessRaw);
      const mesh = new THREE.Mesh(geom, wallMat);
      mesh.name = wall.name;
      mesh.userData.wallId = wall.id;
      const mid = (p0 + p1) / 2;
      mesh.position.set(sx + dx * mid, (yBottom + yTop) / 2, sz + dz * mid);
      mesh.rotation.y = rotY;
      group.add(mesh);
    };

    const ops = openings
      .filter((op) => op.wallId === wall.id)
      .map((o) => {
        const halfParam = o.width / s / 2 / rawLen;
        return { o, p0: Math.max(0, o.t - halfParam), p1: Math.min(1, o.t + halfParam) };
      })
      .sort((a, b) => a.p0 - b.p0);

    // solid wall pieces between openings
    let cursor = 0;
    for (const { o, p0, p1 } of ops) {
      addPiece(cursor, p0, 0, heightRaw);
      if (o.type === 'window') {
        const sillRaw = o.sill / s;
        const topRaw = Math.min(heightRaw, sillRaw + o.height / s);
        addPiece(p0, p1, 0, sillRaw); // sill (below window)
        addPiece(p0, p1, topRaw, heightRaw); // header (above window)
      }
      // door: full-height gap (nothing)
      cursor = Math.max(cursor, p1);
    }
    addPiece(cursor, 1, 0, heightRaw);
  }

  return group;
}
