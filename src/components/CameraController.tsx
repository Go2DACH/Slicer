import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store';
import WalkControls from './WalkControls';

export default function CameraController() {
  const modelObject = useStore((s) => s.modelObject);
  const alignQuaternion = useStore((s) => s.alignQuaternion);
  const alignOffset = useStore((s) => s.alignOffset);
  const resetViewToken = useStore((s) => s.resetViewToken);
  const topDown = useStore((s) => s.topDown);
  const walkMode = useStore((s) => s.walkMode);

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const perspRef = useRef<THREE.PerspectiveCamera>(null);
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const { size, scene } = useThree();

  // Fit the active camera to the model bounding box.
  const fit = () => {
    if (!modelObject || walkMode) return;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modelObject);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    const sphere = new THREE.Sphere();
    box.getCenter(center);
    box.getBoundingSphere(sphere);
    const radius = Math.max(sphere.radius, 1e-3);
    const controls = controlsRef.current;

    if (topDown && orthoRef.current) {
      const cam = orthoRef.current;
      cam.position.set(center.x, center.y + radius * 4, center.z + 0.0001);
      cam.up.set(0, 0, -1);
      cam.near = 0.01;
      cam.far = radius * 40;
      const aspect = size.width / size.height;
      const fitR = radius * 1.15;
      cam.left = -fitR * aspect;
      cam.right = fitR * aspect;
      cam.top = fitR;
      cam.bottom = -fitR;
      cam.zoom = 1;
      cam.updateProjectionMatrix();
      cam.lookAt(center);
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
    } else if (perspRef.current) {
      const cam = perspRef.current;
      const fov = (cam.fov * Math.PI) / 180;
      const dist = (radius / Math.sin(fov / 2)) * 1.2;
      const dir = new THREE.Vector3(1, 0.7, 1).normalize();
      cam.position.copy(center).addScaledVector(dir, dist);
      cam.near = dist / 100;
      cam.far = dist * 100;
      cam.up.set(0, 1, 0);
      cam.updateProjectionMatrix();
      cam.lookAt(center);
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
    }
  };

  // Refit on relevant changes.
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelObject, resetViewToken, topDown, size.width, size.height, alignQuaternion, alignOffset]);

  return (
    <>
      <PerspectiveCamera ref={perspRef} makeDefault={!topDown} fov={walkMode ? 70 : 50} position={[5, 5, 5]} />
      <OrthographicCamera ref={orthoRef} makeDefault={topDown} position={[0, 100, 0]} />
      {walkMode ? (
        <WalkControls />
      ) : (
        <OrbitControls
          key={topDown ? 'ortho' : 'persp'}
          ref={controlsRef}
          makeDefault
          enableRotate={!topDown}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.9}
          // In plan view left-drag pans; otherwise it orbits. Point picking uses
          // click-vs-drag detection, so left-drag-to-orbit doesn't place points.
          mouseButtons={{
            LEFT: topDown ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
      )}
    </>
  );
}
