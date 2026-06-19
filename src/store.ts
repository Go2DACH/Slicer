import { create } from 'zustand';
import type {
  AppMode,
  MeasureTool,
  Measurement,
  MeasurementType,
  AlignTool,
  Wall,
  Opening,
  ModelInfo,
  LoadError,
  DrawSettings,
  Vec3,
} from './types';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

/** A snapshot of undoable editing state. */
interface HistorySnapshot {
  measurements: Measurement[];
  walls: Wall[];
  openings: Opening[];
}

interface AppState {
  // ---- Loading / model ----
  modelObject: import('three').Object3D | null;
  modelInfo: ModelInfo | null;
  loading: boolean;
  loadProgress: number;
  loadError: LoadError | null;
  /** Object URLs created for drag&drop file sets, revoked on replace. */
  objectUrls: string[];

  // ---- View settings ----
  showGrid: boolean;
  showAxes: boolean;
  readonly: boolean;
  resetViewToken: number;

  // ---- Mode ----
  mode: AppMode;
  measureTool: MeasureTool;
  alignTool: AlignTool;

  /** Live cursor hover point on the surface/plane (world coords) for previews. */
  hoverPoint: Vec3 | null;

  // ---- Measurement ----
  measurements: Measurement[];
  /** In-progress point list for the active measurement. */
  pendingPoints: Vec3[];
  selectedMeasurementId: string | null;

  // ---- Calibration ----
  /** Multiply raw world distances by this to get real units. */
  scaleFactor: number;
  calibrated: boolean;
  unit: string;
  /** Pending two points while using the calibrate tool. */
  calibratePoints: Vec3[];

  // ---- Alignment ----
  /** Quaternion (x,y,z,w) applied to the model group. */
  alignQuaternion: [number, number, number, number];
  /** Translation applied to the model group (to put the floor at Y=0). */
  alignOffset: Vec3;
  alignApplied: boolean;
  /** Pending picked points while aligning. */
  alignPoints: Vec3[];

  // ---- Drawing / BIM ----
  walls: Wall[];
  openings: Opening[];
  pendingWallPoints: Vec3[];
  selectedWallId: string | null;
  selectedOpeningId: string | null;
  drawSettings: DrawSettings;
  /** When placing an opening: which type to place next. */
  openingPlaceType: 'door' | 'window' | null;
  topDown: boolean;

  // ---- History ----
  history: HistorySnapshot[];

  // ===== Actions =====
  setModel: (object: import('three').Object3D | null, info: ModelInfo | null, urls?: string[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadProgress: (p: number) => void;
  setLoadError: (e: LoadError | null) => void;

  setShowGrid: (v: boolean) => void;
  setShowAxes: (v: boolean) => void;
  setReadonly: (v: boolean) => void;
  triggerResetView: () => void;

  setMode: (m: AppMode) => void;
  setMeasureTool: (t: MeasureTool) => void;
  setAlignTool: (t: AlignTool) => void;
  setHoverPoint: (p: Vec3 | null) => void;

  addPickPoint: (p: Vec3) => void;
  finishMeasurement: () => void;
  cancelPending: () => void;
  removeMeasurement: (id: string) => void;
  renameMeasurement: (id: string, name: string) => void;
  selectMeasurement: (id: string | null) => void;
  clearMeasurements: () => void;

  applyCalibration: (realDistance: number) => void;
  resetCalibration: () => void;
  setUnit: (u: string) => void;

  setAlignment: (q: [number, number, number, number], offset: Vec3) => void;
  transformAnnotations: (fn: (p: Vec3) => Vec3) => void;
  addAlignPoint: (p: Vec3) => void;
  clearAlignPoints: () => void;
  resetAlignment: () => void;

  // BIM
  addWallSegment: (start: Vec3, end: Vec3) => void;
  setPendingWallPoints: (pts: Vec3[]) => void;
  finishWallChain: () => void;
  removeWall: (id: string) => void;
  renameWall: (id: string, name: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  selectWall: (id: string | null) => void;
  addOpening: (wallId: string, t: number) => void;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  selectOpening: (id: string | null) => void;
  setOpeningPlaceType: (t: 'door' | 'window' | null) => void;
  setDrawSettings: (patch: Partial<DrawSettings>) => void;
  setTopDown: (v: boolean) => void;

  undo: () => void;
  pushHistory: () => void;

  deleteSelection: () => void;
}

const defaultDrawSettings: DrawSettings = {
  wallThickness: 0.2,
  wallHeight: 2.5,
  doorWidth: 0.9,
  doorHeight: 2.0,
  windowWidth: 1.2,
  windowHeight: 1.2,
  windowSill: 0.9,
  sectionHeight: 1.2,
  sectionEnabled: false,
  angleSnap: true,
  endpointSnap: true,
};

export const useStore = create<AppState>((set, get) => ({
  modelObject: null,
  modelInfo: null,
  loading: false,
  loadProgress: 0,
  loadError: null,
  objectUrls: [],

  showGrid: true,
  showAxes: true,
  readonly: false,
  resetViewToken: 0,

  mode: 'view',
  measureTool: 'distance',
  alignTool: 'floor',
  hoverPoint: null,

  measurements: [],
  pendingPoints: [],
  selectedMeasurementId: null,

  scaleFactor: 1,
  calibrated: false,
  unit: 'm',
  calibratePoints: [],

  alignQuaternion: [0, 0, 0, 1],
  alignOffset: [0, 0, 0],
  alignApplied: false,
  alignPoints: [],

  walls: [],
  openings: [],
  pendingWallPoints: [],
  selectedWallId: null,
  selectedOpeningId: null,
  drawSettings: defaultDrawSettings,
  openingPlaceType: null,
  topDown: false,

  history: [],

  setModel: (object, info, urls = []) => {
    // Revoke previous object URLs.
    get().objectUrls.forEach((u) => URL.revokeObjectURL(u));
    set({
      modelObject: object,
      modelInfo: info,
      objectUrls: urls,
      loadError: null,
      // reset edits when a new model is loaded
      measurements: [],
      pendingPoints: [],
      walls: [],
      openings: [],
      pendingWallPoints: [],
      alignQuaternion: [0, 0, 0, 1],
      alignOffset: [0, 0, 0],
      alignApplied: false,
      alignPoints: [],
      history: [],
    });
  },
  setLoading: (loading) => set({ loading, loadProgress: loading ? 0 : get().loadProgress }),
  setLoadProgress: (p) => set({ loadProgress: p }),
  setLoadError: (e) => set({ loadError: e, loading: false }),

  setShowGrid: (v) => set({ showGrid: v }),
  setShowAxes: (v) => set({ showAxes: v }),
  setReadonly: (v) => set({ readonly: v }),
  triggerResetView: () => set({ resetViewToken: get().resetViewToken + 1 }),

  setMode: (m) =>
    set({
      mode: m,
      pendingPoints: [],
      calibratePoints: [],
      alignPoints: [],
      pendingWallPoints: [],
      openingPlaceType: null,
      topDown: m === 'draw' ? get().topDown : false,
    }),
  setMeasureTool: (t) => set({ measureTool: t, pendingPoints: [], calibratePoints: [] }),
  setAlignTool: (t) => set({ alignTool: t, alignPoints: [] }),
  setHoverPoint: (p) => set({ hoverPoint: p }),

  addPickPoint: (p) => {
    const { mode, measureTool } = get();
    if (mode === 'measure') {
      if (measureTool === 'calibrate') {
        const pts = [...get().calibratePoints, p].slice(-2);
        set({ calibratePoints: pts });
        return;
      }
      const pts = [...get().pendingPoints, p];
      set({ pendingPoints: pts });
      // distance auto-finishes at two points
      if (measureTool === 'distance' && pts.length === 2) {
        get().finishMeasurement();
      }
    }
  },

  finishMeasurement: () => {
    const { pendingPoints, measureTool } = get();
    const type = measureTool as MeasurementType;
    const minPoints = type === 'polygon' ? 3 : 2;
    if (pendingPoints.length < minPoints) return;
    get().pushHistory();
    const count = get().measurements.filter((m) => m.type === type).length + 1;
    const labels: Record<MeasurementType, string> = {
      distance: 'Strecke',
      polyline: 'Polylinie',
      polygon: 'Fläche',
    };
    const m: Measurement = {
      id: nextId('meas'),
      type,
      points: pendingPoints,
      name: `${labels[type]} ${count}`,
    };
    set({ measurements: [...get().measurements, m], pendingPoints: [] });
  },

  cancelPending: () =>
    set({ pendingPoints: [], calibratePoints: [], alignPoints: [], pendingWallPoints: [], openingPlaceType: null }),

  removeMeasurement: (id) => {
    get().pushHistory();
    set({
      measurements: get().measurements.filter((m) => m.id !== id),
      selectedMeasurementId: get().selectedMeasurementId === id ? null : get().selectedMeasurementId,
    });
  },
  renameMeasurement: (id, name) =>
    set({ measurements: get().measurements.map((m) => (m.id === id ? { ...m, name } : m)) }),
  selectMeasurement: (id) => set({ selectedMeasurementId: id }),
  clearMeasurements: () => {
    get().pushHistory();
    set({ measurements: [], pendingPoints: [], selectedMeasurementId: null });
  },

  applyCalibration: (realDistance) => {
    const { calibratePoints } = get();
    if (calibratePoints.length < 2 || realDistance <= 0) return;
    const [a, b] = calibratePoints;
    const raw = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (raw <= 0) return;
    set({ scaleFactor: realDistance / raw, calibrated: true, calibratePoints: [] });
  },
  resetCalibration: () => set({ scaleFactor: 1, calibrated: false, calibratePoints: [] }),
  setUnit: (u) => set({ unit: u }),

  setAlignment: (q, offset) => {
    const identity = q[0] === 0 && q[1] === 0 && q[2] === 0 && q[3] === 1 && offset[0] === 0 && offset[1] === 0 && offset[2] === 0;
    set({ alignQuaternion: q, alignOffset: offset, alignApplied: !identity, alignPoints: [] });
  },
  transformAnnotations: (fn) => {
    set({
      measurements: get().measurements.map((m) => ({ ...m, points: m.points.map(fn) })),
      walls: get().walls.map((w) => ({ ...w, start: fn(w.start), end: fn(w.end) })),
      pendingPoints: get().pendingPoints.map(fn),
      pendingWallPoints: get().pendingWallPoints.map(fn),
    });
  },
  addAlignPoint: (p) => {
    const max = get().alignTool === 'floor' ? 3 : 2;
    set({ alignPoints: [...get().alignPoints, p].slice(-max) });
  },
  clearAlignPoints: () => set({ alignPoints: [] }),
  resetAlignment: () => set({ alignQuaternion: [0, 0, 0, 1], alignOffset: [0, 0, 0], alignApplied: false, alignPoints: [] }),

  addWallSegment: (start, end) => {
    get().pushHistory();
    const { drawSettings } = get();
    const wall: Wall = {
      id: nextId('wall'),
      name: `Wand ${get().walls.length + 1}`,
      start,
      end,
      thickness: drawSettings.wallThickness,
      height: drawSettings.wallHeight,
    };
    set({ walls: [...get().walls, wall] });
  },
  setPendingWallPoints: (pts) => set({ pendingWallPoints: pts }),
  finishWallChain: () => set({ pendingWallPoints: [] }),
  removeWall: (id) => {
    get().pushHistory();
    set({
      walls: get().walls.filter((w) => w.id !== id),
      openings: get().openings.filter((o) => o.wallId !== id),
      selectedWallId: get().selectedWallId === id ? null : get().selectedWallId,
    });
  },
  renameWall: (id, name) => set({ walls: get().walls.map((w) => (w.id === id ? { ...w, name } : w)) }),
  updateWall: (id, patch) => set({ walls: get().walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) }),
  selectWall: (id) => set({ selectedWallId: id, selectedOpeningId: null }),

  addOpening: (wallId, t) => {
    get().pushHistory();
    const { drawSettings, openingPlaceType } = get();
    const type = openingPlaceType ?? 'door';
    const opening: Opening = {
      id: nextId('open'),
      name: `${type === 'door' ? 'Tür' : 'Fenster'} ${get().openings.length + 1}`,
      type,
      wallId,
      t,
      width: type === 'door' ? drawSettings.doorWidth : drawSettings.windowWidth,
      height: type === 'door' ? drawSettings.doorHeight : drawSettings.windowHeight,
      sill: type === 'door' ? 0 : drawSettings.windowSill,
    };
    set({ openings: [...get().openings, opening] });
  },
  removeOpening: (id) => {
    get().pushHistory();
    set({
      openings: get().openings.filter((o) => o.id !== id),
      selectedOpeningId: get().selectedOpeningId === id ? null : get().selectedOpeningId,
    });
  },
  updateOpening: (id, patch) => set({ openings: get().openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
  selectOpening: (id) => set({ selectedOpeningId: id, selectedWallId: null }),
  setOpeningPlaceType: (t) => set({ openingPlaceType: t }),
  setDrawSettings: (patch) => set({ drawSettings: { ...get().drawSettings, ...patch } }),
  setTopDown: (v) => set({ topDown: v }),

  pushHistory: () => {
    const { measurements, walls, openings, history } = get();
    const snap: HistorySnapshot = {
      measurements: measurements.map((m) => ({ ...m, points: m.points.map((p) => [...p] as Vec3) })),
      walls: walls.map((w) => ({ ...w })),
      openings: openings.map((o) => ({ ...o })),
    };
    set({ history: [...history.slice(-49), snap] });
  },
  undo: () => {
    const { history } = get();
    if (history.length === 0) return;
    const last = history[history.length - 1];
    set({
      measurements: last.measurements,
      walls: last.walls,
      openings: last.openings,
      history: history.slice(0, -1),
      pendingPoints: [],
      pendingWallPoints: [],
    });
  },

  deleteSelection: () => {
    const { selectedMeasurementId, selectedWallId, selectedOpeningId } = get();
    if (selectedOpeningId) return get().removeOpening(selectedOpeningId);
    if (selectedWallId) return get().removeWall(selectedWallId);
    if (selectedMeasurementId) return get().removeMeasurement(selectedMeasurementId);
  },
}));
