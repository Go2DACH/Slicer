import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { buildBVH } from '../lib/bvh';

interface Props {
  onPick: (point: THREE.Vector3, event: { stopPropagation: () => void }) => void;
  onHover: (point: THREE.Vector3 | null) => void;
}

/**
 * Renders the loaded model inside a group carrying the alignment transform.
 * Builds a BVH on all meshes for fast picking and manages clipping planes
 * for the section view.
 */
export default function ModelObject({ onPick, onHover }: Props) {
  const modelObject = useStore((s) => s.modelObject);
  const alignQuaternion = useStore((s) => s.alignQuaternion);
  const alignOffset = useStore((s) => s.alignOffset);
  const mode = useStore((s) => s.mode);
  const drawSettings = useStore((s) => s.drawSettings);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const groupRef = useRef<THREE.Group>(null);

  // Build BVH whenever the model changes.
  useEffect(() => {
    if (modelObject) buildBVH(modelObject);
  }, [modelObject]);

  // Section clipping planes (a thin horizontal slab around the cut height).
  const planes = useMemo(() => {
    const yRaw = drawSettings.sectionHeight / (scaleFactor || 1);
    const bandRaw = 0.06 / (scaleFactor || 1);
    return [
      new THREE.Plane(new THREE.Vector3(0, -1, 0), yRaw + bandRaw),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -(yRaw - bandRaw)),
    ];
  }, [drawSettings.sectionHeight, scaleFactor]);

  const sectionActive = mode === 'draw' && drawSettings.sectionEnabled;

  useEffect(() => {
    if (!modelObject) return;
    modelObject.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        m.clippingPlanes = sectionActive ? planes : null;
        m.clipIntersection = false;
        m.needsUpdate = true;
      });
    });
  }, [modelObject, sectionActive, planes]);

  if (!modelObject) return null;

  const q = new THREE.Quaternion(alignQuaternion[0], alignQuaternion[1], alignQuaternion[2], alignQuaternion[3]);

  return (
    <group ref={groupRef} quaternion={q} position={alignOffset}>
      <primitive
        object={modelObject}
        onClick={(e: { point: THREE.Vector3; stopPropagation: () => void; button?: number; delta?: number }) => {
          if (e.button !== undefined && e.button !== 0) return;
          // ignore clicks that were actually drags (orbit)
          if (e.delta !== undefined && e.delta > 6) return;
          if (mode === 'measure' || mode === 'align') {
            onPick(e.point.clone(), e);
          }
        }}
        onPointerMove={(e: { point: THREE.Vector3 }) => {
          if (mode === 'measure' || mode === 'align') onHover(e.point.clone());
        }}
        onPointerOut={() => onHover(null)}
      />
    </group>
  );
}
