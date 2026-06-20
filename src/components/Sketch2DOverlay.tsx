import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../store';
import { rawDistance, midpoint } from '../lib/geometry';
import { formatLength } from '../lib/units';
import type { Vec3 } from '../types';

const Y = 0.03;

function circlePoints(center: Vec3, r: number, segments = 64): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(center[0] + Math.cos(a) * r, Y, center[2] + Math.sin(a) * r));
  }
  return pts;
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

  const preview = useMemo(() => {
    if (!drawing || pendingSketch.length === 0 || !hoverPoint) return null;
    const origin = pendingSketch[pendingSketch.length - 1];
    if (sketchTool === 'line') {
      return { type: 'line' as const, a: origin, b: hoverPoint };
    }
    const r = Math.hypot(hoverPoint[0] - origin[0], hoverPoint[2] - origin[2]);
    return { type: 'circle' as const, center: origin, r };
  }, [drawing, pendingSketch, hoverPoint, sketchTool]);

  return (
    <group>
      {lines.map((l) => {
        const sel = selectedSketchId === l.id;
        return (
          <group key={l.id} onClick={(e) => { e.stopPropagation(); selectSketch(l.id); }}>
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
          <group key={c.id} onClick={(e) => { e.stopPropagation(); selectSketch(c.id); }}>
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
            color="#ffd54f"
            lineWidth={2}
            dashed
            dashSize={0.2}
            gapSize={0.1}
            depthTest={false}
          />
          <Html position={midpoint(preview.a, preview.b)} center style={{ pointerEvents: 'none' }}>
            <div className="measure-label">{formatLength(rawDistance(preview.a, preview.b), scaleFactor, unit)}</div>
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
          <meshBasicMaterial color="#ffd54f" depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
