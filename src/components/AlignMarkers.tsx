import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useStore } from '../store';
import type { Vec3 } from '../types';

const COLORS = ['#ff5c5c', '#54e0c7', '#4f8cff'];

export default function AlignMarkers() {
  const alignPoints = useStore((s) => s.alignPoints);
  const size = useStore((s) => s.modelInfo?.size);
  const radius = useMemo(() => {
    if (!size) return 0.05;
    return Math.max(Math.max(size[0], size[1], size[2]) * 0.006, 1e-4);
  }, [size]);

  if (alignPoints.length === 0) return null;

  return (
    <group>
      {alignPoints.map((p: Vec3, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[radius, 16, 16]} />
          <meshBasicMaterial color={COLORS[i % COLORS.length]} depthTest={false} />
        </mesh>
      ))}
      {alignPoints.length >= 2 && (
        <Line
          points={[...alignPoints, alignPoints[0]].map((p) => new THREE.Vector3(...p))}
          color="#ffd54f"
          lineWidth={2}
          depthTest={false}
        />
      )}
    </group>
  );
}
