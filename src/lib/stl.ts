import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { METERS_PER_UNIT } from './units';
import type { Vec3, SketchCircle } from '../types';

/** Millimeters per one raw model unit, given calibration + display unit. */
export function mmPerRawUnit(scaleFactor: number, unit: string): number {
  return scaleFactor * (METERS_PER_UNIT[unit] ?? 1) * 1000;
}

/**
 * Build a printable ASCII STL by extruding closed 2D faces (and circles) to a
 * given height in millimeters. The sketch lies on the floor plane (XZ); it is
 * mapped to the STL XY plane (X = X, Y = -Z, upright like the DXF export) and
 * extruded along +Z. All coordinates are emitted in millimeters so the file
 * drops straight into a 3D-printer slicer.
 */
export function buildExtrudedStl(
  faces: Vec3[][],
  circles: SketchCircle[],
  scaleFactor: number,
  unit: string,
  heightMm: number,
): string {
  const f = mmPerRawUnit(scaleFactor, unit);
  const depth = Math.max(heightMm, 1e-3);
  const group = new THREE.Group();
  const extrudeOpts = { depth, bevelEnabled: false, steps: 1 } as const;

  for (const ring of faces) {
    if (ring.length < 3) continue;
    const shape = new THREE.Shape();
    ring.forEach((p, i) => {
      const x = p[0] * f;
      const y = -p[2] * f;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrudeOpts)));
  }

  for (const c of circles) {
    const r = c.r * f;
    if (r <= 1e-6) continue;
    const shape = new THREE.Shape();
    shape.absarc(c.center[0] * f, -c.center[2] * f, r, 0, Math.PI * 2, false);
    group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrudeOpts)));
  }

  return new STLExporter().parse(group, { binary: false });
}
