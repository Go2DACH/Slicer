import { useState } from 'react';
import { useStore } from '../store';
import { buildFloorPlanDxf } from '../lib/dxf';
import { exportJson, exportGlb, downloadText, downloadBlob } from '../lib/exporters';

export default function ExportPanel() {
  const walls = useStore((s) => s.walls);
  const openings = useStore((s) => s.openings);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const calibrated = useStore((s) => s.calibrated);
  const fileName = useStore((s) => s.modelInfo?.fileName ?? 'modell');
  const [busy, setBusy] = useState(false);

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'grundriss';
  const hasBim = walls.length > 0;

  const exportDxf = () => {
    const dxf = buildFloorPlanDxf(walls, openings, scaleFactor, { includeDims: true });
    downloadText(dxf, `${baseName}.dxf`, 'application/dxf');
  };

  const exportJsonFile = () => {
    const json = exportJson(walls, openings, scaleFactor, unit, calibrated);
    downloadText(json, `${baseName}.json`, 'application/json');
  };

  const exportGlbFile = async () => {
    setBusy(true);
    try {
      const buffer = await exportGlb(walls, openings, scaleFactor);
      downloadBlob(new Blob([buffer], { type: 'model/gltf-binary' }), `${baseName}.glb`);
    } finally {
      setBusy(false);
    }
  };

  const screenshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${baseName}.png`);
    }, 'image/png');
  };

  return (
    <div>
      <h3>Export</h3>
      <div className="card">
        {!calibrated && (
          <div className="badge warn" style={{ marginBottom: 10 }}>
            Nicht kalibriert – Maße in angenommenen Metern.
          </div>
        )}
        <div className="field">
          <label>Grundriss (CAD)</label>
          <button className="active" onClick={exportDxf} disabled={!hasBim}>
            DXF exportieren
          </button>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>BIM-Daten</label>
          <div className="row">
            <button onClick={exportJsonFile} disabled={!hasBim}>
              JSON
            </button>
            <button onClick={exportGlbFile} disabled={!hasBim || busy}>
              {busy ? 'GLB …' : 'GLB'}
            </button>
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Ansicht</label>
          <button onClick={screenshot}>PNG-Screenshot</button>
        </div>
        {!hasBim && (
          <div className="muted small" style={{ marginTop: 10 }}>
            Zeichne zuerst Wände im Modus <b>Zeichnen</b>, um Grundriss-Exporte zu aktivieren.
          </div>
        )}
      </div>
    </div>
  );
}
