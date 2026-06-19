import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useStore } from '../store';
import CameraController from './CameraController';
import ModelObject from './ModelObject';
import MeasurementOverlay from './MeasurementOverlay';
import AlignMarkers from './AlignMarkers';
import BimOverlay from './BimOverlay';
import GroundPlane from './GroundPlane';
import type { Vec3 } from '../types';

function Lights() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <hemisphereLight args={[0xffffff, 0x444455, 0.6]} />
      <directionalLight position={[5, 10, 7]} intensity={1.1} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} />
    </>
  );
}

export default function Scene() {
  const modelInfo = useStore((s) => s.modelInfo);
  const showGrid = useStore((s) => s.showGrid);
  const showAxes = useStore((s) => s.showAxes);
  const mode = useStore((s) => s.mode);
  const walls = useStore((s) => s.walls);
  const measureTool = useStore((s) => s.measureTool);
  const addPickPoint = useStore((s) => s.addPickPoint);
  const addAlignPoint = useStore((s) => s.addAlignPoint);
  const setHoverPoint = useStore((s) => s.setHoverPoint);

  const maxDim = modelInfo ? Math.max(...modelInfo.size) : 10;
  const gridSize = Math.max(maxDim * 4, 10);
  const axesSize = Math.max(maxDim * 0.6, 1);
  const cellSize = useMemo(() => {
    const raw = maxDim / 20;
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-3))));
    return pow;
  }, [maxDim]);

  const handlePick = (point: THREE.Vector3) => {
    const arr = [point.x, point.y, point.z] as Vec3;
    if (mode === 'measure') addPickPoint(arr);
    else if (mode === 'align') addAlignPoint(arr);
  };
  const handleHover = (point: THREE.Vector3 | null) => {
    if (mode === 'measure' && measureTool !== 'calibrate') setHoverPoint(point ? [point.x, point.y, point.z] : null);
  };

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ localClippingEnabled: true, preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#0d1014'), 1);
        gl.localClippingEnabled = true;
      }}
    >
      <Lights />
      <CameraController />

      <ModelObject onPick={handlePick} onHover={handleHover} />

      <MeasurementOverlay />
      <AlignMarkers />

      {(mode === 'draw' || walls.length > 0) && <BimOverlay />}
      {mode === 'draw' && <GroundPlane />}

      {showGrid && (
        <Grid
          args={[gridSize, gridSize]}
          cellSize={cellSize}
          cellThickness={0.6}
          cellColor="#2c3440"
          sectionSize={cellSize * 5}
          sectionThickness={1}
          sectionColor="#3a4a5a"
          fadeDistance={gridSize * 1.4}
          fadeStrength={1}
          infiniteGrid
          followCamera={false}
        />
      )}
      {showAxes && <axesHelper args={[axesSize]} />}
    </Canvas>
  );
}
