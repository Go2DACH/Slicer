import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../store';
import { buildBimGroup } from '../lib/bimGeometry';
import { rawDistance, rawPolygonArea, midpoint } from '../lib/geometry';
import { formatLength, formatArea } from '../lib/units';
import type { Vec3, Wall, Opening, Room } from '../types';

const FLOOR_Y = 0.04; // small raise so symbols sit above the floor plane

/** Door swing symbol (leaf + quarter-circle arc) in world coords. */
function doorSymbol(wall: Wall, o: Opening, s: number): { leaf: THREE.Vector3[]; arc: THREE.Vector3[] } {
  const ux = wall.end[0] - wall.start[0];
  const uz = wall.end[2] - wall.start[2];
  const len = Math.hypot(ux, uz) || 1;
  const dx = ux / len;
  const dz = uz / len;
  const nx = -dz;
  const nz = dx;
  const cx = wall.start[0] + ux * o.t;
  const cz = wall.start[2] + uz * o.t;
  const wRaw = o.width / s; // opening width in raw units
  const half = wRaw / 2;
  const ax = cx - dx * half;
  const az = cz - dz * half;
  const bx = cx + dx * half;
  const bz = cz + dz * half;
  const sgn = o.flip ? -1 : 1;
  const leafX = ax + nx * sgn * wRaw;
  const leafZ = az + nz * sgn * wRaw;
  const leaf = [new THREE.Vector3(ax, FLOOR_Y, az), new THREE.Vector3(leafX, FLOOR_Y, leafZ)];
  // arc from leaf tip back to the other jamb B, centered at hinge A, radius wRaw
  const a0 = Math.atan2(leafZ - az, leafX - ax);
  const a1 = Math.atan2(bz - az, bx - ax);
  let span = a1 - a0;
  while (span > Math.PI) span -= 2 * Math.PI;
  while (span < -Math.PI) span += 2 * Math.PI;
  const steps = 14;
  const arc: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (span * i) / steps;
    arc.push(new THREE.Vector3(ax + Math.cos(a) * wRaw, FLOOR_Y, az + Math.sin(a) * wRaw));
  }
  return { leaf, arc };
}

/** Window symbol (double rail + center line + opening-direction tick). */
function windowSymbol(wall: Wall, o: Opening, s: number): THREE.Vector3[][] {
  const ux = wall.end[0] - wall.start[0];
  const uz = wall.end[2] - wall.start[2];
  const len = Math.hypot(ux, uz) || 1;
  const dx = ux / len;
  const dz = uz / len;
  const nx = -dz;
  const nz = dx;
  const cx = wall.start[0] + ux * o.t;
  const cz = wall.start[2] + uz * o.t;
  const half = o.width / s / 2;
  const t = wall.thickness / s / 2;
  const ax = cx - dx * half;
  const az = cz - dz * half;
  const bx = cx + dx * half;
  const bz = cz + dz * half;
  const rail = (off: number): THREE.Vector3[] => [
    new THREE.Vector3(ax + nx * off, FLOOR_Y, az + nz * off),
    new THREE.Vector3(bx + nx * off, FLOOR_Y, bz + nz * off),
  ];
  const sgn = o.flip ? -1 : 1;
  const tick = [
    new THREE.Vector3(cx, FLOOR_Y, cz),
    new THREE.Vector3(cx + nx * sgn * half * 0.6, FLOOR_Y, cz + nz * sgn * half * 0.6),
  ];
  return [rail(t), rail(-t), rail(0), tick];
}

/** Build a filled floor geometry for a room polygon (triangulated). */
function roomGeometry(points: Vec3[]): THREE.BufferGeometry | null {
  if (points.length < 3) return null;
  const contour = points.map((p) => new THREE.Vector2(p[0], p[2]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions: number[] = [];
  for (const t of tris) {
    for (const idx of t) {
      const v = contour[idx];
      positions.push(v.x, 0.01, v.y);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

function RoomFill({ room, selected }: { room: Room; selected: boolean }) {
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const selectRoom = useStore((s) => s.selectRoom);
  const geom = useMemo(() => roomGeometry(room.points), [room.points]);
  useEffect(() => () => geom?.dispose(), [geom]);
  if (!geom) return null;
  const c = room.points.reduce((acc, p) => [acc[0] + p[0], 0, acc[2] + p[2]] as Vec3, [0, 0, 0] as Vec3);
  const centroid: Vec3 = [c[0] / room.points.length, 0.05, c[2] / room.points.length];
  const area = formatArea(rawPolygonArea(room.points), scaleFactor, unit);
  return (
    <group>
      <mesh
        geometry={geom}
        onClick={(e) => {
          e.stopPropagation();
          selectRoom(room.id);
        }}
      >
        <meshBasicMaterial
          color={selected ? '#ffd54f' : '#4f8cff'}
          transparent
          opacity={selected ? 0.28 : 0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Html position={centroid} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div className="measure-label area">
          {room.name}: {area}
        </div>
      </Html>
    </group>
  );
}

export default function BimOverlay() {
  const walls = useStore((s) => s.walls);
  const openings = useStore((s) => s.openings);
  const rooms = useStore((s) => s.rooms);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const mode = useStore((s) => s.mode);
  const pendingWallPoints = useStore((s) => s.pendingWallPoints);
  const hoverPoint = useStore((s) => s.hoverPoint);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const selectedWallId = useStore((s) => s.selectedWallId);
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const selectWall = useStore((s) => s.selectWall);
  const addOpening = useStore((s) => s.addOpening);

  const group = useMemo(
    () => buildBimGroup(walls, openings, scaleFactor, { transparent: true }),
    [walls, openings, scaleFactor],
  );
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
      const wall = walls.find((w) => w.id === wallId);
      if (!wall) return;
      const ax = wall.start[0];
      const az = wall.start[2];
      const dx = wall.end[0] - ax;
      const dz = wall.end[2] - az;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((e.point.x - ax) * dx + (e.point.z - az) * dz) / len2;
      t = Math.min(0.9, Math.max(0.1, t));
      addOpening(wallId, t);
    } else {
      selectWall(wallId);
    }
  };

  const pendingLine: Vec3[] | null = useMemo(() => {
    if (mode !== 'draw' || pendingWallPoints.length === 0 || openingPlaceType) return null;
    const pts = [...pendingWallPoints];
    if (hoverPoint) pts.push([hoverPoint[0], hoverPoint[1], hoverPoint[2]]);
    return pts.length >= 2 ? pts : null;
  }, [mode, pendingWallPoints, hoverPoint, openingPlaceType]);

  const wallById = (id: string) => walls.find((w) => w.id === id);

  return (
    <group>
      <primitive object={group} onClick={handleClick} />

      {/* room fills + areas */}
      {rooms.map((r) => (
        <RoomFill key={r.id} room={r} selected={selectedRoomId === r.id} />
      ))}

      {/* selection outline */}
      {selectedWallId &&
        (() => {
          const w = wallById(selectedWallId);
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

      {/* door / window plan symbols */}
      {openings.map((o) => {
        const w = wallById(o.wallId);
        if (!w) return null;
        if (o.type === 'door') {
          const { leaf, arc } = doorSymbol(w, o, scaleFactor);
          return (
            <group key={o.id}>
              <Line points={leaf} color="#ffb454" lineWidth={3} depthTest={false} />
              <Line points={arc} color="#ffb454" lineWidth={2.5} depthTest={false} />
            </group>
          );
        }
        return (
          <group key={o.id}>
            {windowSymbol(w, o, scaleFactor).map((seg, i) => (
              <Line key={i} points={seg} color="#54e0c7" lineWidth={i === 3 ? 2.5 : 3} depthTest={false} />
            ))}
          </group>
        );
      })}

      {/* wall length labels */}
      {walls.map((w) => (
        <Html key={w.id} position={midpoint(w.start, w.end)} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
          <div className="measure-label">{formatLength(rawDistance(w.start, w.end), scaleFactor, unit)}</div>
        </Html>
      ))}

      {/* pending preview */}
      {pendingLine && (
        <Line
          points={pendingLine.map((p) => new THREE.Vector3(...p))}
          color="#54e0c7"
          lineWidth={2}
          dashed
          dashSize={0.2}
          gapSize={0.1}
          depthTest={false}
        />
      )}
      {pendingLine && pendingLine.length >= 2 && (
        <Html
          position={midpoint(pendingLine[pendingLine.length - 2], pendingLine[pendingLine.length - 1])}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="measure-label area">
            {formatLength(
              rawDistance(pendingLine[pendingLine.length - 2], pendingLine[pendingLine.length - 1]),
              scaleFactor,
              unit,
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
