import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { ModelInfo, Vec3 } from '../types';

export type ModelFormat = 'stl' | 'obj' | 'ply' | 'gltf' | 'pcd' | 'xyz' | 'unknown';

export function detectFormat(name: string): ModelFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith('.stl')) return 'stl';
  if (lower.endsWith('.obj')) return 'obj';
  if (lower.endsWith('.ply')) return 'ply';
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) return 'gltf';
  if (lower.endsWith('.pcd')) return 'pcd';
  if (lower.endsWith('.xyz')) return 'xyz';
  return 'unknown';
}

const baseName = (path: string) => path.split('/').pop()!.split('\\').pop()!;

/** Default material for geometry-only formats (STL/PLY). */
function defaultMaterial(hasColor: boolean): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color: hasColor ? 0xffffff : 0xb8b8b8,
    vertexColors: hasColor,
    metalness: 0.0,
    roughness: 0.85,
    side: THREE.DoubleSide,
    flatShading: false,
  });
}

function geometryToMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const hasColor = !!geometry.attributes.color;
  const mesh = new THREE.Mesh(geometry, defaultMaterial(hasColor));
  return mesh;
}

/** Build a THREE.Points object for (colored) point clouds. */
function geometryToPoints(geometry: THREE.BufferGeometry): THREE.Points {
  geometry.computeBoundingBox();
  const hasColor = !!geometry.attributes.color;
  const size = new THREE.Vector3();
  geometry.boundingBox!.getSize(size);
  const diag = size.length() || 1;
  const material = new THREE.PointsMaterial({
    size: Math.max(diag * 0.0018, 1e-5),
    sizeAttenuation: true,
    vertexColors: hasColor,
    color: hasColor ? 0xffffff : 0x88aaff,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'pointcloud';
  return points;
}

/** A PLY without faces (no index, no normals) is a point cloud. */
function plyToObject(geometry: THREE.BufferGeometry): THREE.Object3D {
  const isPointCloud = !geometry.index && !geometry.attributes.normal;
  return isPointCloud ? geometryToPoints(geometry) : geometryToMesh(geometry);
}

function makeGLTFLoader(manager?: THREE.LoadingManager): GLTFLoader {
  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  // Decoder files are hosted locally under <base>/draco/ (see public/draco).
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export interface LoadOutput {
  object: THREE.Object3D;
  info: ModelInfo;
}

/** Compute triangle count + bounding box size of a loaded object. */
export function computeModelInfo(object: THREE.Object3D, fileName: string): ModelInfo {
  let triangleCount = 0;
  let pointCount = 0;
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const geom = mesh.geometry as THREE.BufferGeometry;
      if (geom.index) triangleCount += geom.index.count / 3;
      else if (geom.attributes.position) triangleCount += geom.attributes.position.count / 3;
    } else if ((child as THREE.Points).isPoints) {
      const geom = (child as THREE.Points).geometry as THREE.BufferGeometry;
      if (geom.attributes.position) pointCount += geom.attributes.position.count;
    }
  });
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return {
    triangleCount: Math.round(triangleCount),
    pointCount,
    size: [size.x, size.y, size.z] as Vec3,
    fileName,
  };
}

type ProgressCb = (fraction: number) => void;

// ---------------------------------------------------------------------------
// Loading from local File objects (drag & drop). Supports OBJ multi-file sets.
// ---------------------------------------------------------------------------

export async function loadFromFiles(files: File[], onProgress?: ProgressCb): Promise<LoadOutput> {
  // Identify the primary model file.
  const primary = files.find((f) => {
    const fmt = detectFormat(f.name);
    return fmt !== 'unknown';
  });
  if (!primary) {
    throw new Error('Keine unterstützte Modelldatei gefunden (STL, OBJ, PLY, GLB/GLTF).');
  }
  const format = detectFormat(primary.name);

  // Map basename -> blob URL for every dropped file (used to resolve OBJ/MTL/textures/gltf bins).
  const urlMap = new Map<string, string>();
  const objectUrls: string[] = [];
  for (const f of files) {
    const url = URL.createObjectURL(f);
    urlMap.set(baseName(f.name).toLowerCase(), url);
    objectUrls.push(url);
  }

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    // three may pass blob: URLs straight through; also resolve by basename.
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    const key = baseName(url).toLowerCase();
    return urlMap.get(key) ?? url;
  });

  const primaryUrl = urlMap.get(baseName(primary.name).toLowerCase())!;

  try {
    let object: THREE.Object3D;
    switch (format) {
      case 'stl': {
        const geom = await new STLLoader(manager).loadAsync(primaryUrl, (e) => report(e, onProgress));
        object = geometryToMesh(geom);
        break;
      }
      case 'ply': {
        const geom = await new PLYLoader(manager).loadAsync(primaryUrl, (e) => report(e, onProgress));
        object = plyToObject(geom);
        break;
      }
      case 'pcd': {
        const pts = await new PCDLoader(manager).loadAsync(primaryUrl, (e) => report(e, onProgress));
        object = geometryToPoints(pts.geometry);
        break;
      }
      case 'xyz': {
        const geom = await new XYZLoader(manager).loadAsync(primaryUrl, (e) => report(e, onProgress));
        object = geometryToPoints(geom);
        break;
      }
      case 'obj': {
        // Find a matching MTL among dropped files.
        const mtlFile = files.find((f) => f.name.toLowerCase().endsWith('.mtl'));
        const objLoader = new OBJLoader(manager);
        if (mtlFile) {
          const mtlUrl = urlMap.get(baseName(mtlFile.name).toLowerCase())!;
          const materials = await new MTLLoader(manager).loadAsync(mtlUrl);
          materials.preload();
          objLoader.setMaterials(materials);
        }
        object = await objLoader.loadAsync(primaryUrl, (e) => report(e, onProgress));
        normalizeObjMaterials(object);
        break;
      }
      case 'gltf': {
        const gltf = await makeGLTFLoader(manager).loadAsync(primaryUrl, (e) => report(e, onProgress));
        object = gltf.scene;
        break;
      }
      default:
        throw new Error('Format nicht unterstützt.');
    }
    const info = computeModelInfo(object, primary.name);
    // Stash object URLs so the caller can revoke them later.
    (object.userData as Record<string, unknown>).objectUrls = objectUrls;
    return { object, info };
  } catch (err) {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Loading from a URL (?model=). Optional &mtl= for OBJ. Textures resolve
// relative to the file's directory.
// ---------------------------------------------------------------------------

export async function loadFromUrl(
  modelUrl: string,
  opts: { mtlUrl?: string } = {},
  onProgress?: ProgressCb,
): Promise<LoadOutput> {
  const format = detectFormat(modelUrl);
  const fileName = baseName(modelUrl.split('?')[0]);

  let object: THREE.Object3D;
  switch (format) {
    case 'stl': {
      const geom = await new STLLoader().loadAsync(modelUrl, (e) => report(e, onProgress));
      object = geometryToMesh(geom);
      break;
    }
    case 'ply': {
      const geom = await new PLYLoader().loadAsync(modelUrl, (e) => report(e, onProgress));
      object = plyToObject(geom);
      break;
    }
    case 'pcd': {
      const pts = await new PCDLoader().loadAsync(modelUrl, (e) => report(e, onProgress));
      object = geometryToPoints(pts.geometry);
      break;
    }
    case 'xyz': {
      const geom = await new XYZLoader().loadAsync(modelUrl, (e) => report(e, onProgress));
      object = geometryToPoints(geom);
      break;
    }
    case 'obj': {
      const objLoader = new OBJLoader();
      const mtlUrl = opts.mtlUrl ?? modelUrl.replace(/\.obj($|\?)/i, '.mtl$1');
      try {
        const mtlLoader = new MTLLoader();
        const dir = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);
        mtlLoader.setResourcePath(dir);
        const materials = await mtlLoader.loadAsync(mtlUrl);
        materials.preload();
        objLoader.setMaterials(materials);
      } catch {
        // No MTL available — fall back to default material.
      }
      object = await objLoader.loadAsync(modelUrl, (e) => report(e, onProgress));
      normalizeObjMaterials(object);
      break;
    }
    case 'gltf': {
      const gltf = await makeGLTFLoader().loadAsync(modelUrl, (e) => report(e, onProgress));
      object = gltf.scene;
      break;
    }
    default:
      throw new Error(`Unbekanntes Format für URL: ${fileName}`);
  }
  const info = computeModelInfo(object, fileName);
  return { object, info };
}

function report(e: ProgressEvent, cb?: ProgressCb) {
  if (cb && e.lengthComputable && e.total > 0) cb(e.loaded / e.total);
}

/** Ensure OBJ meshes have usable, double-sided materials. */
function normalizeObjMaterials(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (m && 'side' in m) (m as THREE.Material).side = THREE.DoubleSide;
    });
  });
}

/** Classify a thrown error into a user-facing message. */
export function describeLoadError(err: unknown, url?: string): { message: string; detail?: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const isCrossOrigin = url && /^https?:\/\//i.test(url) && !url.startsWith(window.location.origin);
  if (isCrossOrigin && /fetch|network|load|cors/i.test(raw)) {
    return {
      message: 'Quelle erlaubt kein Cross-Origin-Laden (CORS) oder ist nicht erreichbar.',
      detail: raw,
    };
  }
  if (/404|not found/i.test(raw)) {
    return { message: 'Datei nicht gefunden — bitte URL prüfen.', detail: raw };
  }
  return { message: 'Modell konnte nicht geladen werden.', detail: raw };
}
