import { useMemo, useState } from 'react';
import { useStore } from '../store';

function baseAppUrl(): string {
  const origin = window.location.origin;
  const base = import.meta.env.BASE_URL;
  return `${origin}${base}`.replace(/\/$/, '/');
}

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const modelInfo = useStore((s) => s.modelInfo);

  const initial = useMemo(() => {
    const param = new URLSearchParams(window.location.search).get('model');
    if (param) return param;
    const name = modelInfo?.fileName ?? 'modell.glb';
    return `models/${name}`;
  }, [modelInfo]);

  const [path, setPath] = useState(initial);
  const [readonly, setReadonly] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const link = useMemo(() => {
    const trimmed = path.trim();
    if (!trimmed) return '';
    const url = new URL(baseAppUrl());
    url.searchParams.set('model', trimmed);
    if (readonly) url.searchParams.set('view', 'readonly');
    return url.toString();
  }, [path, readonly]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const isLocalDrop = !new URLSearchParams(window.location.search).get('model');

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Modell teilen</h2>

        {isLocalDrop && (
          <div className="card" style={{ marginBottom: 12 }}>
            <strong>Hinweis:</strong> Dieses Modell wurde lokal geladen und ist nicht direkt teilbar. Hoste die Datei zuerst,
            dann erzeugt der Link unten den Viewer für die Empfänger.
          </div>
        )}

        <h3>1 · Datei hosten</h3>
        <ul className="small" style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>
            <b>Im Repo</b>: Datei nach <span className="mono">public/models/</span> legen und committen → Pfad{' '}
            <span className="mono">models/datei.glb</span> (same-origin, keine CORS-Probleme).
          </li>
          <li>
            <b>GitHub Release</b> (für große Dateien &gt; 100 MB): Asset hochladen, volle URL des Assets verwenden.
          </li>
          <li>
            <b>Externe URL</b>: beliebiger Host, der <span className="mono">CORS</span> erlaubt (z. B.{' '}
            <span className="mono">raw.githubusercontent.com</span>).
          </li>
        </ul>

        <h3 style={{ marginTop: 16 }}>2 · Pfad oder URL</h3>
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="models/haus.glb" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={readonly} onChange={(e) => setReadonly(e.target.checked)} />
          Read-only-Link (Empfänger können messen, aber nicht editieren)
        </label>

        <h3 style={{ marginTop: 16 }}>3 · Link</h3>
        <div className="row">
          <input className="mono small" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="active" onClick={() => copy(link, 'link')} disabled={!link}>
            {copied === 'link' ? '✓ Kopiert' : 'Kopieren'}
          </button>
        </div>

        <div className="actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
