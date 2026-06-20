import { useStore } from '../store';
import type { MeasureTool } from '../types';

const TOOLS: { id: MeasureTool; label: string }[] = [
  { id: 'distance', label: 'Strecke' },
  { id: 'polyline', label: 'Polylinie' },
  { id: 'polygon', label: 'Fläche' },
  { id: 'calibrate', label: 'Kalibrieren' },
];

export default function MeasurePanel({ onCalibrate }: { onCalibrate: () => void }) {
  const measureTool = useStore((s) => s.measureTool);
  const setMeasureTool = useStore((s) => s.setMeasureTool);
  const finishMeasurement = useStore((s) => s.finishMeasurement);
  const cancelPending = useStore((s) => s.cancelPending);
  const pending = useStore((s) => s.pendingPoints.length);
  const calibrated = useStore((s) => s.calibrated);

  return (
    <div>
      <h3>Werkzeug</h3>
      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={measureTool === t.id ? 'active' : ''}
              onClick={() => (t.id === 'calibrate' ? (setMeasureTool('calibrate'), onCalibrate()) : setMeasureTool(t.id))}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!calibrated && (
          <div className="card" style={{ marginTop: 10, borderColor: '#5a4a2a', background: 'rgba(255,182,72,0.08)' }}>
            <div className="badge warn">unkalibriert</div>
            <div className="small" style={{ marginTop: 6 }}>
              Maße werden als <b>Meter</b> angenommen. Ist dein Scan z. B. in cm oder mm, wirken die Werte 100× / 1000× zu
              groß. Kalibriere einmalig auf ein bekanntes Maß:
            </div>
            <button className="active" style={{ marginTop: 8 }} onClick={() => { setMeasureTool('calibrate'); onCalibrate(); }}>
              📏 Jetzt kalibrieren
            </button>
          </div>
        )}

        {(measureTool === 'polyline' || measureTool === 'polygon') && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="active" onClick={finishMeasurement} disabled={pending < (measureTool === 'polygon' ? 3 : 2)}>
              Abschließen (Enter)
            </button>
            <button onClick={cancelPending} disabled={pending === 0}>
              Abbrechen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
