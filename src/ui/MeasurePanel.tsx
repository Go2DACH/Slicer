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
          <div className="badge warn" style={{ marginTop: 10 }}>
            Unkalibriert – Maße als Meter angenommen. Bitte kalibrieren.
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
