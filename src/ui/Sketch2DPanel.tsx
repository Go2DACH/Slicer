import { useStore } from '../store';
import { buildSketchDxf } from '../lib/dxf';
import { downloadText, downloadBlob } from '../lib/exporters';
import { rawDistance } from '../lib/geometry';
import { formatLength } from '../lib/units';

export default function Sketch2DPanel() {
  const d = useStore((s) => s.drawSettings);
  const set = useStore((s) => s.setDrawSettings);
  const cameraView = useStore((s) => s.cameraView);
  const setCameraView = useStore((s) => s.setCameraView);
  const sketchTool = useStore((s) => s.sketchTool);
  const setSketchTool = useStore((s) => s.setSketchTool);
  const finishSketch = useStore((s) => s.finishSketch);
  const pending = useStore((s) => s.pendingSketch.length);
  const lines = useStore((s) => s.sketchLines);
  const circles = useStore((s) => s.sketchCircles);
  const selectedSketchId = useStore((s) => s.selectedSketchId);
  const selectSketch = useStore((s) => s.selectSketch);
  const removeSketch = useStore((s) => s.removeSketch);
  const clearSketch = useStore((s) => s.clearSketch);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.history.length > 0);
  const setDrawKind = useStore((s) => s.setDrawKind);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const fileName = useStore((s) => s.modelInfo?.fileName ?? 'zeichnung');

  const base = fileName.replace(/\.[^.]+$/, '') || 'zeichnung';
  const has = lines.length > 0 || circles.length > 0;

  const exportDxf = () => downloadText(buildSketchDxf(lines, circles, scaleFactor, unit), `${base}-2d.dxf`, 'application/dxf');
  const exportPng = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.toBlob((b) => b && downloadBlob(b, `${base}-2d.png`), 'image/png');
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>2D-Zeichnung</h3>
        <button className="icon-btn" onClick={() => setDrawKind(null)} title="Zeichnungsart wechseln">
          Wechseln
        </button>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="field">
          <label>Werkzeug</label>
          <div className="row">
            <button className={sketchTool === 'line' ? 'active' : ''} onClick={() => setSketchTool('line')}>
              ╱ Linie
            </button>
            <button className={sketchTool === 'circle' ? 'active' : ''} onClick={() => setSketchTool('circle')}>
              ◯ Kreis
            </button>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {sketchTool === 'line'
              ? 'Punkte tippen – fortlaufende Linien. „Fertig“ beendet die Kette.'
              : 'Mittelpunkt tippen, dann Radius-Punkt tippen.'}
          </div>
        </div>

        <div className="field" style={{ marginTop: 10 }}>
          <label>Ansicht</label>
          <div className="row">
            <button className={cameraView === 'top' ? 'active' : ''} onClick={() => setCameraView('top')}>
              Draufsicht
            </button>
            <button className={cameraView === 'free' ? 'active' : ''} onClick={() => setCameraView('free')}>
              3D
            </button>
          </div>
        </div>

        {pending > 0 && (
          <button style={{ marginTop: 10 }} onClick={finishSketch}>
            Linienkette beenden (Enter)
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Fangen / Raster</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={d.endpointSnap} onChange={(e) => set({ endpointSnap: e.target.checked })} />
          Punkt fangen (Endpunkte)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={d.angleSnap} onChange={(e) => set({ angleSnap: e.target.checked })} />
          Winkel-Raster (Linien)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={d.gridSnap} onChange={(e) => set({ gridSnap: e.target.checked })} />
          Längen-Raster ({Math.round(d.gridStepM * 100)} cm)
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

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Export (CAD)</h3>
        <div className="row">
          <button className="active" onClick={exportDxf} disabled={!has}>
            DXF (DWG-kompatibel)
          </button>
          <button onClick={exportPng} disabled={!has}>
            PNG
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          DXF öffnet in jedem CAD (AutoCAD, …) und lässt sich dort als .dwg speichern.
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={undo} disabled={!canUndo}>
          ↶ Zurück
        </button>
        <button className="danger" onClick={clearSketch} disabled={!has}>
          🗑 Alles löschen
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>
        Elemente ({lines.length} Linien, {circles.length} Kreise)
      </h3>
      {lines.map((l) => (
        <div key={l.id} className={`list-item${selectedSketchId === l.id ? ' selected' : ''}`} onClick={() => selectSketch(l.id)}>
          <div className="meta">
            <div className="name">╱ Linie</div>
            <div className="sub mono">{formatLength(rawDistance(l.a, l.b), scaleFactor, unit)}</div>
          </div>
          <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); removeSketch(l.id); }}>
            ✕
          </button>
        </div>
      ))}
      {circles.map((c) => (
        <div key={c.id} className={`list-item${selectedSketchId === c.id ? ' selected' : ''}`} onClick={() => selectSketch(c.id)}>
          <div className="meta">
            <div className="name">◯ Kreis</div>
            <div className="sub mono">r {formatLength(c.r, scaleFactor, unit)}</div>
          </div>
          <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); removeSketch(c.id); }}>
            ✕
          </button>
        </div>
      ))}
      {!has && <div className="muted small">Noch nichts gezeichnet.</div>}
    </div>
  );
}
