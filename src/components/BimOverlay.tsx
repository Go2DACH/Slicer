import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../store';
import { buildBimGroup } from '../lib/bimGeometry';
import { rawDistance, midpoint, containedPolygons, netRawArea, rawPolygonArea, rawPolylineLength } from '../lib/geometry';
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

/** Build a filled floor geometry for a room polygon with optional holes. */
function roomGeometry(points: Vec3[], holes: Vec3[][]): THREE.BufferGeometry | null {
  if (points.length < 3) return null;
  const contour = points.map((p) => new THREE.Vector2(p[0], p[2]));
  const holeContours = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[2])));
  const all = [contour, ...holeContours];
  const tris = THREE.ShapeUtils.triangulateShape(contour, holeContours);
  const flat = all.flat();
  const positions: number[] = [];
  for (const t of tris) {
    for (const idx of t) {
      const v = flat[idx];
      positions.push(v.x, 0.01, v.y);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

function RoomFill({
  room,
  allRooms,
  selected,
  selectable,
}: {
  room: Room;
  allRooms: Room[];
  selected: boolean;
  selectable: boolean;
}) {
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const selectRoom = useStore((s) => s.selectRoom);
  const others = useMemo(() => allRooms.filter((r) => r.id !== room.id), [allRooms, room.id]);
  const holes = useMemo(() => containedPolygons(room.points, others), [room.points, others]);
  const geom = useMemo(() => roomGeometry(room.points, holes), [room.points, holes]);
  useEffect(() => () => geom?.dispose(), [geom]);
  if (!geom) return null;
  const c = room.points.reduce((acc, p) => [acc[0] + p[0], 0, acc[2] + p[2]] as Vec3, [0, 0, 0] as Vec3);
  const centroid: Vec3 = [c[0] / room.points.length, 0.05, c[2] / room.points.length];
  const net = netRawArea(room.points, others);
  const area = formatArea(net, scaleFactor, unit) + (holes.length ? ' (netto)' : '');
  return (
    <group>
      <mesh
        geometry={geom}
        onClick={
          selectable
            ? (e) => {
                e.stopPropagation();
                selectRoom(room.id);
              }
            : undefined
        }
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
  const boundary = useStore((s) => s.boundary);
  const pendingBoundary = useStore((s) => s.pendingBoundary);
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
  const drawTool = useStore((s) => s.drawTool);
  const drawKind = useStore((s) => s.drawKind);
  const size = useStore((s) => s.modelInfo?.size);
  const cursorR = size ? Math.max(Math.max(...size) * 0.012, 1e-3) : 0.1;

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

  const chain = drawTool === 'boundary' ? pendingBoundary : pendingWallPoints;
  const pendingLine: Vec3[] | null = useMemo(() => {
    if (mode !== 'draw' || chain.length === 0 || openingPlaceType) return null;
    // Rectangle preview: outline from the first corner to the cursor.
    if (drawTool === 'rect') {
      if (!hoverPoint) return null;
      const a = chain[0];
      const p = hoverPoint;
      return [a, [p[0], 0, a[2]], [p[0], 0, p[2]], [a[0], 0, p[2]], a];
    }
    const pts = [...chain];
    if (hoverPoint) pts.push([hoverPoint[0], hoverPoint[1], hoverPoint[2]]);
    return pts.length >= 2 ? pts : null;
  }, [mode, chain, hoverPoint, openingPlaceType, drawTool]);

  const wallById = (id: string) => walls.find((w) => w.id === id);

  // While actively drawing, BIM meshes must be click-through so taps reach the
  // ground plane (otherwise tapping near a wall/room selects instead of drawing).
  const drawingActive = mode === 'draw' && drawKind === 'bim' && drawTool !== 'off' && !openingPlaceType;

  return (
    <group>
      <primitive object={group} onClick={drawingActive ? undefined : handleClick} />

      {/* room fills + areas */}
      {rooms.map((r) => (
        <RoomFill key={r.id} room={r} allRooms={rooms} selected={selectedRoomId === r.id} selectable={!drawingActive} />
      ))}

      {/* property boundary (Grundstücksgrenze): closed dashed ring + size label */}
      {boundary.length >= 3 &&
        (() => {
          const ring = boundary.map((p) => new THREE.Vector3(p[0], FLOOR_Y, p[2]));
          ring.push(ring[0].clone());
          const perim = rawPolylineLength([...boundary, boundary[0]]);
          const area = rawPolygonArea(boundary);
          const c = boundary.reduce((acc, p) => [acc[0] + p[0], 0, acc[2] + p[2]] as Vec3, [0, 0, 0] as Vec3);
          const centroid: Vec3 = [c[0] / boundary.length, 0.06, c[2] / boundary.length];
          return (
            <group>
              <Line points={ring} color="#ff9f43" lineWidth={2.5} dashed dashSize={0.4} gapSize={0.2} depthTest={false} />
              {boundary.map((p, i) => {
                const q = boundary[(i + 1) % boundary.length];
                return (
                  <Html key={i} position={midpoint(p, q)} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
                    <div className="measure-label">{formatLength(rawDistance(p, q), scaleFactor, unit)}</div>
                  </Html>
                );
              })}
              <Html position={centroid} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
                <div className="measure-label area">
                  Grundstück: {formatArea(area, scaleFactor, unit)} · Umfang {formatLength(perim, scaleFactor, unit)}
                </div>
              </Html>
            </group>
          );
        })()}

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

      {/* snap cursor: shows where the next point lands (already snapped) */}
      {mode === 'draw' && drawKind === 'bim' && drawTool !== 'off' && !openingPlaceType && hoverPoint && (
        <group position={[hoverPoint[0], 0.05, hoverPoint[2]]}>
          <Line
            points={Array.from({ length: 33 }, (_, i) => {
              const a = (i / 32) * Math.PI * 2;
              return new THREE.Vector3(Math.cos(a) * cursorR, 0, Math.sin(a) * cursorR);
            })}
            color="#ffd54f"
            lineWidth={2}
            depthTest={false}
          />
          <mesh>
            <sphereGeometry args={[cursorR * 0.25, 10, 10]} />
            <meshBasicMaterial color="#ffd54f" depthTest={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}
