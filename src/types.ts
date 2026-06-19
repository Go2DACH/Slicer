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
}

export interface ModelInfo {
  triangleCount: number;
  /** Bounding box size in raw model units [x, y, z]. */
  size: Vec3;
  fileName: string;
}

export interface LoadError {
  message: string;
  detail?: string;
}

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
  /** Snap to 90/45 degree angles while drawing. */
  angleSnap: boolean;
  /** Snap to existing endpoints. */
  endpointSnap: boolean;
}
