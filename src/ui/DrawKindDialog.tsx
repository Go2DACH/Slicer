import { useStore } from '../store';

/** Asks whether to draw a BIM model (rooms/walls) or a plain 2D sketch. */
export default function DrawKindDialog() {
  const setDrawKind = useStore((s) => s.setDrawKind);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="dialog-backdrop" onClick={() => setMode('view')}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Was möchtest du zeichnen?</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Wähle die Art der Zeichnung. Du kannst später jederzeit wechseln.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <button
            className="active"
            style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, height: 'auto', textAlign: 'left' }}
            onClick={() => setDrawKind('bim')}
          >
            <span style={{ fontSize: 18 }}>🏠 BIM-Modell</span>
            <span className="small" style={{ fontWeight: 400, lineHeight: 1.3 }}>
              Räume mit Wänden, Türen und Fenstern. Flächen (m²) werden automatisch berechnet.
            </span>
          </button>
          <button
            style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, height: 'auto', textAlign: 'left' }}
            onClick={() => setDrawKind('sketch2d')}
          >
            <span style={{ fontSize: 18 }}>✏️ 2D-Zeichnung</span>
            <span className="small" style={{ fontWeight: 400, lineHeight: 1.3 }}>
              Freie 2D-Skizze mit Linien und Kreisen. Export als DXF für CAD (DWG-kompatibel).
            </span>
          </button>
        </div>

        <div className="actions">
          <button onClick={() => setMode('view')}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
