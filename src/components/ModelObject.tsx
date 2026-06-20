import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { buildBVH } from '../lib/bvh';
import { snapDrawPoint } from '../lib/drawSnap';
import { METERS_PER_UNIT } from '../lib/units';
import type { Vec3 } from '../types';

interface PickEvent {
  point: THREE.Vector3;
  intersections?: { point: THREE.Vector3; object: THREE.Object3D }[];
  stopPropagation: () => void;
  button?: number;
  delta?: number;
}

interface Props {
  onPick: (point: THREE.Vector3, event: { stopPropagation: () => void }) => void;
  onHover: (point: THREE.Vector3 | null) => void;
}

/**
 * Renders the loaded model inside a group carrying the alignment transform.
 * Builds a BVH on all meshes for fast picking, manages clipping planes (BIM
 * section slab + the global "hide above" section) and X-ray transparency.
 */
export default function ModelObject({ onPick, onHover }: Props) {
  const modelObject = useStore((s) => s.modelObject);
  const alignQuaternion = useStore((s) => s.alignQuaternion);
  const alignOffset = useStore((s) => s.alignOffset);
  const mode = useStore((s) => s.mode);
  const drawSettings = useStore((s) => s.drawSettings);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const xray = useStore((s) => s.xray);
  const clipEnabled = useStore((s) => s.clipEnabled);
  const clipPercent = useStore((s) => s.clipPercent);
  const groupRef = useRef<THREE.Group>(null);

  // World-space vertical extent of the (aligned) model, for the section slider.
  const [worldY, setWorldY] = useState<{ min: number; max: number } | null>(null);
  useEffect(() => {
    if (!modelObject) {
      setWorldY(null);
      return;
    }
    const id = requestAnimationFrame(() => {
      modelObject.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(modelObject);
      if (!box.isEmpty()) setWorldY({ min: box.min.y, max: box.max.y });
    });
    return () => cancelAnimationFrame(id);
  }, [modelObject, alignQuaternion, alignOffset]);

  const cutY = worldY ? worldY.min + (clipPercent / 100) * (worldY.max - worldY.min) : Infinity;

  // "Fläche fangen": project a surface hit onto the floor plane (Y=0) and draw there.
  const surfaceDrawActive = mode === 'draw' && drawSettings.surfaceSnap && !openingPlaceType;
  const doSurfaceDraw = (point: THREE.Vector3, commit: boolean) => {
    const st = useStore.getState();
    const size = st.modelInfo?.size;
    const maxDim = size ? Math.max(...size) : 10;
    const snapped = snapDrawPoint([point.x, 0, point.z] as Vec3, {
      walls: st.walls,
      rooms: st.rooms,
      pendingWallPoints: st.pendingWallPoints,
      drawSettings: st.drawSettings,
      maxDim,
      metersPerRaw: st.scaleFactor * (METERS_PER_UNIT[st.unit] ?? 1),
      rect: st.drawTool === 'rect',
    });
    if (commit) st.addDrawPoint(snapped);
    else st.setHoverPoint(snapped);
  };

  // Build BVH whenever the model changes.
  useEffect(() => {
    if (modelObject) buildBVH(modelObject);
  }, [modelObject]);

  // Combined clipping planes: BIM section slab + global "hide above" cut.
  const sectionActive = mode === 'draw' && drawSettings.sectionEnabled;
  const planes = useMemo(() => {
    const list: THREE.Plane[] = [];
    if (clipEnabled && worldY) {
      // keep y <= cutY  ->  hide everything above the cut
      list.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), cutY));
    }
    if (sectionActive) {
      const yRaw = drawSettings.sectionHeight / (scaleFactor || 1);
      const bandRaw = 0.06 / (scaleFactor || 1);
      list.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), yRaw + bandRaw));
      list.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(yRaw - bandRaw)));
    }
    return list;
  }, [clipEnabled, worldY, cutY, sectionActive, drawSettings.sectionHeight, scaleFactor]);

  // Apply clipping planes + X-ray transparency to all materials.
  useEffect(() => {
    if (!modelObject) return;
    modelObject.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const pts = child as unknown as THREE.Points;
      if (!mesh.isMesh && !pts.isPoints) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const mat = m as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
        const ud = mat.userData as { _origOpacity?: number; _origTransparent?: boolean; _origDepthWrite?: boolean };
        if (ud._origOpacity === undefined) {
          ud._origOpacity = mat.opacity;
          ud._origTransparent = mat.transparent;
          ud._origDepthWrite = mat.depthWrite;
        }
        if (xray) {
          mat.transparent = true;
          mat.opacity = 0.5;
          mat.depthWrite = false;
        } else {
          mat.opacity = ud._origOpacity!;
          mat.transparent = ud._origTransparent!;
          mat.depthWrite = ud._origDepthWrite!;
        }
        mat.clippingPlanes = planes.length ? planes : null;
        mat.clipIntersection = false;
        mat.needsUpdate = true;
      });
    });
  }, [modelObject, planes, xray]);

  if (!modelObject) return null;

  const q = new THREE.Quaternion(alignQuaternion[0], alignQuaternion[1], alignQuaternion[2], alignQuaternion[3]);

  const isModelHit = (o: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = o;
    while (cur) {
      if (cur === modelObject) return true;
      cur = cur.parent;
    }
    return false;
  };

  // When the section is active, ignore hits above the cut so you can pick the
  // visible (lower) surface even though the top is hidden.
  const pickPoint = (e: PickEvent): THREE.Vector3 | null => {
    if (clipEnabled && worldY && e.intersections) {
      const hit = e.intersections.find((i) => isModelHit(i.object) && i.point.y <= cutY + 1e-4);
      return hit ? hit.point.clone() : null;
    }
    return e.point.clone();
  };

  return (
    <group ref={groupRef} quaternion={q} position={alignOffset}>
      <primitive
        object={modelObject}
        onClick={(e: PickEvent) => {
          if (e.button !== undefined && e.button !== 0) return;
          if (e.delta !== undefined && e.delta > 6) return;
          const p = pickPoint(e);
          if (!p) return;
          if (mode === 'measure' || mode === 'align') {
            onPick(p, e);
          } else if (surfaceDrawActive) {
            e.stopPropagation();
            doSurfaceDraw(p, true);
          }
        }}
        onPointerMove={(e: PickEvent) => {
          if (mode === 'measure' || mode === 'align') {
            const p = pickPoint(e);
            onHover(p);
          } else if (surfaceDrawActive) {
            const p = pickPoint(e);
            if (p) {
              e.stopPropagation();
              doSurfaceDraw(p, false);
            }
          }
        }}
        onPointerOut={() => onHover(null)}
      />
    </group>
  );
}
