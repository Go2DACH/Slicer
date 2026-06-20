import { useStore } from '../store';

/**
 * Floating viewport controls for inspecting hidden geometry while measuring or
 * drawing: X-ray (50% transparent) and a horizontal section that hides
 * everything above a height percentage (10% steps).
 */
export default function ViewTools() {
  const modelObject = useStore((s) => s.modelObject);
  const walkMode = useStore((s) => s.walkMode);
  const xray = useStore((s) => s.xray);
  const setXray = useStore((s) => s.setXray);
  const clipEnabled = useStore((s) => s.clipEnabled);
  const setClipEnabled = useStore((s) => s.setClipEnabled);
  const clipPercent = useStore((s) => s.clipPercent);
  const setClipPercent = useStore((s) => s.setClipPercent);

  if (!modelObject || walkMode) return null;

  return (
    <div className="view-tools">
      <button
        className={xray ? 'active' : ''}
        onClick={() => setXray(!xray)}
        title="Röntgen: Modell 50% transparent (verdeckte Teile sichtbar)"
      >
        {xray ? '◐' : '●'}
      </button>
      <button
        className={clipEnabled ? 'active' : ''}
        onClick={() => setClipEnabled(!clipEnabled)}
        title="Schnitt: oberen Teil ab Höhe ausblenden"
      >
        ✂
      </button>
      {clipEnabled && (
        <div className="clip-slider">
          <input
            type="range"
            min={10}
            max={100}
            step={10}
            value={clipPercent}
            onChange={(e) => setClipPercent(parseInt(e.target.value, 10))}
            title="Schnitthöhe in % der Modellhöhe"
          />
          <div className="pct">{clipPercent}%</div>
        </div>
      )}
    </div>
  );
}
