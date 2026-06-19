import { useStore } from '../store';

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
        value={value}
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
  const topDown = useStore((s) => s.topDown);
  const setTopDown = useStore((s) => s.setTopDown);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const setOpeningPlaceType = useStore((s) => s.setOpeningPlaceType);
  const finishWallChain = useStore((s) => s.finishWallChain);
  const pendingWall = useStore((s) => s.pendingWallPoints.length);
  const unit = useStore((s) => s.unit);

  return (
    <div>
      <h3>Zeichnen</h3>
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={topDown} onChange={(e) => setTopDown(e.target.checked)} />
          Top-Down-Ansicht (orthografisch)
        </label>

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

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Wand-Parameter</h3>
        <div className="field-row">
          <NumberField label={`Dicke (${unit})`} value={d.wallThickness} onChange={(v) => set({ wallThickness: v })} />
          <NumberField label={`Höhe (${unit})`} value={d.wallHeight} onChange={(v) => set({ wallHeight: v })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={d.angleSnap} onChange={(e) => set({ angleSnap: e.target.checked })} />
            Winkel-Snap (45°/90°)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input type="checkbox" checked={d.endpointSnap} onChange={(e) => set({ endpointSnap: e.target.checked })} />
            Endpunkt-Snap
          </label>
        </div>
        {pendingWall > 0 && (
          <button style={{ marginTop: 10 }} onClick={finishWallChain}>
            Wandkette beenden (Enter)
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Öffnungen platzieren</h3>
        <div className="row">
          <button
            className={openingPlaceType === 'door' ? 'active' : ''}
            onClick={() => setOpeningPlaceType(openingPlaceType === 'door' ? null : 'door')}
          >
            Tür
          </button>
          <button
            className={openingPlaceType === 'window' ? 'active' : ''}
            onClick={() => setOpeningPlaceType(openingPlaceType === 'window' ? null : 'window')}
          >
            Fenster
          </button>
        </div>
        <div className="field-row" style={{ marginTop: 10 }}>
          <NumberField label={`Tür B (${unit})`} value={d.doorWidth} onChange={(v) => set({ doorWidth: v })} />
          <NumberField label={`Tür H (${unit})`} value={d.doorHeight} onChange={(v) => set({ doorHeight: v })} />
        </div>
        <div className="field-row" style={{ marginTop: 8 }}>
          <NumberField label={`Fenster B (${unit})`} value={d.windowWidth} onChange={(v) => set({ windowWidth: v })} />
          <NumberField label={`Fenster H (${unit})`} value={d.windowHeight} onChange={(v) => set({ windowHeight: v })} />
        </div>
        <div className="field-row" style={{ marginTop: 8 }}>
          <NumberField label={`Brüstung (${unit})`} value={d.windowSill} onChange={(v) => set({ windowSill: v })} />
        </div>
        {openingPlaceType && <div className="badge ok" style={{ marginTop: 8 }}>Auf eine Wand klicken …</div>}
      </div>
    </div>
  );
}
