import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../store';
import { buildBimGroup } from '../lib/bimGeometry';
import { rawDistance, midpoint } from '../lib/geometry';
import { formatLength } from '../lib/units';
import type { Vec3 } from '../types';

export default function BimOverlay() {
  const walls = useStore((s) => s.walls);
  const openings = useStore((s) => s.openings);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const mode = useStore((s) => s.mode);
  const pendingWallPoints = useStore((s) => s.pendingWallPoints);
  const hoverPoint = useStore((s) => s.hoverPoint);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const selectedWallId = useStore((s) => s.selectedWallId);
  const selectWall = useStore((s) => s.selectWall);
  const addOpening = useStore((s) => s.addOpening);

  const group = useMemo(() => buildBimGroup(walls, openings, scaleFactor, { transparent: true }), [walls, openings, scaleFactor]);

  // Dispose geometries when the group is replaced.
  useEffect(() => {
    return () => {
      group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    };
  }, [group]);

  const handleClick = (e: { object: THREE.Object3D; point: THREE.Vector3; stopPropagation: () => void }) => {
    if (mode !== 'draw') return;
    e.stopPropagation();
    const wallId = (e.object.userData as { wallId?: string }).wallId;
    if (!wallId) return;
    if (openingPlaceType) {
      // compute t along the wall from the clicked point
      const wall = walls.find((w) => w.id === wallId);
      if (!wall) return;
      const ax = wall.start[0];
      const az = wall.start[2];
      const dx = wall.end[0] - ax;
      const dz = wall.end[2] - az;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((e.point.x - ax) * dx + (e.point.z - az) * dz) / len2;
      t = Math.min(0.95, Math.max(0.05, t));
      addOpening(wallId, t);
    } else {
      selectWall(wallId);
    }
  };

  // pending wall preview line (last point -> cursor)
  const pendingLine: Vec3[] | null = useMemo(() => {
    if (mode !== 'draw' || pendingWallPoints.length === 0 || openingPlaceType) return null;
    const pts = [...pendingWallPoints];
    if (hoverPoint) pts.push([hoverPoint[0], hoverPoint[1], hoverPoint[2]]);
    return pts.length >= 2 ? pts : null;
  }, [mode, pendingWallPoints, hoverPoint, openingPlaceType]);

  return (
    <group>
      <primitive object={group} onClick={handleClick} />

      {/* selection outline */}
      {selectedWallId &&
        (() => {
          const w = walls.find((x) => x.id === selectedWallId);
          if (!w) return null;
          return (
            <Line
              points={[new THREE.Vector3(...w.start), new THREE.Vector3(...w.end)]}
              color="#ffd54f"
              lineWidth={4}
              depthTest={false}
            />
          );
        })()}

      {/* wall length labels */}
      {walls.map((w) => (
        <Html key={w.id} position={midpoint(w.start, w.end)} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
          <div className="measure-label">{formatLength(rawDistance(w.start, w.end), scaleFactor, unit)}</div>
        </Html>
      ))}

      {/* pending preview */}
      {pendingLine && (
        <Line points={pendingLine.map((p) => new THREE.Vector3(...p))} color="#54e0c7" lineWidth={2} dashed dashSize={0.2} gapSize={0.1} depthTest={false} />
      )}
      {pendingLine && pendingLine.length >= 2 && (
        <Html position={midpoint(pendingLine[pendingLine.length - 2], pendingLine[pendingLine.length - 1])} center style={{ pointerEvents: 'none' }}>
          <div className="measure-label area">
            {formatLength(rawDistance(pendingLine[pendingLine.length - 2], pendingLine[pendingLine.length - 1]), scaleFactor, unit)}
          </div>
        </Html>
      )}
    </group>
  );
}
