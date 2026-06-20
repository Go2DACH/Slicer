import { useStore } from '../store';

export default function HintBar() {
  const mode = useStore((s) => s.mode);
  const measureTool = useStore((s) => s.measureTool);
  const alignTool = useStore((s) => s.alignTool);
  const modelObject = useStore((s) => s.modelObject);
  const pending = useStore((s) => s.pendingPoints.length);
  const alignPts = useStore((s) => s.alignPoints.length);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const pendingWall = useStore((s) => s.pendingWallPoints.length);
  const drawKind = useStore((s) => s.drawKind);
  const drawTool = useStore((s) => s.drawTool);
  const sketchTool = useStore((s) => s.sketchTool);
  const walkMode = useStore((s) => s.walkMode);

  if (!modelObject) return null;

  if (walkMode) {
    return (
      <div className="hint-bar">
        <b>Begehung:</b> Klicken zum Umsehen · <span className="kbd">W</span>
        <span className="kbd">A</span>
        <span className="kbd">S</span>
        <span className="kbd">D</span> laufen · <span className="kbd">Q</span>/<span className="kbd">E</span> hoch/runter ·{' '}
        <span className="kbd">Shift</span> schneller · <span className="kbd">Esc</span> Maus frei
      </div>
    );
  }

  let text: React.ReactNode = null;

  if (mode === 'measure') {
    if (measureTool === 'distance') text = <>Zwei Punkte auf der Oberfläche klicken für eine <b>Strecke</b>.</>;
    else if (measureTool === 'polyline')
      text = (
        <>
          Punkte für die <b>Polylinie</b> klicken · <span className="kbd">Enter</span> beendet · {pending} Punkt(e)
        </>
      );
    else if (measureTool === 'polygon')
      text = (
        <>
          Punkte für die <b>Fläche</b> klicken (≥3) · <span className="kbd">Enter</span> schließt · {pending} Punkt(e)
        </>
      );
    else if (measureTool === 'calibrate')
      text = (
        <>
          Zwei Punkte mit <b>bekanntem Abstand</b> klicken, dann Maß eingeben.
        </>
      );
  } else if (mode === 'align') {
    if (alignTool === 'floor')
      text = (
        <>
          <b>3 Bodenpunkte</b> klicken, um den Boden waagrecht auszurichten · {alignPts}/3
        </>
      );
    else
      text = (
        <>
          <b>2 Wandpunkte</b> klicken, um die Wand achsparallel zu drehen · {alignPts}/2
        </>
      );
  } else if (mode === 'draw' && drawKind === 'sketch2d') {
    text =
      sketchTool === 'line' ? (
        <>
          Punkte tippen für <b>Linien</b> · „Fertig“ beendet die Kette
        </>
      ) : (
        <>
          <b>Kreis</b>: Mittelpunkt tippen, dann Radius-Punkt tippen
        </>
      );
  } else if (mode === 'draw' && drawKind === 'bim') {
    if (openingPlaceType)
      text = (
        <>
          Auf eine Wand klicken, um {openingPlaceType === 'door' ? 'eine Tür' : 'ein Fenster'} zu platzieren ·{' '}
          <span className="kbd">Esc</span> bricht ab
        </>
      );
    else if (drawTool === 'rect')
      text = (
        <>
          <b>Rechteck</b>: zwei gegenüberliegende Ecken tippen
        </>
      );
    else
      text = (
        <>
          Auf den Boden tippen, um <b>Wände</b> zu zeichnen · „Fertig“ beendet die Kette{' '}
          {pendingWall > 0 ? `· ${pendingWall} aktiv` : ''}
        </>
      );
  }

  if (!text) return null;
  return <div className="hint-bar">{text}</div>;
}
