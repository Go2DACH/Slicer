import { snapWallDirectionXZ } from './geometry';
import { SNAP_ANGLES } from '../types';
import type { Vec3, Wall, Room, DrawSettings, SketchLine, SketchCircle } from '../types';

interface SnapContext {
  walls: Wall[];
  rooms: Room[];
  pendingWallPoints: Vec3[];
  drawSettings: DrawSettings;
  /** Max model dimension (raw units) used to scale snap thresholds. */
  maxDim: number;
  /** Meters per one raw unit (scaleFactor × meters-per-display-unit). */
  metersPerRaw: number;
  /** Rectangle tool: snap X/Z extents to the grid (no angle snap). */
  rect?: boolean;
}

/**
 * Snap a raw floor-plane point (Y=0) for wall drawing:
 *  1. Point snap ("Punkt fangen") to chain points / wall endpoints / room
 *     vertices — this also enables closing a loop onto the first point.
 *  2. Angle snap to the allowed raster relative to the previous segment.
 */
export function snapDrawPoint(raw: Vec3, ctx: SnapContext): Vec3 {
  const { walls, rooms, pendingWallPoints, drawSettings, maxDim, metersPerRaw } = ctx;
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

  // Rectangle tool: snap the X and Z extents to the grid independently.
  if (ctx.rect && pendingWallPoints.length > 0) {
    const origin = pendingWallPoints[0];
    if (drawSettings.gridSnap && metersPerRaw > 0 && drawSettings.gridStepM > 0) {
      const stepRaw = drawSettings.gridStepM / metersPerRaw;
      const sx = Math.round((p[0] - origin[0]) / stepRaw) * stepRaw;
      const sz = Math.round((p[2] - origin[2]) / stepRaw) * stepRaw;
      p = [origin[0] + sx, 0, origin[2] + sz];
    }
    return p;
  }

  if (pendingWallPoints.length > 0) {
    const origin = pendingWallPoints[pendingWallPoints.length - 1];
    if (drawSettings.angleSnap) {
      let prevDir: { x: number; z: number } | null = null;
      if (pendingWallPoints.length >= 2) {
        const a = pendingWallPoints[pendingWallPoints.length - 2];
        prevDir = { x: origin[0] - a[0], z: origin[2] - a[2] };
      }
      p = snapWallDirectionXZ(origin, p, prevDir, SNAP_ANGLES);
    }
    // Length grid snap (e.g. round the segment length to 10 cm steps).
    if (drawSettings.gridSnap && metersPerRaw > 0 && drawSettings.gridStepM > 0) {
      const dx = p[0] - origin[0];
      const dz = p[2] - origin[2];
      const rawLen = Math.hypot(dx, dz);
      if (rawLen > 1e-9) {
        const stepRaw = drawSettings.gridStepM / metersPerRaw;
        const snappedLen = Math.max(stepRaw, Math.round(rawLen / stepRaw) * stepRaw);
        p = [origin[0] + (dx / rawLen) * snappedLen, 0, origin[2] + (dz / rawLen) * snappedLen];
      }
    }
  }
  return p;
}

interface SketchSnapContext {
  lines: SketchLine[];
  circles: SketchCircle[];
  pendingSketch: Vec3[];
  drawSettings: DrawSettings;
  maxDim: number;
  metersPerRaw: number;
  tool: 'line' | 'circle';
}

/** Snap a raw floor point for the 2D sketch (endpoints, angle, length/radius grid). */
export function snapSketchPoint(raw: Vec3, ctx: SketchSnapContext): Vec3 {
  const { lines, circles, pendingSketch, drawSettings, maxDim, metersPerRaw, tool } = ctx;
  const threshold = Math.max(maxDim * 0.02, 1e-4);
  let p: Vec3 = [raw[0], 0, raw[2]];

  if (drawSettings.endpointSnap) {
    const candidates: Vec3[] = [];
    pendingSketch.forEach((pp) => candidates.push(pp));
    lines.forEach((l) => {
      candidates.push(l.a, l.b);
    });
    circles.forEach((c) => candidates.push(c.center));
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

  if (pendingSketch.length > 0) {
    const origin = pendingSketch[pendingSketch.length - 1];
    if (tool === 'line' && drawSettings.angleSnap) {
      p = snapWallDirectionXZ(origin, p, null, SNAP_ANGLES);
    }
    // length / radius grid snap
    if (drawSettings.gridSnap && metersPerRaw > 0 && drawSettings.gridStepM > 0) {
      const dx = p[0] - origin[0];
      const dz = p[2] - origin[2];
      const rawLen = Math.hypot(dx, dz);
      if (rawLen > 1e-9) {
        const stepRaw = drawSettings.gridStepM / metersPerRaw;
        const snappedLen = Math.max(stepRaw, Math.round(rawLen / stepRaw) * stepRaw);
        p = [origin[0] + (dx / rawLen) * snappedLen, 0, origin[2] + (dz / rawLen) * snappedLen];
      }
    }
  }
  return p;
}
