import { useState } from 'react';
import { useStore } from '../store';

/**
 * Soft access gate shown when a share link carries a PIN. It is a client-side
 * hurdle (the model URL is still in the link), not hard security — it just keeps
 * the scan from being opened by anyone who stumbles on the link.
 */
export default function PinGate() {
  const unlock = useStore((s) => s.unlock);
  const modelInfo = useStore((s) => s.modelInfo);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true);
    const ok = await unlock(pin.trim());
    setBusy(false);
    if (!ok) {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="pin-gate">
      <form className="dialog" onSubmit={submit} style={{ maxWidth: 360 }}>
        <h2>Zugang geschützt</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Dieser Scan{modelInfo ? ` (${modelInfo.fileName})` : ''} ist mit einem Zugangscode geschützt. Bitte gib den Code
          ein, den du erhalten hast.
        </p>
        <div className="field">
          <label>Zugangscode</label>
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(false);
            }}
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="••••"
          />
        </div>
        {error && (
          <div className="small" style={{ color: 'var(--danger, #e5484d)', marginTop: 8 }}>
            Falscher Code. Bitte erneut versuchen.
          </div>
        )}
        <div className="actions">
          <button className="active" type="submit" disabled={!pin.trim() || busy}>
            {busy ? 'Prüfe …' : 'Entsperren'}
          </button>
        </div>
      </form>
    </div>
  );
}
