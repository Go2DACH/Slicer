import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { Wall, Opening, Vec3 } from '../types';
import { rawPolygonArea, rawPolylineLength } from './geometry';
import { buildBimGroup } from './bimGeometry';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/** Export the BIM model as JSON, including real-unit dimensions. */
export function exportJson(
  walls: Wall[],
  openings: Opening[],
  scaleFactor: number,
  unit: string,
  calibrated: boolean,
  boundary: Vec3[] = [],
): string {
  const data = {
    schema: 'slicer-bim/1',
    generatedAt: new Date().toISOString(),
    calibration: { scaleFactor, unit, calibrated },
    boundary:
      boundary.length >= 3
        ? {
            points: boundary.map((p) => ({ x: p[0] * scaleFactor, z: p[2] * scaleFactor })),
            perimeter: rawPolylineLength([...boundary, boundary[0]]) * scaleFactor,
            area: rawPolygonArea(boundary) * scaleFactor * scaleFactor,
          }
        : null,
    walls: walls.map((w) => ({
      id: w.id,
      name: w.name,
      start: { x: w.start[0] * scaleFactor, z: w.start[2] * scaleFactor },
      end: { x: w.end[0] * scaleFactor, z: w.end[2] * scaleFactor },
      length: Math.hypot(w.end[0] - w.start[0], w.end[2] - w.start[2]) * scaleFactor,
      thickness: w.thickness,
      height: w.height,
    })),
    openings: openings.map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      wallId: o.wallId,
      position: o.t,
      width: o.width,
      height: o.height,
      sill: o.sill,
    })),
  };
  return JSON.stringify(data, null, 2);
}

/** Export the drawn BIM model as a binary GLB. */
export async function exportGlb(walls: Wall[], openings: Opening[], scaleFactor: number): Promise<ArrayBuffer> {
  const group = buildBimGroup(walls, openings, scaleFactor, { transparent: false });
  // Scale to real units so the GLB has real-world dimensions.
  group.scale.setScalar(scaleFactor);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      group,
      (result) => resolve(result as ArrayBuffer),
      (err) => reject(err),
      { binary: true },
    );
  });
}

/** Capture a PNG screenshot of the current WebGL canvas. */
export function captureScreenshot(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Blob | null {
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: 'image/png' });
}
