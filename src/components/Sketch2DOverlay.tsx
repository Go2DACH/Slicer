import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../store';
import { rawDistance, midpoint } from '../lib/geometry';
import { detectSketchFaces } from '../lib/sketchFaces';
import { formatLength, formatArea } from '../lib/units';
import type { Vec3 } from '../types';

const Y = 0.03;
const Y_FILL = 0.02;

function circlePoints(center: Vec3, r: number, segments = 64): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(center[0] + Math.cos(a) * r, Y, center[2] + Math.sin(a) * r));
  }
  return pts;
}

/** Flat horizontal triangulation of a sketch face ring (on the XZ plane). */
function FaceFill({ ring }: { ring: Vec3[] }) {
  const geom = useMemo(() => {
    const contour = ring.map((p) => new THREE.Vector2(p[0], p[2]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const pos: number[] = [];
    for (const t of tris) {
      for (const idx of t) {
        const v = contour[idx];
        pos.push(v.x, Y_FILL, v.y);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, [ring]);
  return (
    <mesh geometry={geom} raycast={() => null}>
      <meshBasicMaterial color="#54e0c7" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function ringArea(ring: Vec3[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p[0] * q[2] - q[0] * p[2];
  }
  return Math.abs(a) / 2;
}

function ringCentroid(ring: Vec3[]): Vec3 {
  let x = 0;
  let z = 0;
  ring.forEach((p) => {
    x += p[0];
    z += p[2];
  });
  return [x / ring.length, Y, z / ring.length];
}

export default function Sketch2DOverlay() {
  const lines = useStore((s) => s.sketchLines);
  const circles = useStore((s) => s.sketchCircles);
  const pendingSketch = useStore((s) => s.pendingSketch);
  const hoverPoint = useStore((s) => s.hoverPoint);
  const sketchTool = useStore((s) => s.sketchTool);
  const mode = useStore((s) => s.mode);
  const drawKind = useStore((s) => s.drawKind);
  const selectedSketchId = useStore((s) => s.selectedSketchId);
  const selectSketch = useStore((s) => s.selectSketch);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);

  const drawing = mode === 'draw' && drawKind === 'sketch2d';
  const faces = useMemo(() => detectSketchFaces(lines), [lines]);

  const preview = useMemo(() => {
    if (!drawing || pendingSketch.length === 0 || !hoverPoint) return null;
    const origin = pendingSketch[pendingSketch.length - 1];
    if (sketchTool === 'circle') {
      const r = Math.hypot(hoverPoint[0] - origin[0], hoverPoint[2] - origin[2]);
      return { type: 'circle' as const, center: origin, r };
    }
    // line + area: rubber-band segment from the last point to the cursor
    const first = pendingSketch[0];
    const closing =
      sketchTool === 'area' &&
      pendingSketch.length >= 3 &&
      Math.hypot(hoverPoint[0] - first[0], hoverPoint[2] - first[2]) < 1e-5;
    return { type: 'line' as const, a: origin, b: hoverPoint, closing };
  }, [drawing, pendingSketch, hoverPoint, sketchTool]);

  return (
    <group>
      {/* filled faces (behind the line work) */}
      {faces.map((ring, i) => (
        <group key={`face_${i}`}>
          <FaceFill ring={ring} />
          <Html position={ringCentroid(ring)} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
            <div className="measure-label area">{formatArea(ringArea(ring), scaleFactor, unit)}</div>
          </Html>
        </group>
      ))}

      {lines.map((l) => {
        const sel = selectedSketchId === l.id;
        return (
          <group key={l.id} onClick={drawing ? undefined : (e) => { e.stopPropagation(); selectSketch(l.id); }}>
            <Line
              points={[new THREE.Vector3(l.a[0], Y, l.a[2]), new THREE.Vector3(l.b[0], Y, l.b[2])]}
              color={sel ? '#ffd54f' : '#7fd4ff'}
              lineWidth={sel ? 4 : 2.5}
              depthTest={false}
            />
            <Html position={midpoint(l.a, l.b)} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
              <div className="measure-label">{formatLength(rawDistance(l.a, l.b), scaleFactor, unit)}</div>
            </Html>
          </group>
        );
      })}

      {circles.map((c) => {
        const sel = selectedSketchId === c.id;
        return (
          <group key={c.id} onClick={drawing ? undefined : (e) => { e.stopPropagation(); selectSketch(c.id); }}>
            <Line points={circlePoints(c.center, c.r)} color={sel ? '#ffd54f' : '#54e0c7'} lineWidth={sel ? 4 : 2.5} depthTest={false} />
            <Html position={[c.center[0], Y, c.center[2]]} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
              <div className="measure-label area">r {formatLength(c.r, scaleFactor, unit)}</div>
            </Html>
          </group>
        );
      })}

      {/* pending preview */}
      {preview?.type === 'line' && (
        <>
          <Line
            points={[new THREE.Vector3(preview.a[0], Y, preview.a[2]), new THREE.Vector3(preview.b[0], Y, preview.b[2])]}
            color={preview.closing ? '#54e0c7' : '#ffd54f'}
            lineWidth={preview.closing ? 3 : 2}
            dashed
            dashSize={0.2}
            gapSize={0.1}
            depthTest={false}
          />
          <Html position={midpoint(preview.a, preview.b)} center style={{ pointerEvents: 'none' }}>
            <div className="measure-label">
              {preview.closing ? 'schließen ✓' : formatLength(rawDistance(preview.a, preview.b), scaleFactor, unit)}
            </div>
          </Html>
        </>
      )}
      {preview?.type === 'circle' && preview.r > 1e-6 && (
        <>
          <Line points={circlePoints(preview.center, preview.r)} color="#ffd54f" lineWidth={2} dashed dashSize={0.2} gapSize={0.1} depthTest={false} />
          <Html position={[preview.center[0], Y, preview.center[2]]} center style={{ pointerEvents: 'none' }}>
            <div className="measure-label area">r {formatLength(preview.r, scaleFactor, unit)}</div>
          </Html>
        </>
      )}

      {/* pending point markers */}
      {pendingSketch.map((p, i) => (
        <mesh key={i} position={[p[0], Y, p[2]]}>
          <sphereGeometry args={[Math.max(0.03, 0.01), 12, 12]} />
          <meshBasicMaterial color={i === 0 && sketchTool === 'area' ? '#54e0c7' : '#ffd54f'} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
