import { useEffect } from 'react';
import { useStore } from '../store';

/** Global keyboard shortcuts: Esc cancels, Delete removes selection, Ctrl+Z undo. */
export function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const store = useStore.getState();
      if (e.key === 'Escape') {
        store.cancelPending();
        store.selectMeasurement(null);
        store.selectWall(null);
        store.selectOpening(null);
        store.setOpeningPlaceType(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!store.readonly) {
          e.preventDefault();
          store.deleteSelection();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!store.readonly) {
          e.preventDefault();
          store.undo();
        }
      } else if (e.key === 'Enter') {
        // finish polyline/polygon measurement
        if (store.mode === 'measure' && (store.measureTool === 'polyline' || store.measureTool === 'polygon')) {
          store.finishMeasurement();
        }
        if (store.mode === 'draw') store.finishWallChain();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
