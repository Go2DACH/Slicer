export type Vec3 = [number, number, number];

export type AppMode = 'view' | 'measure' | 'align' | 'draw' | 'export';

export type MeasureTool = 'distance' | 'polyline' | 'polygon' | 'calibrate';

export type MeasurementType = 'distance' | 'polyline' | 'polygon';

export interface Measurement {
  id: string;
  type: MeasurementType;
  /** Points in world space (after model alignment). */
  points: Vec3[];
  name: string;
}

export type AlignTool = 'floor' | 'wall';

/** Drawn 2D-BIM wall. Endpoints live on the floor plane (world XZ, Y=0). */
export interface Wall {
  id: string;
  name: string;
  /** Start point on floor plane, world coords [x, 0, z]. */
  start: Vec3;
  /** End point on floor plane, world coords [x, 0, z]. */
  end: Vec3;
  /** Thickness in real units (after calibration). */
  thickness: number;
  /** Height in real units. */
  height: number;
}

export type OpeningType = 'door' | 'window';

/** Door or window placed on a wall. */
export interface Opening {
  id: string;
  name: string;
  type: OpeningType;
  wallId: string;
  /** Position along the wall (0..1) of the opening center. */
  t: number;
  /** Width in real units. */
  width: number;
  /** Height in real units. */
  height: number;
  /** Sill height (bottom above floor) in real units. 0 for doors. */
  sill: number;
  /** Opening/swing direction: false = default (inward), true = reversed. */
  flip: boolean;
  /** Hinge on the +along side (true) or -along side (false). Doors only. */
  hingeRight: boolean;
}

/** A closed room polygon derived from a closed wall chain. */
export interface Room {
  id: string;
  name: string;
  /** Polygon points on the floor plane (world coords, Y=0). */
  points: Vec3[];
}

export interface ModelInfo {
  triangleCount: number;
  /** Number of points for point-cloud models (0 for meshes). */
  pointCount: number;
  /** Bounding box size in raw model units [x, y, z]. */
  size: Vec3;
  fileName: string;
}

export interface LoadError {
  message: string;
  detail?: string;
}

/** Camera view preset. */
export type CameraView = 'free' | 'top' | 'bottom';

export interface DrawSettings {
  wallThickness: number;
  wallHeight: number;
  doorWidth: number;
  doorHeight: number;
  windowWidth: number;
  windowHeight: number;
  windowSill: number;
  /** Section cut height (real units) for the horizontal clip plane. */
  sectionHeight: number;
  sectionEnabled: boolean;
  /** Snap new wall directions to the allowed angle raster. */
  angleSnap: boolean;
  /** Snap to existing endpoints/points ("Punkt fangen"). */
  endpointSnap: boolean;
  /** Snap draw points onto the scan surface ("Fläche fangen"). */
  surfaceSnap: boolean;
  /** Snap new wall length to a grid (e.g. 10 cm steps). */
  gridSnap: boolean;
  /** Grid step in meters for length snapping. */
  gridStepM: number;
}

/** Allowed snap angles (degrees) for new wall directions. */
export const SNAP_ANGLES = [30, 45, 70, 90, 120, 180] as const;
