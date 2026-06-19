import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../store';
import { rawDistance, rawPolylineLength, rawPolygonArea, centroid, midpoint } from '../lib/geometry';
import { formatLength, formatArea } from '../lib/units';
import type { Vec3, Measurement } from '../types';

function useMarkerRadius() {
  const size = useStore((s) => s.modelInfo?.size);
  return useMemo(() => {
    if (!size) return 0.05;
    const maxDim = Math.max(size[0], size[1], size[2]);
    return Math.max(maxDim * 0.005, 1e-4);
  }, [size]);
}

function Marker({ p, radius, color }: { p: Vec3; radius: number; color: string }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial color={color} depthTest={false} />
    </mesh>
  );
}

function Label({ at, text, area }: { at: Vec3; text: string; area?: boolean }) {
  return (
    <Html position={at} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`measure-label${area ? ' area' : ''}`}>{text}</div>
    </Html>
  );
}

function MeasurementItem({ m, radius }: { m: Measurement; radius: number }) {
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const selected = useStore((s) => s.selectedMeasurementId === m.id);
  const select = useStore((s) => s.selectMeasurement);

  const color = selected ? '#ffd54f' : m.type === 'polygon' ? '#54e0c7' : '#4f8cff';
  const linePoints = m.type === 'polygon' ? [...m.points, m.points[0]] : m.points;

  let labelPos: Vec3;
  let labelText: string;
  if (m.type === 'distance') {
    labelPos = midpoint(m.points[0], m.points[1]);
    labelText = formatLength(rawDistance(m.points[0], m.points[1]), scaleFactor, unit);
  } else if (m.type === 'polyline') {
    labelPos = midpoint(m.points[m.points.length - 2], m.points[m.points.length - 1]);
    labelText = formatLength(rawPolylineLength(m.points), scaleFactor, unit);
  } else {
    const c = centroid(m.points);
    labelPos = [c.x, c.y, c.z];
    const area = formatArea(rawPolygonArea(m.points), scaleFactor, unit);
    const perim = formatLength(rawPolylineLength([...m.points, m.points[0]]), scaleFactor, unit);
    labelText = `${area} · U ${perim}`;
  }

  return (
    <group onClick={(e) => { e.stopPropagation(); select(m.id); }}>
      <Line points={linePoints.map((p) => new THREE.Vector3(...p))} color={color} lineWidth={selected ? 3 : 2} depthTest={false} />
      {m.points.map((p, i) => (
        <Marker key={i} p={p} radius={radius} color={color} />
      ))}
      <Label at={labelPos} text={labelText} area={m.type === 'polygon'} />
    </group>
  );
}

export default function MeasurementOverlay() {
  const measurements = useStore((s) => s.measurements);
  const pendingPoints = useStore((s) => s.pendingPoints);
  const calibratePoints = useStore((s) => s.calibratePoints);
  const measureTool = useStore((s) => s.measureTool);
  const mode = useStore((s) => s.mode);
  const hoverPoint = useStore((s) => s.hoverPoint);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const radius = useMarkerRadius();

  const pendingPreview = useMemo(() => {
    if (mode !== 'measure' || pendingPoints.length === 0) return null;
    const pts = [...pendingPoints];
    if (hoverPoint && measureTool !== 'calibrate') pts.push(hoverPoint);
    return pts;
  }, [mode, pendingPoints, hoverPoint, measureTool]);

  return (
    <group>
      {measurements.map((m) => (
        <MeasurementItem key={m.id} m={m} radius={radius} />
      ))}

      {/* pending measurement preview */}
      {pendingPreview && pendingPreview.length >= 2 && (
        <Line
          points={pendingPreview.map((p) => new THREE.Vector3(...p))}
          color="#ffd54f"
          lineWidth={2}
          dashed
          dashSize={radius * 4}
          gapSize={radius * 2}
          depthTest={false}
        />
      )}
      {pendingPoints.map((p, i) => (
        <Marker key={`pp${i}`} p={p} radius={radius} color="#ffd54f" />
      ))}
      {pendingPreview && pendingPreview.length >= 2 && measureTool !== 'polygon' && (
        <Label
          at={midpoint(pendingPreview[pendingPreview.length - 2], pendingPreview[pendingPreview.length - 1])}
          text={formatLength(
            rawDistance(pendingPreview[pendingPreview.length - 2], pendingPreview[pendingPreview.length - 1]),
            scaleFactor,
            unit,
          )}
        />
      )}

      {/* calibration points */}
      {calibratePoints.map((p, i) => (
        <Marker key={`cp${i}`} p={p} radius={radius * 1.2} color="#ff9f43" />
      ))}
      {calibratePoints.length === 2 && (
        <Line points={calibratePoints.map((p) => new THREE.Vector3(...p))} color="#ff9f43" lineWidth={2} depthTest={false} />
      )}
    </group>
  );
}
