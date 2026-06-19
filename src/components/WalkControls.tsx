import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { useStore } from '../store';

/**
 * First-person walkthrough navigation ("Begehung").
 * Click to capture the mouse for looking around; move with WASD, Q/E (or
 * Space/C) for up/down, Shift to sprint. Esc releases the mouse.
 * Movement is horizontal relative to the view yaw so it feels like walking.
 */
export default function WalkControls() {
  const { camera, scene } = useThree();
  const controlsRef = useRef<PointerLockControlsImpl>(null);
  const keys = useRef<Record<string, boolean>>({});

  const modelObject = useStore((s) => s.modelObject);
  const alignApplied = useStore((s) => s.alignApplied);
  const size = useStore((s) => s.modelInfo?.size);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const calibrated = useStore((s) => s.calibrated);

  const maxDim = size ? Math.max(...size) : 10;
  // Walking speed (units per second) and eye height in raw model units.
  const speed = useMemo(() => maxDim * 0.45, [maxDim]);
  const eyeHeight = useMemo(
    () => (calibrated ? 1.7 / (scaleFactor || 1) : maxDim * 0.04),
    [calibrated, scaleFactor, maxDim],
  );

  // Place the camera inside the model at eye height on entering walk mode.
  useEffect(() => {
    if (!modelObject) return;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modelObject);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    // floor height: aligned models sit at y=0, otherwise use the bbox bottom
    const floorY = alignApplied ? 0 : box.min.y;
    camera.position.set(center.x, floorY + eyeHeight, center.z);
    camera.lookAt(center.x + 1, floorY + eyeHeight, center.z);
    camera.near = Math.max(maxDim / 2000, 1e-3);
    camera.far = maxDim * 50;
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelObject]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keys.current = {};
    };
  }, []);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useFrame((_, dtRaw) => {
    const k = keys.current;
    const dt = Math.min(dtRaw, 0.05);
    const f = forward.current.set(0, 0, 0);
    camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-8) f.set(1, 0, 0);
    f.normalize();
    const r = right.current.setFromMatrixColumn(camera.matrix, 0);
    r.y = 0;
    r.normalize();

    const v = move.current.set(0, 0, 0);
    if (k['KeyW'] || k['ArrowUp']) v.add(f);
    if (k['KeyS'] || k['ArrowDown']) v.sub(f);
    if (k['KeyD'] || k['ArrowRight']) v.add(r);
    if (k['KeyA'] || k['ArrowLeft']) v.sub(r);
    if (k['Space'] || k['KeyE']) v.y += 1;
    if (k['KeyC'] || k['KeyQ']) v.y -= 1;

    if (v.lengthSq() > 0) {
      const sprint = k['ShiftLeft'] || k['ShiftRight'] ? 3 : 1;
      v.normalize().multiplyScalar(speed * sprint * dt);
      camera.position.add(v);
    }
  });

  return <PointerLockControls ref={controlsRef} makeDefault selector="#walk-lock-target" />;
}
