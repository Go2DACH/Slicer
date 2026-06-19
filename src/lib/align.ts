import * as THREE from 'three';
import type { Vec3 } from '../types';
import { bestFitNormal, planeNormalFromThree } from './geometry';

const UP = new THREE.Vector3(0, 1, 0);

export interface AlignResult {
  quaternion: [number, number, number, number];
  offset: Vec3;
  /** Maps a current-world point to the new-world frame (for annotations). */
  delta: (p: Vec3) => Vec3;
}

function compose(
  rExtra: THREE.Quaternion,
  tExtra: THREE.Vector3,
  currentQuat: [number, number, number, number],
  currentOffset: Vec3,
): AlignResult {
  const rOld = new THREE.Quaternion(currentQuat[0], currentQuat[1], currentQuat[2], currentQuat[3]);
  const pOld = new THREE.Vector3(currentOffset[0], currentOffset[1], currentOffset[2]);

  const rNew = rExtra.clone().multiply(rOld);
  const pNew = pOld.clone().applyQuaternion(rExtra).add(tExtra);

  const delta = (p: Vec3): Vec3 => {
    const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(rExtra).add(tExtra);
    return [v.x, v.y, v.z];
  };

  return {
    quaternion: [rNew.x, rNew.y, rNew.z, rNew.w],
    offset: [pNew.x, pNew.y, pNew.z],
    delta,
  };
}

/**
 * Compute alignment that makes the floor (defined by 3 picked points) horizontal
 * and places it at world Y=0.
 */
export function computeFloorAlign(
  points: Vec3[],
  currentQuat: [number, number, number, number],
  currentOffset: Vec3,
): AlignResult {
  let n = points.length >= 3 ? planeNormalFromThree(points[0], points[1], points[2]) : bestFitNormal(points);
  // Ensure normal points "up" (floor seen from above).
  if (n.dot(UP) < 0) n = n.clone().negate();

  const rExtra = new THREE.Quaternion().setFromUnitVectors(n, UP);

  // After rotation, find floor height to bring it to y=0.
  let avgY = 0;
  for (const p of points) {
    const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(rExtra);
    avgY += v.y;
  }
  avgY /= points.length || 1;
  const tExtra = new THREE.Vector3(0, -avgY, 0);

  return compose(rExtra, tExtra, currentQuat, currentOffset);
}

/**
 * Compute rotation about the vertical axis so the wall defined by 2 points
 * becomes parallel to the world X axis. Assumes floor is already horizontal.
 */
export function computeWallAlign(
  points: Vec3[],
  currentQuat: [number, number, number, number],
  currentOffset: Vec3,
): AlignResult {
  const a = points[0];
  const b = points[1];
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const angle = Math.atan2(dz, dx); // current angle of wall in XZ
  // rotate by -angle about Y so the wall aligns with +X
  const rExtra = new THREE.Quaternion().setFromAxisAngle(UP, -angle);
  const tExtra = new THREE.Vector3(0, 0, 0);
  return compose(rExtra, tExtra, currentQuat, currentOffset);
}
