import * as THREE from 'three';
import { useStore } from '../store';
import { computeFloorAlign, computeWallAlign } from '../lib/align';
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

  const applyFloor = () => {
    if (alignPoints.length < 3) return;
    const res = computeFloorAlign(alignPoints, alignQuaternion, alignOffset);
    transformAnnotations(res.delta);
    setAlignment(res.quaternion, res.offset);
    triggerResetView();
  };

  const applyWall = () => {
    if (alignPoints.length < 2) return;
    const res = computeWallAlign(alignPoints, alignQuaternion, alignOffset);
    transformAnnotations(res.delta);
    setAlignment(res.quaternion, res.offset);
    triggerResetView();
  };

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
            ? `Gesetzte Punkte: ${alignPoints.length}/3 — drei Punkte auf dem Boden klicken.`
            : `Gesetzte Punkte: ${alignPoints.length}/2 — zwei Punkte entlang einer Wand klicken.`}
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          {alignTool === 'floor' ? (
            <button className="active" onClick={applyFloor} disabled={alignPoints.length < 3}>
              Boden ausrichten
            </button>
          ) : (
            <button className="active" onClick={applyWall} disabled={alignPoints.length < 2}>
              Wand ausrichten
            </button>
          )}
          <button onClick={clearAlignPoints} disabled={alignPoints.length === 0}>
            Punkte löschen
          </button>
        </div>

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
