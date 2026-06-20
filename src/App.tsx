import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { useModelLoading } from './hooks/useModelLoading';
import { useKeyboard } from './hooks/useKeyboard';
import Scene from './components/Scene';
import Toolbar from './ui/Toolbar';
import SidePanel from './ui/SidePanel';
import DropHint from './ui/DropHint';
import CalibrateDialog from './ui/CalibrateDialog';
import ShareDialog from './ui/ShareDialog';
import HintBar from './ui/HintBar';
import TouchActions from './ui/TouchActions';

export default function App() {
  const { loadFiles, loadUrl } = useModelLoading();
  useKeyboard();

  const modelObject = useStore((s) => s.modelObject);
  const loading = useStore((s) => s.loading);
  const loadProgress = useStore((s) => s.loadProgress);
  const loadError = useStore((s) => s.loadError);
  const panelOpen = useStore((s) => s.panelOpen);
  const calibratePoints = useStore((s) => s.calibratePoints);

  const [dragging, setDragging] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCalibrate, setShowCalibrate] = useState(false);
  const dragCounter = useRef(0);

  // Auto-open the calibration dialog once two reference points are picked.
  useEffect(() => {
    if (calibratePoints.length === 2) setShowCalibrate(true);
  }, [calibratePoints.length]);

  // Files chosen via the toolbar's hidden file input.
  useEffect(() => {
    const handler = (e: Event) => {
      const files = (e as CustomEvent<File[]>).detail;
      if (files?.length) void loadFiles(files);
    };
    window.addEventListener('slicer:loadfiles', handler as EventListener);
    return () => window.removeEventListener('slicer:loadfiles', handler as EventListener);
  }, [loadFiles]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) void loadFiles(files);
    },
    [loadFiles],
  );

  return (
    <div
      className={`app${dragging ? ' dragging' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <Toolbar onShare={() => setShowShare(true)} onCalibrate={() => setShowCalibrate(true)} />

      <div className={`main${panelOpen ? '' : ' no-panel'}`}>
        <div className="viewport" id="walk-lock-target">
          <Scene />

          {!modelObject && !loading && (
            <DropHint onPickFiles={loadFiles} onLoadSample={() => loadUrl('models/demo-room.glb')} />
          )}

          {loading && (
            <div className="overlay-center">
              <div className="loader">
                <div>Modell wird geladen …</div>
                <div className="progress">
                  <div style={{ width: `${Math.round((loadProgress || 0) * 100)}%` }} />
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  {loadProgress > 0 ? `${Math.round(loadProgress * 100)} %` : 'Bitte warten …'}
                </div>
              </div>
            </div>
          )}

          {loadError && (
            <div className="overlay-center">
              <div className="error-box">
                <strong>Fehler beim Laden</strong>
                <div style={{ marginTop: 6 }}>{loadError.message}</div>
                {loadError.detail && (
                  <div className="small mono muted" style={{ marginTop: 6, wordBreak: 'break-word' }}>
                    {loadError.detail}
                  </div>
                )}
              </div>
            </div>
          )}

          <TouchActions />
          <HintBar />
        </div>

        {panelOpen && <SidePanel />}
      </div>

      {showCalibrate && <CalibrateDialog onClose={() => setShowCalibrate(false)} />}
      {showShare && <ShareDialog onClose={() => setShowShare(false)} />}
    </div>
  );
}
