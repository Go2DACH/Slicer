import { create } from 'zustand';
import { unitPresetScale } from './lib/units';
import { sha256Hex, type ShareSetup } from './lib/share';
import type {
  AppMode,
  MeasureTool,
  Measurement,
  MeasurementType,
  AlignTool,
  Wall,
  Opening,
  Room,
  CameraView,
  DrawKind,
  SketchTool,
  SketchLine,
  SketchCircle,
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
  rooms: Room[];
  sketchLines: SketchLine[];
  sketchCircles: SketchCircle[];
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
  /** The locally loaded source file (for uploading + sharing). */
  sourceFile: File | null;

  // ---- Share access gate ----
  /** SHA-256 hex of the access PIN baked into a share link (null = none). */
  pinHash: string | null;
  /** Whether the PIN gate is currently blocking access. */
  locked: boolean;

  // ---- View settings ----
  showGrid: boolean;
  showAxes: boolean;
  readonly: boolean;
  resetViewToken: number;
  /** First-person walkthrough navigation. */
  walkMode: boolean;
  /** Side panel visibility (toggle to free the viewport on mobile). */
  panelOpen: boolean;
  /** X-ray: render the model 50% transparent to see hidden parts. */
  xray: boolean;
  /** Horizontal section: hide everything above clipPercent of the height. */
  clipEnabled: boolean;
  /** Section height as a percentage (10..100) of the model height. */
  clipPercent: number;

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
  rooms: Room[];
  /** Full point chain of the wall being drawn (closes into a room). */
  pendingWallPoints: Vec3[];
  selectedWallId: string | null;
  selectedOpeningId: string | null;
  selectedRoomId: string | null;
  drawSettings: DrawSettings;
  /** When placing an opening: which type to place next. */
  openingPlaceType: 'door' | 'window' | null;
  /** Reverse opening direction for the next placed opening. */
  openingFlip: boolean;
  /** Drawing tool: walls (polyline), rectangle room, or off (select/inspect). */
  drawTool: 'wall' | 'rect' | 'off';
  /** Which kind of drawing is active (null = ask the user). */
  drawKind: DrawKind | null;

  // ---- 2D sketch ----
  sketchLines: SketchLine[];
  sketchCircles: SketchCircle[];
  sketchTool: SketchTool;
  /** In-progress sketch points (line chain start or circle center). */
  pendingSketch: Vec3[];
  selectedSketchId: string | null;
  /** Camera view preset (free orbit / top / bottom). */
  cameraView: CameraView;

  // ---- History ----
  history: HistorySnapshot[];

  // ===== Actions =====
  setModel: (object: import('three').Object3D | null, info: ModelInfo | null, urls?: string[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadProgress: (p: number) => void;
  setLoadError: (e: LoadError | null) => void;
  setSourceFile: (f: File | null) => void;
  /** Apply a shared setup (calibration + alignment + access) from a link. */
  applyShareSetup: (setup: ShareSetup) => void;
  /** Try to unlock the PIN gate; returns true on the right code. */
  unlock: (pin: string) => Promise<boolean>;

  setShowGrid: (v: boolean) => void;
  setShowAxes: (v: boolean) => void;
  setReadonly: (v: boolean) => void;
  triggerResetView: () => void;
  setWalkMode: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setXray: (v: boolean) => void;
  setClipEnabled: (v: boolean) => void;
  setClipPercent: (p: number) => void;

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
  /** Quick-calibrate by declaring the model's raw unit and a display unit. */
  setUnitPreset: (modelUnit: string, displayUnit: string) => void;

  setAlignment: (q: [number, number, number, number], offset: Vec3) => void;
  transformAnnotations: (fn: (p: Vec3) => Vec3) => void;
  addAlignPoint: (p: Vec3) => void;
  clearAlignPoints: () => void;
  resetAlignment: () => void;

  // BIM
  addDrawPoint: (p: Vec3) => void;
  finishWallChain: () => void;
  clearBim: () => void;
  removeWall: (id: string) => void;
  renameWall: (id: string, name: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  selectWall: (id: string | null) => void;
  addOpening: (wallId: string, t: number) => void;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  selectOpening: (id: string | null) => void;
  removeRoom: (id: string) => void;
  renameRoom: (id: string, name: string) => void;
  selectRoom: (id: string | null) => void;
  setOpeningPlaceType: (t: 'door' | 'window' | null) => void;
  setOpeningFlip: (v: boolean) => void;
  setDrawTool: (t: 'wall' | 'rect' | 'off') => void;
  setDrawKind: (k: DrawKind | null) => void;
  setDrawSettings: (patch: Partial<DrawSettings>) => void;
  setCameraView: (v: CameraView) => void;

  // 2D sketch
  setSketchTool: (t: SketchTool) => void;
  addSketchPoint: (p: Vec3) => void;
  finishSketch: () => void;
  removeSketch: (id: string) => void;
  selectSketch: (id: string | null) => void;
  clearSketch: () => void;
  /** Move every sketch line endpoint that sits at `from` to `to` (vertex edit). */
  moveSketchVertex: (from: Vec3, to: Vec3) => void;
  updateSketchCircle: (id: string, patch: Partial<SketchCircle>) => void;

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
  surfaceSnap: false,
  gridSnap: true,
  gridStepM: 0.1,
  extrudeHeightMm: 1,
};

export const useStore = create<AppState>((set, get) => ({
  modelObject: null,
  modelInfo: null,
  loading: false,
  loadProgress: 0,
  loadError: null,
  objectUrls: [],
  sourceFile: null,

  pinHash: null,
  locked: false,

  showGrid: true,
  showAxes: true,
  readonly: false,
  resetViewToken: 0,
  walkMode: false,
  panelOpen: typeof window !== 'undefined' && window.innerWidth < 1024 ? false : true,
  xray: false,
  clipEnabled: false,
  clipPercent: 50,

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
  rooms: [],
  pendingWallPoints: [],
  selectedWallId: null,
  selectedOpeningId: null,
  selectedRoomId: null,
  drawSettings: defaultDrawSettings,
  openingPlaceType: null,
  openingFlip: false,
  drawTool: 'wall',
  drawKind: null,

  sketchLines: [],
  sketchCircles: [],
  sketchTool: 'line',
  pendingSketch: [],
  selectedSketchId: null,

  cameraView: 'free',

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
      rooms: [],
      pendingWallPoints: [],
      sketchLines: [],
      sketchCircles: [],
      pendingSketch: [],
      drawKind: null,
      alignQuaternion: [0, 0, 0, 1],
      alignOffset: [0, 0, 0],
      alignApplied: false,
      alignPoints: [],
      cameraView: 'free',
      history: [],
    });
  },
  setLoading: (loading) => set({ loading, loadProgress: loading ? 0 : get().loadProgress }),
  setLoadProgress: (p) => set({ loadProgress: p }),
  setLoadError: (e) => set({ loadError: e, loading: false }),
  setSourceFile: (f) => set({ sourceFile: f }),

  applyShareSetup: (s) => {
    // Applied after the model has loaded (setModel resets these), so the
    // recipient opens an already-calibrated and aligned scan.
    set({
      scaleFactor: s.sf || 1,
      unit: s.u || 'm',
      calibrated: !!s.cal,
      alignQuaternion: s.q ?? [0, 0, 0, 1],
      alignOffset: s.o ?? [0, 0, 0],
      alignApplied: !!s.q,
      readonly: !!s.ro,
      pinHash: s.p ?? null,
      locked: !!s.p,
    });
  },
  unlock: async (pin) => {
    const { pinHash } = get();
    if (!pinHash) {
      set({ locked: false });
      return true;
    }
    const ok = (await sha256Hex(pin)) === pinHash;
    if (ok) set({ locked: false });
    return ok;
  },

  setShowGrid: (v) => set({ showGrid: v }),
  setShowAxes: (v) => set({ showAxes: v }),
  setReadonly: (v) => set({ readonly: v }),
  triggerResetView: () => set({ resetViewToken: get().resetViewToken + 1 }),
  setWalkMode: (v) => set({ walkMode: v }),
  setPanelOpen: (v) => set({ panelOpen: v }),
  setXray: (v) => set({ xray: v }),
  setClipEnabled: (v) => set({ clipEnabled: v }),
  setClipPercent: (p) => set({ clipPercent: Math.max(10, Math.min(100, Math.round(p / 10) * 10)) }),

  setMode: (m) =>
    set({
      mode: m,
      pendingPoints: [],
      calibratePoints: [],
      alignPoints: [],
      pendingWallPoints: [],
      pendingSketch: [],
      openingPlaceType: null,
      // Re-entering draw mode asks again which kind (BIM or 2D).
      drawKind: m === 'draw' ? null : get().drawKind,
      // Entering draw mode defaults to the top view; leaving it returns to free.
      cameraView: m === 'draw' ? 'top' : get().cameraView === 'top' && get().mode === 'draw' ? 'free' : get().cameraView,
      // Walkthrough only makes sense in view/measure modes.
      walkMode: m === 'view' || m === 'measure' ? get().walkMode : false,
      // Auto-open the tools panel when entering a tool mode (so the dashboard is
      // visible on mobile/foldables where it is a collapsed drawer).
      panelOpen: m === 'view' ? get().panelOpen : true,
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
  setUnitPreset: (modelUnit, displayUnit) =>
    set({ scaleFactor: unitPresetScale(modelUnit, displayUnit), unit: displayUnit, calibrated: true, calibratePoints: [] }),

  setAlignment: (q, offset) => {
    // Mark as aligned whenever an alignment is applied (even a near-identity one,
    // e.g. a floor that was already level) so the UI can give feedback.
    set({ alignQuaternion: q, alignOffset: offset, alignApplied: true, alignPoints: [] });
  },
  transformAnnotations: (fn) => {
    set({
      measurements: get().measurements.map((m) => ({ ...m, points: m.points.map(fn) })),
      walls: get().walls.map((w) => ({ ...w, start: fn(w.start), end: fn(w.end) })),
      rooms: get().rooms.map((r) => ({ ...r, points: r.points.map(fn) })),
      sketchLines: get().sketchLines.map((l) => ({ ...l, a: fn(l.a), b: fn(l.b) })),
      sketchCircles: get().sketchCircles.map((c) => ({ ...c, center: fn(c.center) })),
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

  addDrawPoint: (p) => {
    const chain = get().pendingWallPoints;
    const ds = get().drawSettings;
    let wallCounter = get().walls.length;
    const makeWall = (start: Vec3, end: Vec3): Wall => ({
      id: nextId('wall'),
      name: `Wand ${++wallCounter}`,
      start,
      end,
      thickness: ds.wallThickness,
      height: ds.wallHeight,
    });

    // Rectangle tool: first tap = one corner, second tap = opposite corner.
    if (get().drawTool === 'rect') {
      if (chain.length === 0) {
        set({ pendingWallPoints: [p] });
        return;
      }
      const a = chain[0];
      if (Math.hypot(a[0] - p[0], a[2] - p[2]) < 1e-6) return;
      const b: Vec3 = [p[0], 0, a[2]];
      const c: Vec3 = [p[0], 0, p[2]];
      const d: Vec3 = [a[0], 0, p[2]];
      get().pushHistory();
      const room: Room = {
        id: nextId('room'),
        name: `Raum ${get().rooms.length + 1}`,
        points: [a, b, c, d],
      };
      set({
        walls: [...get().walls, makeWall(a, b), makeWall(b, c), makeWall(c, d), makeWall(d, a)],
        rooms: [...get().rooms, room],
        pendingWallPoints: [],
      });
      return;
    }

    if (chain.length === 0) {
      set({ pendingWallPoints: [p] });
      return;
    }
    const last = chain[chain.length - 1];
    if (Math.hypot(last[0] - p[0], last[2] - p[2]) < 1e-7) return; // ignore duplicate click
    const first = chain[0];
    const closes = chain.length >= 3 && Math.hypot(first[0] - p[0], first[2] - p[2]) < 1e-5;
    get().pushHistory();
    if (closes) {
      const room: Room = {
        id: nextId('room'),
        name: `Raum ${get().rooms.length + 1}`,
        points: chain.map((c) => [...c] as Vec3),
      };
      set({
        walls: [...get().walls, makeWall(last, first)],
        rooms: [...get().rooms, room],
        pendingWallPoints: [],
      });
    } else {
      set({ walls: [...get().walls, makeWall(last, p)], pendingWallPoints: [...chain, p] });
    }
  },
  finishWallChain: () => set({ pendingWallPoints: [] }),
  clearBim: () => {
    get().pushHistory();
    set({
      walls: [],
      openings: [],
      rooms: [],
      pendingWallPoints: [],
      selectedWallId: null,
      selectedOpeningId: null,
      selectedRoomId: null,
    });
  },
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
  selectWall: (id) => set({ selectedWallId: id, selectedOpeningId: null, selectedRoomId: null }),

  addOpening: (wallId, t) => {
    get().pushHistory();
    const { drawSettings, openingPlaceType, openingFlip, walls, rooms } = get();
    const type = openingPlaceType ?? 'door';
    const wall = walls.find((w) => w.id === wallId);

    // Default swing toward the room interior if the wall belongs to a room.
    let base = false;
    if (wall) {
      const ux = wall.end[0] - wall.start[0];
      const uz = wall.end[2] - wall.start[2];
      const len = Math.hypot(ux, uz) || 1;
      const nx = -uz / len; // +n side normal (XZ)
      const nz = ux / len;
      const midx = wall.start[0] + ux * t;
      const midz = wall.start[2] + uz * t;
      const room = rooms.find(
        (r) =>
          r.points.some((pt) => Math.hypot(pt[0] - wall.start[0], pt[2] - wall.start[2]) < 1e-4) &&
          r.points.some((pt) => Math.hypot(pt[0] - wall.end[0], pt[2] - wall.end[2]) < 1e-4),
      );
      if (room) {
        let cx = 0;
        let cz = 0;
        room.points.forEach((pt) => {
          cx += pt[0];
          cz += pt[2];
        });
        cx /= room.points.length;
        cz /= room.points.length;
        // if the centroid lies on the -n side, flip so the swing faces the room
        base = (cx - midx) * nx + (cz - midz) * nz < 0;
      }
    }
    const flip = openingFlip ? !base : base;

    const opening: Opening = {
      id: nextId('open'),
      name: `${type === 'door' ? 'Tür' : 'Fenster'} ${get().openings.length + 1}`,
      type,
      wallId,
      t,
      width: type === 'door' ? drawSettings.doorWidth : drawSettings.windowWidth,
      height: type === 'door' ? drawSettings.doorHeight : drawSettings.windowHeight,
      sill: type === 'door' ? 0 : drawSettings.windowSill,
      flip,
      hingeRight: false,
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
  selectOpening: (id) => set({ selectedOpeningId: id, selectedWallId: null, selectedRoomId: null }),
  removeRoom: (id) => {
    get().pushHistory();
    set({
      rooms: get().rooms.filter((r) => r.id !== id),
      selectedRoomId: get().selectedRoomId === id ? null : get().selectedRoomId,
    });
  },
  renameRoom: (id, name) => set({ rooms: get().rooms.map((r) => (r.id === id ? { ...r, name } : r)) }),
  selectRoom: (id) => set({ selectedRoomId: id, selectedWallId: null, selectedOpeningId: null }),
  setOpeningPlaceType: (t) => set({ openingPlaceType: t }),
  setOpeningFlip: (v) => set({ openingFlip: v }),
  setDrawTool: (t) => set({ drawTool: t, pendingWallPoints: [] }),
  setDrawKind: (k) =>
    set({ drawKind: k, pendingWallPoints: [], pendingSketch: [], openingPlaceType: null, panelOpen: k ? true : get().panelOpen }),
  setDrawSettings: (patch) => set({ drawSettings: { ...get().drawSettings, ...patch } }),
  setCameraView: (v) => set({ cameraView: v }),

  // ---- 2D sketch ----
  setSketchTool: (t) => set({ sketchTool: t, pendingSketch: [] }),
  addSketchPoint: (p) => {
    const { sketchTool, pendingSketch } = get();
    if (sketchTool === 'area') {
      // Closed-face chain: keep the full point list so it can close onto the
      // first point. Each segment is a normal SketchLine (so it stays editable),
      // and the enclosed loop is recognised as a face for fill + STL export.
      const chain = pendingSketch;
      const mkLine = (a: Vec3, b: Vec3): SketchLine => ({ id: nextId('ln'), a, b });
      if (chain.length === 0) {
        set({ pendingSketch: [p] });
        return;
      }
      const last = chain[chain.length - 1];
      if (Math.hypot(last[0] - p[0], last[2] - p[2]) < 1e-7) return;
      const first = chain[0];
      const closes = chain.length >= 3 && Math.hypot(first[0] - p[0], first[2] - p[2]) < 1e-5;
      get().pushHistory();
      if (closes) {
        set({ sketchLines: [...get().sketchLines, mkLine(last, first)], pendingSketch: [] });
      } else {
        set({ sketchLines: [...get().sketchLines, mkLine(last, p)], pendingSketch: [...chain, p] });
      }
      return;
    }
    if (sketchTool === 'line') {
      if (pendingSketch.length === 0) {
        set({ pendingSketch: [p] });
        return;
      }
      const a = pendingSketch[pendingSketch.length - 1];
      if (Math.hypot(a[0] - p[0], a[2] - p[2]) < 1e-7) return;
      get().pushHistory();
      const line: SketchLine = { id: nextId('ln'), a, b: p };
      // continue the chain from the new point (polyline of separate lines)
      set({ sketchLines: [...get().sketchLines, line], pendingSketch: [p] });
    } else {
      if (pendingSketch.length === 0) {
        set({ pendingSketch: [p] });
        return;
      }
      const c = pendingSketch[0];
      const r = Math.hypot(p[0] - c[0], p[2] - c[2]);
      if (r < 1e-7) return;
      get().pushHistory();
      const circle: SketchCircle = { id: nextId('ci'), center: c, r };
      set({ sketchCircles: [...get().sketchCircles, circle], pendingSketch: [] });
    }
  },
  finishSketch: () => set({ pendingSketch: [] }),
  removeSketch: (id) => {
    get().pushHistory();
    set({
      sketchLines: get().sketchLines.filter((l) => l.id !== id),
      sketchCircles: get().sketchCircles.filter((c) => c.id !== id),
      selectedSketchId: get().selectedSketchId === id ? null : get().selectedSketchId,
    });
  },
  selectSketch: (id) => set({ selectedSketchId: id }),
  clearSketch: () => {
    get().pushHistory();
    set({ sketchLines: [], sketchCircles: [], pendingSketch: [], selectedSketchId: null });
  },
  moveSketchVertex: (from, to) => {
    const eps = 1e-5;
    const near = (p: Vec3) => Math.hypot(p[0] - from[0], p[2] - from[2]) < eps;
    const moved: Vec3 = [to[0], 0, to[2]];
    get().pushHistory();
    set({
      sketchLines: get().sketchLines.map((l) => ({
        ...l,
        a: near(l.a) ? moved : l.a,
        b: near(l.b) ? moved : l.b,
      })),
    });
  },
  updateSketchCircle: (id, patch) => {
    get().pushHistory();
    set({ sketchCircles: get().sketchCircles.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  },

  pushHistory: () => {
    const { measurements, walls, openings, rooms, sketchLines, sketchCircles, history } = get();
    const snap: HistorySnapshot = {
      measurements: measurements.map((m) => ({ ...m, points: m.points.map((p) => [...p] as Vec3) })),
      walls: walls.map((w) => ({ ...w })),
      openings: openings.map((o) => ({ ...o })),
      rooms: rooms.map((r) => ({ ...r, points: r.points.map((p) => [...p] as Vec3) })),
      sketchLines: sketchLines.map((l) => ({ ...l })),
      sketchCircles: sketchCircles.map((c) => ({ ...c })),
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
      rooms: last.rooms,
      sketchLines: last.sketchLines,
      sketchCircles: last.sketchCircles,
      history: history.slice(0, -1),
      pendingPoints: [],
      pendingWallPoints: [],
      pendingSketch: [],
    });
  },

  deleteSelection: () => {
    const { selectedMeasurementId, selectedWallId, selectedOpeningId, selectedRoomId, selectedSketchId } = get();
    if (selectedSketchId) return get().removeSketch(selectedSketchId);
    if (selectedOpeningId) return get().removeOpening(selectedOpeningId);
    if (selectedRoomId) return get().removeRoom(selectedRoomId);
    if (selectedWallId) return get().removeWall(selectedWallId);
    if (selectedMeasurementId) return get().removeMeasurement(selectedMeasurementId);
  },
}));
