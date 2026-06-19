import { useStore } from '../store';
import { rawDistance, rawPolylineLength, rawPolygonArea } from '../lib/geometry';
import { formatLength, formatArea } from '../lib/units';
import type { Measurement } from '../types';

function value(m: Measurement, scaleFactor: number, unit: string): string {
  if (m.type === 'distance') return formatLength(rawDistance(m.points[0], m.points[1]), scaleFactor, unit);
  if (m.type === 'polyline') return formatLength(rawPolylineLength(m.points), scaleFactor, unit);
  return formatArea(rawPolygonArea(m.points), scaleFactor, unit);
}

export default function MeasurementList() {
  const measurements = useStore((s) => s.measurements);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const selected = useStore((s) => s.selectedMeasurementId);
  const select = useStore((s) => s.selectMeasurement);
  const remove = useStore((s) => s.removeMeasurement);
  const rename = useStore((s) => s.renameMeasurement);
  const clearAll = useStore((s) => s.clearMeasurements);
  const undo = useStore((s) => s.undo);
  const readonly = useStore((s) => s.readonly);

  return (
    <div>
      <h3>Messungen ({measurements.length})</h3>
      {measurements.length === 0 ? (
        <div className="muted small">Noch keine Messungen.</div>
      ) : (
        <div>
          {measurements.map((m) => (
            <div key={m.id} className={`list-item${selected === m.id ? ' selected' : ''}`} onClick={() => select(m.id)}>
              <div className="meta">
                <input
                  className="name"
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                  value={m.name}
                  onChange={(e) => rename(m.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="sub mono">{value(m, scaleFactor, unit)}</div>
              </div>
              <button
                className="icon-btn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(m.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {measurements.length > 0 && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="icon-btn" onClick={undo} disabled={readonly}>
            ↶ Undo
          </button>
          <button className="icon-btn danger" onClick={clearAll} disabled={readonly}>
            Alle löschen
          </button>
        </div>
      )}
    </div>
  );
}
