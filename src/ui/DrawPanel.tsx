import { useStore } from '../store';
import { METERS_PER_UNIT } from '../lib/units';

function NumberField({
  label,
  value,
  onChange,
  step = 0.05,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? +value.toFixed(4) : 0}
        step={step}
        min={min}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

export default function DrawPanel() {
  const d = useStore((s) => s.drawSettings);
  const set = useStore((s) => s.setDrawSettings);
  const cameraView = useStore((s) => s.cameraView);
  const setCameraView = useStore((s) => s.setCameraView);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const setOpeningPlaceType = useStore((s) => s.setOpeningPlaceType);
  const openingFlip = useStore((s) => s.openingFlip);
  const setOpeningFlip = useStore((s) => s.setOpeningFlip);
  const finishWallChain = useStore((s) => s.finishWallChain);
  const pendingWall = useStore((s) => s.pendingWallPoints.length);
  const unit = useStore((s) => s.unit);
  const undo = useStore((s) => s.undo);
  const clearBim = useStore((s) => s.clearBim);
  const wallCount = useStore((s) => s.walls.length);
  const openingCount = useStore((s) => s.openings.length);
  const canUndo = useStore((s) => s.history.length > 0);

  // Convert a centimeter value into the current display unit.
  const cm = (v: number) => v / 100 / (METERS_PER_UNIT[unit] ?? 1);
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-4;

  const wallPresets: { label: string; cm: number }[] = [
    { label: 'Dünn', cm: 10 },
    { label: 'Standard', cm: 20 },
    { label: 'Dick', cm: 36 },
  ];
  const doorPresets = [80, 100, 120];
  const windowPresets = [40, 80, 120];

  return (
    <div>
      <h3>Zeichnen</h3>
      <div className="card">
        <div className="field">
          <label>Ansicht</label>
          <div className="row">
            <button className={cameraView === 'top' ? 'active' : ''} onClick={() => setCameraView('top')}>
              Draufsicht
            </button>
            <button className={cameraView === 'bottom' ? 'active' : ''} onClick={() => setCameraView('bottom')}>
              Untersicht
            </button>
            <button className={cameraView === 'free' ? 'active' : ''} onClick={() => setCameraView('free')}>
              3D
            </button>
          </div>
        </div>

        <div className="section-controls" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={d.sectionEnabled} onChange={(e) => set({ sectionEnabled: e.target.checked })} />
            Horizontaler Schnitt
          </label>
          {d.sectionEnabled && (
            <div className="field">
              <label>
                Schnitthöhe: {d.sectionHeight.toFixed(2)} {unit}
              </label>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={d.sectionHeight}
                onChange={(e) => set({ sectionHeight: parseFloat(e.target.value) })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Snapping */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Fangen / Raster</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={d.endpointSnap} onChange={(e) => set({ endpointSnap: e.target.checked })} />
          Punkt fangen (Endpunkte, Raum schließen)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={d.surfaceSnap} onChange={(e) => set({ surfaceSnap: e.target.checked })} />
          Fläche fangen (auf Scan-Oberfläche zeichnen)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={d.angleSnap} onChange={(e) => set({ angleSnap: e.target.checked })} />
          Winkel-Raster (30/45/70/90/120/180°)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={d.gridSnap} onChange={(e) => set({ gridSnap: e.target.checked })} />
          Längen-Raster ({Math.round(d.gridStepM * 100)} cm Schritte)
        </label>
        {d.gridSnap && (
          <div className="row" style={{ marginTop: 6, gap: 4 }}>
            {[5, 10, 25, 50].map((cmStep) => (
              <button
                key={cmStep}
                className={Math.abs(d.gridStepM - cmStep / 100) < 1e-6 ? 'active' : ''}
                onClick={() => set({ gridStepM: cmStep / 100 })}
              >
                {cmStep} cm
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Walls */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Wand</h3>
        <div className="field">
          <label>Stärke</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {wallPresets.map((p) => (
              <button
                key={p.label}
                className={close(d.wallThickness, cm(p.cm)) ? 'active' : ''}
                onClick={() => set({ wallThickness: cm(p.cm) })}
              >
                {p.label} ({p.cm} cm)
              </button>
            ))}
          </div>
        </div>
        <div className="field-row" style={{ marginTop: 8 }}>
          <NumberField label={`Stärke (${unit})`} value={d.wallThickness} onChange={(v) => set({ wallThickness: v })} />
          <NumberField label={`Höhe (${unit})`} value={d.wallHeight} onChange={(v) => set({ wallHeight: v })} />
        </div>
        {pendingWall > 0 && (
          <button style={{ marginTop: 10 }} onClick={finishWallChain}>
            Wandkette beenden (Enter)
          </button>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={undo} disabled={!canUndo} title="Letzte Aktion rückgängig (Ctrl+Z)">
            ↶ Zurück
          </button>
          <button
            className="danger"
            onClick={clearBim}
            disabled={wallCount === 0 && openingCount === 0}
            title="Alle Wände, Öffnungen und Räume löschen"
          >
            🗑 Löschen
          </button>
        </div>
      </div>

      {/* Openings */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Türen &amp; Fenster (nur auf Wänden)</h3>
        <div className="row">
          <button
            className={openingPlaceType === 'door' ? 'active' : ''}
            onClick={() => setOpeningPlaceType(openingPlaceType === 'door' ? null : 'door')}
          >
            🚪 Tür setzen
          </button>
          <button
            className={openingPlaceType === 'window' ? 'active' : ''}
            onClick={() => setOpeningPlaceType(openingPlaceType === 'window' ? null : 'window')}
          >
            🪟 Fenster setzen
          </button>
        </div>

        <div className="field" style={{ marginTop: 10 }}>
          <label>Türbreite</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {doorPresets.map((p) => (
              <button key={p} className={close(d.doorWidth, cm(p)) ? 'active' : ''} onClick={() => set({ doorWidth: cm(p) })}>
                {p}
              </button>
            ))}
            <span className="small muted">cm</span>
          </div>
        </div>
        <div className="field-row" style={{ marginTop: 6 }}>
          <NumberField label={`Tür B (${unit})`} value={d.doorWidth} onChange={(v) => set({ doorWidth: v })} />
          <NumberField label={`Tür H (${unit})`} value={d.doorHeight} onChange={(v) => set({ doorHeight: v })} />
        </div>

        <div className="field" style={{ marginTop: 10 }}>
          <label>Fensterbreite</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {windowPresets.map((p) => (
              <button
                key={p}
                className={close(d.windowWidth, cm(p)) ? 'active' : ''}
                onClick={() => set({ windowWidth: cm(p) })}
              >
                {p}
              </button>
            ))}
            <span className="small muted">cm</span>
          </div>
        </div>
        <div className="field-row" style={{ marginTop: 6 }}>
          <NumberField label={`Fenster B (${unit})`} value={d.windowWidth} onChange={(v) => set({ windowWidth: v })} />
          <NumberField label={`Fenster H (${unit})`} value={d.windowHeight} onChange={(v) => set({ windowHeight: v })} />
        </div>
        <div className="field-row" style={{ marginTop: 6 }}>
          <NumberField label={`Brüstung (${unit})`} value={d.windowSill} onChange={(v) => set({ windowSill: v })} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={openingFlip} onChange={(e) => setOpeningFlip(e.target.checked)} />
          Öffnungsrichtung umkehren (Standard: nach innen)
        </label>
        {openingPlaceType && <div className="badge ok" style={{ marginTop: 8 }}>Auf eine Wand klicken …</div>}
      </div>
    </div>
  );
}
