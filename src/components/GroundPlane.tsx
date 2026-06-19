import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { snapAngleXZ } from '../lib/geometry';
import type { Vec3 } from '../types';

/**
 * Invisible horizontal plane at world Y=0 used as the drawing surface in
 * draw mode. Handles endpoint and angle snapping.
 */
export default function GroundPlane() {
  const mode = useStore((s) => s.mode);
  const walls = useStore((s) => s.walls);
  const pendingWallPoints = useStore((s) => s.pendingWallPoints);
  const drawSettings = useStore((s) => s.drawSettings);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const size = useStore((s) => s.modelInfo?.size);
  const addWallSegment = useStore((s) => s.addWallSegment);
  const setPendingWallPoints = useStore((s) => s.setPendingWallPoints);
  const setHoverPoint = useStore((s) => s.setHoverPoint);

  const planeSize = useMemo(() => (size ? Math.max(size[0], size[1], size[2]) * 6 + 10 : 1000), [size]);
  const snapThreshold = useMemo(() => (size ? Math.max(size[0], size[1], size[2]) * 0.02 : 0.2), [size]);

  const snap = (raw: Vec3): Vec3 => {
    let p = raw;
    // endpoint snap to wall endpoints + pending points
    if (drawSettings.endpointSnap) {
      const candidates: Vec3[] = [];
      walls.forEach((w) => {
        candidates.push(w.start, w.end);
      });
      pendingWallPoints.forEach((pp) => candidates.push(pp));
      let best: Vec3 | null = null;
      let bestD = snapThreshold;
      for (const c of candidates) {
        const d = Math.hypot(c[0] - p[0], c[2] - p[2]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) return [best[0], 0, best[2]];
    }
    // angle snap relative to last pending point
    if (drawSettings.angleSnap && pendingWallPoints.length > 0) {
      const origin = pendingWallPoints[pendingWallPoints.length - 1];
      p = snapAngleXZ(origin, p, 45);
    }
    return p;
  };

  const active = mode === 'draw' && !openingPlaceType;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
      onPointerMove={(e: { point: THREE.Vector3; stopPropagation: () => void }) => {
        if (!active) return;
        e.stopPropagation();
        const raw: Vec3 = [e.point.x, 0, e.point.z];
        setHoverPoint(snap(raw));
      }}
      onPointerOut={() => active && setHoverPoint(null)}
      onClick={(e: { point: THREE.Vector3; stopPropagation: () => void; button?: number; delta?: number }) => {
        if (!active) return;
        if (e.button !== undefined && e.button !== 0) return;
        if (e.delta !== undefined && e.delta > 6) return;
        e.stopPropagation();
        const snapped = snap([e.point.x, 0, e.point.z]);
        if (pendingWallPoints.length === 0) {
          setPendingWallPoints([snapped]);
        } else {
          const last = pendingWallPoints[pendingWallPoints.length - 1];
          if (Math.hypot(last[0] - snapped[0], last[2] - snapped[2]) > 1e-6) {
            addWallSegment(last, snapped);
            setPendingWallPoints([snapped]);
          }
        }
      }}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
