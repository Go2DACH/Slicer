import * as THREE from 'three';
import type { Wall, Opening } from '../types';

/**
 * Build a THREE.Group of the drawn BIM model (walls + openings) in RAW model
 * coordinates so it overlays the scan exactly. Real-unit dimensions (thickness,
 * height, opening sizes) are divided by scaleFactor to convert to raw units.
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

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x4f8cff,
    roughness: 0.7,
    metalness: 0.0,
    transparent: opts.transparent ?? true,
    opacity: opts.transparent === false ? 1 : 0.55,
    side: THREE.DoubleSide,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xff9f43,
    roughness: 0.6,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x54e0c7,
    roughness: 0.4,
    transparent: true,
    opacity: 0.6,
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

    const geom = new THREE.BoxGeometry(rawLen, heightRaw, thicknessRaw);
    const mesh = new THREE.Mesh(geom, wallMat);
    mesh.name = wall.name;
    mesh.userData.wallId = wall.id;
    mesh.position.set((sx + ex) / 2, heightRaw / 2, (sz + ez) / 2);
    mesh.rotation.y = Math.atan2(-uz, ux);
    group.add(mesh);

    // openings as marker volumes
    for (const o of openings.filter((op) => op.wallId === wall.id)) {
      const widthRaw = o.width / s;
      const oHeightRaw = o.height / s;
      const sillRaw = o.sill / s;
      const og = new THREE.BoxGeometry(widthRaw, oHeightRaw, thicknessRaw * 1.1);
      const om = new THREE.Mesh(og, o.type === 'door' ? doorMat : windowMat);
      om.name = o.name;
      om.userData.openingId = o.id;
      const along = (o.t - 0.5) * rawLen;
      // local position then transform by wall orientation
      const localX = along;
      const localY = sillRaw + oHeightRaw / 2;
      const cos = ux;
      const sin = -uz; // matches rotation.y above
      const wx = (sx + ex) / 2 + localX * cos;
      const wz = (sz + ez) / 2 - localX * sin;
      om.position.set(wx, localY, wz);
      om.rotation.y = Math.atan2(-uz, ux);
      group.add(om);
    }
  }

  return group;
}
