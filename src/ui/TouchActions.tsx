import type { ReactNode } from 'react';
import { useStore } from '../store';

/**
 * In-viewport floating action bar so touch users can finish/cancel/undo
 * without a keyboard (Enter/Esc/Ctrl+Z equivalents).
 */
export default function TouchActions() {
  const modelObject = useStore((s) => s.modelObject);
  const mode = useStore((s) => s.mode);
  const walkMode = useStore((s) => s.walkMode);
  const readonly = useStore((s) => s.readonly);

  const measureTool = useStore((s) => s.measureTool);
  const pendingPoints = useStore((s) => s.pendingPoints.length);
  const pendingWall = useStore((s) => s.pendingWallPoints.length);
  const openingPlaceType = useStore((s) => s.openingPlaceType);
  const selectedWallId = useStore((s) => s.selectedWallId);
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const selectedOpeningId = useStore((s) => s.selectedOpeningId);
  const selectedMeasurementId = useStore((s) => s.selectedMeasurementId);
  const canUndo = useStore((s) => s.history.length > 0);

  const finishMeasurement = useStore((s) => s.finishMeasurement);
  const finishWallChain = useStore((s) => s.finishWallChain);
  const cancelPending = useStore((s) => s.cancelPending);
  const setOpeningPlaceType = useStore((s) => s.setOpeningPlaceType);
  const undo = useStore((s) => s.undo);
  const deleteSelection = useStore((s) => s.deleteSelection);

  if (!modelObject || walkMode) return null;
  if (mode !== 'draw' && mode !== 'measure') return null;

  const hasSelection = !!(selectedWallId || selectedRoomId || selectedOpeningId || selectedMeasurementId);
  const measurePending = mode === 'measure' && (measureTool === 'polyline' || measureTool === 'polygon') && pendingPoints > 0;
  const drawPending = mode === 'draw' && pendingWall > 0;

  const buttons: ReactNode[] = [];

  if (measurePending) {
    buttons.push(
      <button key="mf" className="active" onClick={finishMeasurement} disabled={pendingPoints < (measureTool === 'polygon' ? 3 : 2)}>
        ✓ Fertig
      </button>,
    );
  }
  if (drawPending) {
    buttons.push(
      <button key="df" className="active" onClick={finishWallChain}>
        ✓ Kette beenden
      </button>,
    );
  }
  if (openingPlaceType) {
    buttons.push(
      <button key="oc" onClick={() => setOpeningPlaceType(null)}>
        ✗ Abbrechen
      </button>,
    );
  }
  if ((measurePending || drawPending) && !openingPlaceType) {
    buttons.push(
      <button key="cp" onClick={cancelPending}>
        ✗ Abbrechen
      </button>,
    );
  }
  if (hasSelection && !readonly) {
    buttons.push(
      <button key="del" className="danger" onClick={deleteSelection}>
        🗑 Löschen
      </button>,
    );
  }
  if (!readonly) {
    buttons.push(
      <button key="undo" onClick={undo} disabled={!canUndo}>
        ↶
      </button>,
    );
  }

  if (buttons.length === 0) return null;
  return <div className="touch-actions">{buttons}</div>;
}
