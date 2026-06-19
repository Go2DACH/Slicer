import * as THREE from 'three';
import type { Vec3 } from '../types';

export const toVector3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);
export const toArray = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/** Raw (uncalibrated) distance between two points. */
export function rawDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Raw total length of a polyline. */
export function rawPolylineLength(points: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += rawDistance(points[i - 1], points[i]);
  return total;
}

/**
 * Raw area of a 3D polygon using the Newell method (works for non-planar
 * polygons by projecting onto the best-fit normal). Returns area in raw units².
 */
export function rawPolygonArea(points: Vec3[]): number {
  if (points.length < 3) return 0;
  const normal = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    a.set(...points[i]);
    b.set(...points[(i + 1) % points.length]);
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  return normal.length() / 2;
}

/** Centroid of a set of points. */
export function centroid(points: Vec3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  points.forEach((p) => c.add(toVector3(p)));
  if (points.length) c.multiplyScalar(1 / points.length);
  return c;
}

/**
 * Best-fit plane normal of a set of points via Newell's method.
 * Returns a normalized normal vector.
 */
export function bestFitNormal(points: Vec3[]): THREE.Vector3 {
  const normal = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    a.set(...points[i]);
    b.set(...points[(i + 1) % points.length]);
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  if (normal.lengthSq() === 0) return new THREE.Vector3(0, 1, 0);
  return normal.normalize();
}

/**
 * Plane normal from three points (a-b-c). Returns normalized normal.
 */
export function planeNormalFromThree(p0: Vec3, p1: Vec3, p2: Vec3): THREE.Vector3 {
  const v0 = toVector3(p0);
  const v1 = toVector3(p1);
  const v2 = toVector3(p2);
  const n = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v2, v0));
  if (n.lengthSq() === 0) return new THREE.Vector3(0, 1, 0);
  return n.normalize();
}

/** Midpoint of a segment. */
export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/**
 * Snap a 2D direction (on the XZ plane) to multiples of `stepDeg` degrees,
 * relative to a reference origin. Returns the snapped endpoint.
 */
export function snapAngleXZ(origin: Vec3, target: Vec3, stepDeg: number): Vec3 {
  const dx = target[0] - origin[0];
  const dz = target[2] - origin[2];
  const len = Math.hypot(dx, dz);
  if (len === 0) return target;
  const angle = Math.atan2(dz, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(angle / step) * step;
  return [origin[0] + Math.cos(snapped) * len, target[1], origin[2] + Math.sin(snapped) * len];
}
