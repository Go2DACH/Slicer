import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { snapDrawPoint } from '../lib/drawSnap';
import { METERS_PER_UNIT } from '../lib/units';
import type { Vec3 } from '../types';

/**
 * Invisible horizontal plane at world Y=0 used as the drawing surface in
 * draw mode. Handles point/angle snapping and feeds points to addDrawPoint.
 */
export default function GroundPlane() {
  const mode = useStore((s) => s.mode);
  const walls = useStore((s) => s.walls);
  const rooms = useStore((s) => s.rooms);
  const pendingWallPoints = useStore((s) => s.pendingWallPoints);
  const drawSettings = useStore((s) => s.drawSettings);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const size = useStore((s) => s.modelInfo?.size);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const addDrawPoint = useStore((s) => s.addDrawPoint);
  const setHoverPoint = useStore((s) => s.setHoverPoint);

  const maxDim = size ? Math.max(...size) : 10;
  const planeSize = useMemo(() => maxDim * 6 + 10, [maxDim]);
  const metersPerRaw = scaleFactor * (METERS_PER_UNIT[unit] ?? 1);

  const snap = (x: number, z: number): Vec3 =>
    snapDrawPoint([x, 0, z], { walls, rooms, pendingWallPoints, drawSettings, maxDim, metersPerRaw });

  const active = mode === 'draw' && !openingPlaceType;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
      onPointerMove={(e: { point: THREE.Vector3; stopPropagation: () => void }) => {
        if (!active) return;
        e.stopPropagation();
        setHoverPoint(snap(e.point.x, e.point.z));
      }}
      onPointerOut={() => active && setHoverPoint(null)}
      onClick={(e: { point: THREE.Vector3; stopPropagation: () => void; button?: number; delta?: number }) => {
        if (!active) return;
        if (e.button !== undefined && e.button !== 0) return;
        if (e.delta !== undefined && e.delta > 6) return;
        e.stopPropagation();
        addDrawPoint(snap(e.point.x, e.point.z));
      }}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
