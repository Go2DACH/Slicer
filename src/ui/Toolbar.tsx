import { useRef } from 'react';
import { useStore } from '../store';
import type { AppMode } from '../types';

const MODES: { id: AppMode; label: string; editing: boolean }[] = [
  { id: 'view', label: 'Ansehen', editing: false },
  { id: 'measure', label: 'Messen', editing: false },
  { id: 'align', label: 'Ausrichten', editing: true },
  { id: 'draw', label: 'Zeichnen', editing: true },
  { id: 'export', label: 'Export', editing: true },
];

interface Props {
  onShare: () => void;
  onCalibrate: () => void;
}

export default function Toolbar({ onShare }: Props) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const showGrid = useStore((s) => s.showGrid);
  const showAxes = useStore((s) => s.showAxes);
  const setShowGrid = useStore((s) => s.setShowGrid);
  const setShowAxes = useStore((s) => s.setShowAxes);
  const triggerResetView = useStore((s) => s.triggerResetView);
  const readonly = useStore((s) => s.readonly);
  const calibrated = useStore((s) => s.calibrated);
  const modelObject = useStore((s) => s.modelObject);

  const fileInput = useRef<HTMLInputElement>(null);

  const visibleModes = readonly ? MODES.filter((m) => !m.editing) : MODES;

  return (
    <div className="toolbar">
      <div className="brand">
        🏠 3D-Scan <small>Viewer &amp; Vermessung</small>
      </div>

      <div className="group">
        {visibleModes.map((m) => (
          <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)} disabled={!modelObject}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="divider" />

      <div className="group">
        <button className={showGrid ? 'active' : ''} onClick={() => setShowGrid(!showGrid)} title="Raster ein/aus">
          Raster
        </button>
        <button className={showAxes ? 'active' : ''} onClick={() => setShowAxes(!showAxes)} title="Achsen ein/aus">
          Achsen
        </button>
        <button onClick={triggerResetView} disabled={!modelObject} title="Ansicht zurücksetzen">
          Reset
        </button>
      </div>

      <div className="spacer" />

      {!calibrated && modelObject && <span className="badge warn">unkalibriert</span>}
      {calibrated && <span className="badge ok">kalibriert</span>}
      {readonly && <span className="badge ok">Read-only</span>}

      <div className="divider" />

      <div className="group">
        <button
          className="ghost"
          onClick={() => fileInput.current?.click()}
          title="STL, OBJ(+MTL+Texturen), GLB/GLTF, PLY, Punktwolken (PLY/PCD/XYZ)"
        >
          Datei öffnen
        </button>
        {!readonly && (
          <button className="ghost" onClick={onShare} disabled={!modelObject}>
            Teilen
          </button>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".stl,.obj,.mtl,.ply,.glb,.gltf,.pcd,.xyz,.png,.jpg,.jpeg,.bmp,.bin"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) {
            const evt = new CustomEvent('slicer:loadfiles', { detail: files });
            window.dispatchEvent(evt);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
