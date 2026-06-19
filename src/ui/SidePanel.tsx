import { useState } from 'react';
import { useStore } from '../store';
import ModelInfoCard from './ModelInfoCard';
import MeasurePanel from './MeasurePanel';
import MeasurementList from './MeasurementList';
import AlignPanel from './AlignPanel';
import DrawPanel from './DrawPanel';
import BimList from './BimList';
import ExportPanel from './ExportPanel';
import CalibrateDialog from './CalibrateDialog';

export default function SidePanel() {
  const mode = useStore((s) => s.mode);
  const modelObject = useStore((s) => s.modelObject);
  const [showCalibrate, setShowCalibrate] = useState(false);

  if (!modelObject) {
    return (
      <div className="panel">
        <ModelInfoCard />
        <div className="muted small">Lade ein Modell, um Werkzeuge zu nutzen.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <ModelInfoCard />

      {mode === 'measure' && <MeasurePanel onCalibrate={() => setShowCalibrate(true)} />}
      {mode === 'align' && <AlignPanel />}
      {mode === 'draw' && <DrawPanel />}
      {mode === 'export' && <ExportPanel />}

      <MeasurementList />

      {(mode === 'draw' || mode === 'export') && <BimList />}

      {showCalibrate && <CalibrateDialog onClose={() => setShowCalibrate(false)} />}
    </div>
  );
}
