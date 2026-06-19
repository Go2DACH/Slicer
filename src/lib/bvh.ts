import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

/**
 * Patch three.js prototypes so all meshes use the BVH-accelerated raycast.
 * This is essential for picking points on large scans (millions of triangles).
 * Call once at startup.
 */
let patched = false;
export function installBVH() {
  if (patched) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  patched = true;
}

/** Build a BVH on every mesh geometry in the given object tree. */
export function buildBVH(object: THREE.Object3D) {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const geom = (child as THREE.Mesh).geometry as THREE.BufferGeometry & {
        computeBoundsTree?: () => void;
        boundsTree?: unknown;
      };
      if (geom && !geom.boundsTree && typeof geom.computeBoundsTree === 'function') {
        try {
          geom.computeBoundsTree();
        } catch {
          /* non-indexed or degenerate geometry — skip silently */
        }
      }
    }
  });
}
