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

/** Rooms whose polygon is fully contained inside `outer` (immediate holes). */
export function containedPolygons(outer: Vec3[], others: { id: string; points: Vec3[] }[]): Vec3[][] {
  const outerArea = rawPolygonArea(outer);
  return others
    .filter((o) => rawPolygonArea(o.points) < outerArea && polygonInsideXZ(o.points, outer))
    .map((o) => o.points);
}

/** Net raw area of a polygon minus the gross area of polygons contained inside it. */
export function netRawArea(outer: Vec3[], others: { id: string; points: Vec3[] }[]): number {
  const gross = rawPolygonArea(outer);
  const holes = containedPolygons(outer, others).reduce((acc, h) => acc + rawPolygonArea(h), 0);
  return Math.max(0, gross - holes);
}

/** Nearest point on segment a-b to p, on the XZ plane. */
export function nearestPointOnSegmentXZ(p: Vec3, a: Vec3, b: Vec3): { point: Vec3; dist: number } {
  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((p[0] - a[0]) * abx + (p[2] - a[2]) * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + abx * t;
  const z = a[2] + abz * t;
  return { point: [x, 0, z], dist: Math.hypot(p[0] - x, p[2] - z) };
}

/** Point-in-polygon test on the XZ plane (ray casting). */
export function pointInPolygonXZ(p: Vec3, poly: Vec3[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][2];
    const xj = poly[j][0];
    const zj = poly[j][2];
    const intersect = zi > p[2] !== zj > p[2] && p[0] < ((xj - xi) * (p[2] - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if every vertex of `inner` lies inside `outer` (XZ). */
export function polygonInsideXZ(inner: Vec3[], outer: Vec3[]): boolean {
  if (inner.length === 0) return false;
  return inner.every((v) => pointInPolygonXZ(v, outer));
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

/**
 * Snap a new wall direction so its angle relative to the previous segment (or
 * the world X axis if none) matches one of the allowed angles (and their
 * mirrors). Keeps the segment length, returns the snapped endpoint.
 */
export function snapWallDirectionXZ(
  origin: Vec3,
  target: Vec3,
  prevDir: { x: number; z: number } | null,
  allowedDeg: readonly number[],
): Vec3 {
  const dx = target[0] - origin[0];
  const dz = target[2] - origin[2];
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return target;
  const candAbs = (Math.atan2(dz, dx) * 180) / Math.PI;
  const refAbs = prevDir ? (Math.atan2(prevDir.z, prevDir.x) * 180) / Math.PI : 0;
  let rel = candAbs - refAbs;
  rel = ((((rel + 180) % 360) + 360) % 360) - 180; // normalize to (-180, 180]
  const candidates = new Set<number>([0, 180, -180]);
  for (const a of allowedDeg) {
    candidates.add(a);
    candidates.add(-a);
  }
  let best = rel;
  let bestD = Infinity;
  for (const a of candidates) {
    const d = Math.abs(a - rel);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  const snapped = ((refAbs + best) * Math.PI) / 180;
  return [origin[0] + Math.cos(snapped) * len, target[1], origin[2] + Math.sin(snapped) * len];
}
