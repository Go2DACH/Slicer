import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { computeFloorAlign, computeWallAlign } from '../lib/align';
import { planeNormalFromThree } from '../lib/geometry';
import type { Vec3 } from '../types';

export default function AlignPanel() {
  const alignTool = useStore((s) => s.alignTool);
  const setAlignTool = useStore((s) => s.setAlignTool);
  const alignPoints = useStore((s) => s.alignPoints);
  const clearAlignPoints = useStore((s) => s.clearAlignPoints);
  const alignQuaternion = useStore((s) => s.alignQuaternion);
  const alignOffset = useStore((s) => s.alignOffset);
  const alignApplied = useStore((s) => s.alignApplied);
  const setAlignment = useStore((s) => s.setAlignment);
  const transformAnnotations = useStore((s) => s.transformAnnotations);
  const resetAlignment = useStore((s) => s.resetAlignment);
  const triggerResetView = useStore((s) => s.triggerResetView);
  const setCameraView = useStore((s) => s.setCameraView);

  const [feedback, setFeedback] = useState<string | null>(null);
  const applyingRef = useRef(false);

  const flash = (msg: string) => {
    setFeedback(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setFeedback(null), 3500);
  };

  const applyFloor = () => {
    if (useStore.getState().alignPoints.length < 3) return;
    const pts = useStore.getState().alignPoints;
    const normal = planeNormalFromThree(pts[0], pts[1], pts[2]);
    const angle = (Math.acos(Math.min(1, Math.abs(normal.dot(new THREE.Vector3(0, 1, 0))))) * 180) / Math.PI;
    const res = computeFloorAlign(pts, alignQuaternion, alignOffset);
    transformAnnotations(res.delta);
    setAlignment(res.quaternion, res.offset);
    // After aligning the floor, switch to the top-down view automatically.
    setCameraView('top');
    triggerResetView();
    flash(angle < 1.5 ? '✓ Boden waagrecht · Draufsicht' : `✓ Boden ausgerichtet (${angle.toFixed(0)}°) · Draufsicht`);
  };

  const applyWall = () => {
    if (useStore.getState().alignPoints.length < 2) return;
    const pts = useStore.getState().alignPoints;
    const res = computeWallAlign(pts, alignQuaternion, alignOffset);
    transformAnnotations(res.delta);
    setAlignment(res.quaternion, res.offset);
    triggerResetView();
    flash('✓ Wand achsparallel gedreht');
  };

  // Auto-apply as soon as enough points are picked (3 floor / 2 wall).
  useEffect(() => {
    if (applyingRef.current) return;
    const need = alignTool === 'floor' ? 3 : 2;
    if (alignPoints.length >= need) {
      applyingRef.current = true;
      if (alignTool === 'floor') applyFloor();
      else applyWall();
      // release the guard on the next tick (points get cleared by setAlignment)
      window.setTimeout(() => {
        applyingRef.current = false;
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignPoints.length, alignTool]);

  const reset = () => {
    // Map annotations back to the un-aligned (raw) frame: raw = R^-1 (world - offset).
    const qInv = new THREE.Quaternion(
      alignQuaternion[0],
      alignQuaternion[1],
      alignQuaternion[2],
      alignQuaternion[3],
    ).invert();
    const off = new THREE.Vector3(alignOffset[0], alignOffset[1], alignOffset[2]);
    const invert = (p: Vec3): Vec3 => {
      const v = new THREE.Vector3(p[0], p[1], p[2]).sub(off).applyQuaternion(qInv);
      return [v.x, v.y, v.z];
    };
    transformAnnotations(invert);
    resetAlignment();
    triggerResetView();
  };

  return (
    <div>
      <h3>Ausrichten</h3>
      <div className="card">
        <div className="row">
          <button className={alignTool === 'floor' ? 'active' : ''} onClick={() => setAlignTool('floor')}>
            Boden (3 Punkte)
          </button>
          <button className={alignTool === 'wall' ? 'active' : ''} onClick={() => setAlignTool('wall')}>
            Wand (2 Punkte)
          </button>
        </div>

        <div className="small muted" style={{ marginTop: 8 }}>
          {alignTool === 'floor'
            ? 'Klicke nacheinander drei Punkte auf dem Boden – die Ausrichtung erfolgt automatisch beim dritten Punkt.'
            : 'Klicke zwei Punkte entlang einer Wand – die Drehung erfolgt automatisch beim zweiten Punkt.'}
        </div>

        {/* progress dots */}
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          {Array.from({ length: alignTool === 'floor' ? 3 : 2 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: i < alignPoints.length ? 'var(--accent)' : 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            />
          ))}
          <span className="small muted">
            {alignPoints.length}/{alignTool === 'floor' ? 3 : 2} Punkte
          </span>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="icon-btn" onClick={clearAlignPoints} disabled={alignPoints.length === 0}>
            Punkte löschen
          </button>
        </div>

        {feedback && (
          <div className="badge ok" style={{ marginTop: 10, display: 'block' }}>
            {feedback}
          </div>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          {alignApplied && <span className="badge ok">ausgerichtet</span>}
          <div className="spacer" style={{ flex: 1 }} />
          <button className="danger" onClick={reset} disabled={!alignApplied}>
            Zurücksetzen
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          Tipp: Erst Boden ausrichten, dann optional eine Wand achsparallel drehen. Danach im Modus <b>Zeichnen</b> die
          Top-Down-Ansicht nutzen.
        </div>
      </div>
    </div>
  );
}
