import * as THREE from 'three';
import type { Wall, Opening, Vec3 } from '../types';

/**
 * Build a THREE.Group of the drawn BIM model (walls + openings) in RAW model
 * coordinates so it overlays the scan exactly. Real-unit dimensions (thickness,
 * height, opening sizes) are divided by scaleFactor to convert to raw units.
 *
 * Corners: each wall is extended by half its thickness at any end that connects
 * to another wall, so the incoming wall fills the corner cleanly (no notch / no
 * double overlap). Openings cut real gaps: doors leave a full-height void,
 * windows leave a void between sill and header.
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

  const TOL = 1e-4;
  const samePoint = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]) < TOL;
  // Does any other wall have an endpoint at `pt`? (corner connection)
  const connectsAt = (pt: Vec3, selfId: string) =>
    walls.some((w) => w.id !== selfId && (samePoint(w.start, pt) || samePoint(w.end, pt)));

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

    // Extend connected ends by half thickness so corners fill cleanly. Extend
    // the start only if it connects but the matching wall doesn't cover it.
    const ext1 = connectsAt(wall.end, wall.id) ? thicknessRaw / 2 : 0;
    const ext0 = connectsAt(wall.start, wall.id) ? thicknessRaw / 2 : 0;
    const extLen = rawLen + ext0 + ext1;
    const p0x = sx - ux * ext0;
    const p0z = sz - uz * ext0;

    // Box piece spanning distance [d0, d1] from the extended start, y [yB, yT].
    const addPiece = (d0: number, d1: number, yB: number, yT: number) => {
      const segLen = d1 - d0;
      const h = yT - yB;
      if (segLen <= 1e-5 || h <= 1e-5) return;
      const geom = new THREE.BoxGeometry(segLen, h, thicknessRaw);
      const mesh = new THREE.Mesh(geom, wallMat);
      mesh.name = wall.name;
      mesh.userData.wallId = wall.id;
      const mid = (d0 + d1) / 2;
      mesh.position.set(p0x + ux * mid, (yB + yT) / 2, p0z + uz * mid);
      mesh.rotation.y = rotY;
      group.add(mesh);
    };

    // Openings positioned by distance along the original centerline.
    const ops = openings
      .filter((op) => op.wallId === wall.id)
      .map((o) => {
        const center = ext0 + o.t * rawLen;
        const half = o.width / s / 2;
        return { o, d0: Math.max(0, center - half), d1: Math.min(extLen, center + half) };
      })
      .sort((a, b) => a.d0 - b.d0);

    let cursor = 0;
    for (const { o, d0, d1 } of ops) {
      addPiece(cursor, d0, 0, heightRaw);
      if (o.type === 'window') {
        const sillRaw = o.sill / s;
        const topRaw = Math.min(heightRaw, sillRaw + o.height / s);
        addPiece(d0, d1, 0, sillRaw); // sill below
        addPiece(d0, d1, topRaw, heightRaw); // header above
      }
      // door: full-height gap (nothing)
      cursor = Math.max(cursor, d1);
    }
    addPiece(cursor, extLen, 0, heightRaw);
  }

  return group;
}
