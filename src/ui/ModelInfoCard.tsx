import { useStore } from '../store';
import { formatLength } from '../lib/units';

export default function ModelInfoCard() {
  const info = useStore((s) => s.modelInfo);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const calibrated = useStore((s) => s.calibrated);
  if (!info) return null;

  const fmt = (raw: number) => (calibrated ? formatLength(raw, scaleFactor, unit) : `${raw.toFixed(3)} E`);

  return (
    <div>
      <h3>Modell</h3>
      <div className="card small">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Datei</span>
          <span className="mono" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info.fileName}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <span className="muted">{info.pointCount > 0 ? 'Punkte' : 'Dreiecke'}</span>
          <span className="mono">
            {(info.pointCount > 0 ? info.pointCount : info.triangleCount).toLocaleString('de-DE')}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <span className="muted">Größe (B×H×T)</span>
          <span className="mono">
            {fmt(info.size[0])} × {fmt(info.size[1])} × {fmt(info.size[2])}
          </span>
        </div>
        {!calibrated && <div className="muted small" style={{ marginTop: 6 }}>E = unkalibrierte Modelleinheiten</div>}
      </div>
    </div>
  );
}
