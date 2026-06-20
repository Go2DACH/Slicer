import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildSketchDxf } from '../lib/dxf';
import { buildExtrudedStl, mmPerRawUnit } from '../lib/stl';
import { detectSketchFaces } from '../lib/sketchFaces';
import { downloadText, downloadBlob } from '../lib/exporters';
import { rawDistance } from '../lib/geometry';
import { formatLength } from '../lib/units';
import type { SketchLine, SketchCircle, Vec3 } from '../types';

/** Edit length + angle of a selected line, or radius of a selected circle. */
function SelectedEditor({
  line,
  circle,
}: {
  line?: SketchLine;
  circle?: SketchCircle;
}) {
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const moveSketchVertex = useStore((s) => s.moveSketchVertex);
  const updateSketchCircle = useStore((s) => s.updateSketchCircle);

  // Current geometry → display values.
  const cur = useMemo(() => {
    if (line) {
      const rawLen = rawDistance(line.a, line.b);
      const ang = (Math.atan2(-(line.b[2] - line.a[2]), line.b[0] - line.a[0]) * 180) / Math.PI;
      return { length: (rawLen * scaleFactor).toFixed(3), angle: ang.toFixed(1), radius: '' };
    }
    if (circle) return { length: '', angle: '', radius: (circle.r * scaleFactor).toFixed(3) };
    return { length: '', angle: '', radius: '' };
  }, [line, circle, scaleFactor]);

  const [length, setLength] = useState(cur.length);
  const [angle, setAngle] = useState(cur.angle);
  const [radius, setRadius] = useState(cur.radius);
  // Re-seed when the selection (or its geometry) changes.
  useEffect(() => {
    setLength(cur.length);
    setAngle(cur.angle);
    setRadius(cur.radius);
  }, [cur.length, cur.angle, cur.radius]);

  const commitLine = () => {
    if (!line) return;
    const realLen = parseFloat(length.replace(',', '.'));
    const angDeg = parseFloat(angle.replace(',', '.'));
    if (!isFinite(realLen) || realLen <= 0 || !isFinite(angDeg) || scaleFactor <= 0) return;
    const rawLen = realLen / scaleFactor;
    const rad = (angDeg * Math.PI) / 180;
    const newB: Vec3 = [line.a[0] + rawLen * Math.cos(rad), 0, line.a[2] - rawLen * Math.sin(rad)];
    moveSketchVertex(line.b, newB);
  };

  const commitRadius = () => {
    if (!circle) return;
    const realR = parseFloat(radius.replace(',', '.'));
    if (!isFinite(realR) || realR <= 0 || scaleFactor <= 0) return;
    updateSketchCircle(circle.id, { r: realR / scaleFactor });
  };

  if (line) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Linie bearbeiten</h3>
        <div className="field-row">
          <div className="field">
            <label>Länge ({unit})</label>
            <input
              value={length}
              onChange={(e) => setLength(e.target.value)}
              onBlur={commitLine}
              onKeyDown={(e) => e.key === 'Enter' && commitLine()}
              inputMode="decimal"
            />
          </div>
          <div className="field">
            <label>Winkel (°)</label>
            <input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              onBlur={commitLine}
              onKeyDown={(e) => e.key === 'Enter' && commitLine()}
              inputMode="decimal"
            />
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          Verbundene Ecken wandern mit, geschlossene Flächen bleiben erhalten.
        </div>
      </div>
    );
  }
  if (circle) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Kreis bearbeiten</h3>
        <div className="field">
          <label>Radius ({unit})</label>
          <input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            onBlur={commitRadius}
            onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
            inputMode="decimal"
          />
        </div>
      </div>
    );
  }
  return null;
}

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
  const faces = useMemo(() => detectSketchFaces(lines), [lines]);
  const canExtrude = faces.length > 0 || circles.length > 0;
  const mmFactor = mmPerRawUnit(scaleFactor, unit);

  const selectedLine = lines.find((l) => l.id === selectedSketchId);
  const selectedCircle = circles.find((c) => c.id === selectedSketchId);

  const exportDxf = () => downloadText(buildSketchDxf(lines, circles, scaleFactor, unit), `${base}-2d.dxf`, 'application/dxf');
  const exportPng = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.toBlob((b) => b && downloadBlob(b, `${base}-2d.png`), 'image/png');
  };
  const exportStl = () => {
    const stl = buildExtrudedStl(faces, circles, scaleFactor, unit, d.extrudeHeightMm);
    downloadText(stl, `${base}-${d.extrudeHeightMm}mm.stl`, 'model/stl');
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
            <button className={sketchTool === 'area' ? 'active' : ''} onClick={() => setSketchTool('area')}>
              ▰ Fläche
            </button>
            <button className={sketchTool === 'circle' ? 'active' : ''} onClick={() => setSketchTool('circle')}>
              ◯ Kreis
            </button>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {sketchTool === 'line'
              ? 'Punkte tippen – fortlaufende Linien. „Fertig“ beendet die Kette.'
              : sketchTool === 'area'
                ? 'Ecken tippen, am ersten Punkt (grün) schließen → gefüllte Fläche.'
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
            {sketchTool === 'area' ? 'Flächen-Kette abbrechen' : 'Linienkette beenden (Enter)'}
          </button>
        )}
      </div>

      {(selectedLine || selectedCircle) && <SelectedEditor line={selectedLine} circle={selectedCircle} />}

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Fangen / Raster</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={d.endpointSnap} onChange={(e) => set({ endpointSnap: e.target.checked })} />
          Punkt fangen (Endpunkte)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={d.angleSnap} onChange={(e) => set({ angleSnap: e.target.checked })} />
          Winkel-Raster (Linien/Flächen)
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
        <h3 style={{ marginBottom: 8 }}>3D-Druck (STL)</h3>
        <div className="small muted" style={{ marginTop: 0, marginBottom: 8 }}>
          Geschlossene Flächen{circles.length > 0 ? ' und Kreise' : ''} werden extrudiert und als STL für den Drucker-Slicer
          gespeichert (Maße in mm).
        </div>
        <div className="field">
          <label>Höhe (mm)</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={d.extrudeHeightMm}
            onChange={(e) => set({ extrudeHeightMm: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
          />
        </div>
        <button className="active" style={{ marginTop: 10 }} onClick={exportStl} disabled={!canExtrude}>
          STL exportieren ({faces.length} Fläche{faces.length === 1 ? '' : 'n'}
          {circles.length > 0 ? ` + ${circles.length} Kreis${circles.length === 1 ? '' : 'e'}` : ''})
        </button>
        {!canExtrude && (
          <div className="small muted" style={{ marginTop: 6 }}>
            Noch keine geschlossene Fläche. Mit „▰ Fläche“ einen Umriss zeichnen und am Startpunkt schließen, oder mit Linien
            eine Schleife bilden.
          </div>
        )}
        {!Number.isFinite(mmFactor) && <div className="small muted">⚠ Nicht kalibriert.</div>}
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
