import { snapWallDirectionXZ } from './geometry';
import { SNAP_ANGLES } from '../types';
import type { Vec3, Wall, Room, DrawSettings } from '../types';

interface SnapContext {
  walls: Wall[];
  rooms: Room[];
  pendingWallPoints: Vec3[];
  drawSettings: DrawSettings;
  /** Max model dimension (raw units) used to scale snap thresholds. */
  maxDim: number;
}

/**
 * Snap a raw floor-plane point (Y=0) for wall drawing:
 *  1. Point snap ("Punkt fangen") to chain points / wall endpoints / room
 *     vertices — this also enables closing a loop onto the first point.
 *  2. Angle snap to the allowed raster relative to the previous segment.
 */
export function snapDrawPoint(raw: Vec3, ctx: SnapContext): Vec3 {
  const { walls, rooms, pendingWallPoints, drawSettings, maxDim } = ctx;
  const threshold = Math.max(maxDim * 0.02, 1e-4);
  let p: Vec3 = [raw[0], 0, raw[2]];

  if (drawSettings.endpointSnap) {
    const candidates: Vec3[] = [];
    // chain start first so closing the loop is preferred
    pendingWallPoints.forEach((pp) => candidates.push(pp));
    walls.forEach((w) => {
      candidates.push(w.start, w.end);
    });
    rooms.forEach((r) => r.points.forEach((pt) => candidates.push(pt)));
    let best: Vec3 | null = null;
    let bestD = threshold;
    for (const c of candidates) {
      const d = Math.hypot(c[0] - p[0], c[2] - p[2]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return [best[0], 0, best[2]];
  }

  if (drawSettings.angleSnap && pendingWallPoints.length > 0) {
    const origin = pendingWallPoints[pendingWallPoints.length - 1];
    let prevDir: { x: number; z: number } | null = null;
    if (pendingWallPoints.length >= 2) {
      const a = pendingWallPoints[pendingWallPoints.length - 2];
      prevDir = { x: origin[0] - a[0], z: origin[2] - a[2] };
    }
    p = snapWallDirectionXZ(origin, p, prevDir, SNAP_ANGLES);
  }
  return p;
}
