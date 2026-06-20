import { useState } from 'react';
import { useStore } from '../store';
import { rawDistance } from '../lib/geometry';

export default function CalibrateDialog({ onClose }: { onClose: () => void }) {
  const calibratePoints = useStore((s) => s.calibratePoints);
  const applyCalibration = useStore((s) => s.applyCalibration);
  const resetCalibration = useStore((s) => s.resetCalibration);
  const setMode = useStore((s) => s.setMode);
  const setMeasureTool = useStore((s) => s.setMeasureTool);
  const unit = useStore((s) => s.unit);
  const setUnit = useStore((s) => s.setUnit);
  const calibrated = useStore((s) => s.calibrated);
  const scaleFactor = useStore((s) => s.scaleFactor);

  const setUnitPreset = useStore((s) => s.setUnitPreset);
  const [real, setReal] = useState('1.0');
  const [modelUnit, setModelUnit] = useState('mm');
  const [displayUnit, setDisplayUnit] = useState('mm');

  const raw = calibratePoints.length === 2 ? rawDistance(calibratePoints[0], calibratePoints[1]) : 0;

  const startPicking = () => {
    setMode('measure');
    setMeasureTool('calibrate');
    onClose();
  };

  const apply = () => {
    const value = parseFloat(real.replace(',', '.'));
    if (value > 0 && raw > 0) {
      applyCalibration(value);
      onClose();
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Maßstab kalibrieren</h2>

        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Schnell: Modelleinheit wählen</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            Wenn du weißt, in welcher Einheit das Modell vorliegt. <b>STL-Dateien sind fast immer in Millimeter</b>{' '}
            (3D-Druck-Standard) — ein 3DBenchy ist z. B. 60&nbsp;mm, nicht 60&nbsp;m.
          </p>
          <div className="field-row">
            <div className="field">
              <label>Modell ist in</label>
              <select value={modelUnit} onChange={(e) => setModelUnit(e.target.value)}>
                <option value="mm">Millimeter (mm)</option>
                <option value="cm">Zentimeter (cm)</option>
                <option value="m">Meter (m)</option>
                <option value="in">Zoll (in)</option>
              </select>
            </div>
            <div className="field">
              <label>Anzeige in</label>
              <select value={displayUnit} onChange={(e) => setDisplayUnit(e.target.value)}>
                <option value="mm">Millimeter (mm)</option>
                <option value="cm">Zentimeter (cm)</option>
                <option value="m">Meter (m)</option>
              </select>
            </div>
          </div>
          <button
            className="active"
            style={{ marginTop: 10 }}
            onClick={() => {
              setUnitPreset(modelUnit, displayUnit);
              onClose();
            }}
          >
            Einheit übernehmen
          </button>
        </div>

        <p className="small muted">
          Oder per Referenzmaß: Klicke zwei Punkte mit bekanntem realem Abstand (z. B. eine Türbreite oder ein Maßband im
          Scan) und gib den echten Wert ein.
        </p>

        {calibrated && (
          <div className="card" style={{ marginBottom: 12 }}>
            <span className="badge ok">kalibriert</span> Faktor: <span className="mono">{scaleFactor.toPrecision(6)}</span>{' '}
            <span className="muted small">(1 Modelleinheit = {scaleFactor.toPrecision(4)} {unit})</span>
          </div>
        )}

        {raw > 0 ? (
          <>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Gemessener Roh-Abstand</label>
              <div className="mono">{raw.toPrecision(6)} Einheiten</div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Echter Abstand</label>
                <input value={real} onChange={(e) => setReal(e.target.value)} inputMode="decimal" autoFocus />
              </div>
              <div className="field">
                <label>Einheit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="m">Meter (m)</option>
                  <option value="cm">Zentimeter (cm)</option>
                  <option value="mm">Millimeter (mm)</option>
                  <option value="ft">Fuß (ft)</option>
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="card">
            Noch keine zwei Referenzpunkte gesetzt.
            <div style={{ marginTop: 10 }}>
              <button className="active" onClick={startPicking}>
                Referenzpunkte setzen
              </button>
            </div>
          </div>
        )}

        <div className="actions">
          {calibrated && (
            <button className="danger" onClick={() => { resetCalibration(); onClose(); }}>
              Kalibrierung zurücksetzen
            </button>
          )}
          <button onClick={onClose}>Abbrechen</button>
          <button className="active" onClick={apply} disabled={raw <= 0}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
