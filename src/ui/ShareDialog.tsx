import { useCallback, useMemo, useState } from 'react';
import { useStore } from '../store';
import { encodeShare, sha256Hex, type ShareSetup } from '../lib/share';
import {
  loadToken,
  saveToken,
  clearToken,
  configFor,
  verifyToken,
  uploadScan,
  listScans,
  deleteScan,
  type ScanFile,
  SCAN_OWNER,
  SCAN_REPO,
} from '../lib/github';

function fmtSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function baseAppUrl(): string {
  const origin = window.location.origin;
  const base = import.meta.env.BASE_URL;
  return `${origin}${base}`.replace(/\/$/, '/');
}

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const sourceFile = useStore((s) => s.sourceFile);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const calibrated = useStore((s) => s.calibrated);
  const alignQuaternion = useStore((s) => s.alignQuaternion);
  const alignOffset = useStore((s) => s.alignOffset);
  const alignApplied = useStore((s) => s.alignApplied);

  const initialUrl = useMemo(() => new URLSearchParams(window.location.search).get('model') ?? '', []);

  const [modelUrl, setModelUrl] = useState(initialUrl);
  const [pin, setPin] = useState('');
  const [readonly, setReadonly] = useState(false);
  const [viewer, setViewer] = useState(true);
  const [withCalibration, setWithCalibration] = useState(true);
  const [withAlignment, setWithAlignment] = useState(true);

  // GitHub connection: only a fine-grained token is needed (stored locally,
  // never shared). Owner/repo/branch are fixed in github.ts.
  const [token, setToken] = useState(loadToken());
  const [tokenDraft, setTokenDraft] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);
  const connected = token.trim() !== '';

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const [link, setLink] = useState('');
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [scans, setScans] = useState<ScanFile[] | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const connect = async () => {
    const t = tokenDraft.trim();
    if (!t) return;
    setConnecting(true);
    setConnectErr(null);
    try {
      if (await verifyToken(t)) {
        saveToken(t);
        setToken(t);
        setTokenDraft('');
      } else {
        setConnectErr(`Token ungültig oder ohne Zugriff auf ${SCAN_OWNER}/${SCAN_REPO}.`);
      }
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    clearToken();
    setToken('');
    setScans(null);
  };

  const buildLink = useCallback(
    async (urlOverride?: string) => {
      const trimmed = (urlOverride ?? modelUrl).trim();
      if (!trimmed) return;
      setBuilding(true);
      try {
        const setup: ShareSetup = {
          m: trimmed,
          sf: withCalibration ? scaleFactor : 1,
          u: withCalibration ? unit : 'm',
          cal: withCalibration ? calibrated : false,
          ro: readonly || viewer,
        };
        if (viewer) setup.v = true;
        if (withAlignment && alignApplied) {
          setup.q = alignQuaternion;
          setup.o = alignOffset;
        }
        if (pin.trim()) setup.p = await sha256Hex(pin.trim());
        const url = new URL(baseAppUrl());
        url.searchParams.set('s', encodeShare(setup));
        setLink(url.toString());
      } finally {
        setBuilding(false);
      }
    },
    [modelUrl, withCalibration, scaleFactor, unit, calibrated, readonly, viewer, withAlignment, alignApplied, alignQuaternion, alignOffset, pin],
  );

  const upload = async () => {
    if (!sourceFile) {
      setUploadErr('Kein Scan geladen. Lade den Scan zuerst in den Viewer.');
      return;
    }
    if (!connected) {
      setUploadErr('Bitte zuerst mit GitHub verbinden.');
      return;
    }
    setUploadErr(null);
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadScan(sourceFile, configFor(token), setProgress);
      setModelUrl(url);
      await buildLink(url); // produce the link right away
      void refreshScans();
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const refreshScans = useCallback(async () => {
    if (!connected) return;
    setListBusy(true);
    setUploadErr(null);
    try {
      setScans(await listScans(configFor(token)));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, [connected, token]);

  const removeScan = async (f: ScanFile) => {
    if (!window.confirm(`„${f.name}“ wirklich löschen? Bestehende Links auf diese Datei funktionieren danach nicht mehr.`))
      return;
    setDeleting(f.sha);
    try {
      await deleteScan(configFor(token), f.name, f.sha);
      setScans((prev) => (prev ? prev.filter((x) => x.sha !== f.sha) : prev));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

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

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Scan teilen</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Scan hochladen und Link erzeugen. Kalibrierung und Ausrichtung werden mitgegeben — der Kunde muss nichts
          einstellen.
        </p>

        {/* 1 · GitHub connection (one-time) */}
        {!connected ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Einmal mit GitHub verbinden</h3>
            <p className="small muted" style={{ marginTop: 0 }}>
              Einmaliger Zugangsschlüssel (Token). Er bleibt nur auf diesem Gerät und wird nie im Link weitergegeben. So
              erstellst du ihn:
            </p>
            <ol className="small" style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Slicer+Scan+Upload"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <b>Diesen Link öffnen ↗</b>
                </a>{' '}
                (bei GitHub anmelden). Der nötige Haken <span className="mono">repo</span> ist schon gesetzt.
              </li>
              <li>
                Bei <b>Expiration</b> ein Ablaufdatum wählen (z. B. <i>No expiration</i> für dauerhaft).
              </li>
              <li>
                Ganz unten den grünen Button <b>„Generate token"</b> klicken.
              </li>
              <li>
                Den angezeigten Token (<span className="mono">ghp_…</span>) kopieren und hier einfügen → <b>Verbinden</b>.
              </li>
            </ol>
            <div className="row">
              <input
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                type="password"
                placeholder="github_pat_…"
                onKeyDown={(e) => e.key === 'Enter' && connect()}
              />
              <button className="active" onClick={connect} disabled={connecting || !tokenDraft.trim()}>
                {connecting ? 'Prüfe …' : 'Verbinden'}
              </button>
            </div>
            {connectErr && (
              <div className="small" style={{ color: 'var(--danger, #e5484d)', marginTop: 8, wordBreak: 'break-word' }}>
                {connectErr}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge ok">✓ Mit GitHub verbunden</span>
            <div className="spacer" style={{ flex: 1 }} />
            <button className="icon-btn" onClick={disconnect} title="Token entfernen">
              Trennen
            </button>
          </div>
        )}

        {/* 2 · Upload */}
        {connected && (
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>Scan hochladen</h3>
            <button className="active" onClick={upload} disabled={uploading || !sourceFile}>
              {uploading
                ? `Lädt … ${Math.round(progress * 100)} %`
                : sourceFile
                  ? `„${sourceFile.name}“ hochladen & Link erzeugen`
                  : 'Kein Scan geladen'}
            </button>
            {uploading && (
              <div className="progress" style={{ marginTop: 8 }}>
                <div style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
            {uploadErr && (
              <div className="small" style={{ color: 'var(--danger, #e5484d)', marginTop: 8, wordBreak: 'break-word' }}>
                {uploadErr}
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={refreshScans} disabled={listBusy}>
                {listBusy ? 'Lädt …' : 'Hochgeladene Scans verwalten'}
              </button>
            </div>
            {scans && (
              <div style={{ marginTop: 8 }}>
                {scans.length === 0 ? (
                  <div className="small muted">Noch keine Scans hochgeladen.</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {scans.map((f) => (
                      <li
                        key={f.sha}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono small" style={{ wordBreak: 'break-all' }}>{f.name}</div>
                          <div className="small muted">{fmtSize(f.size)}</div>
                        </div>
                        <button onClick={() => { setModelUrl(f.url); void buildLink(f.url); }} title="Diese Datei für den Link verwenden">
                          Verwenden
                        </button>
                        <button className="danger" onClick={() => removeScan(f)} disabled={deleting === f.sha}>
                          {deleting === f.sha ? '…' : 'Löschen'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3 · Options */}
        <h3 style={{ marginTop: 16 }}>Optionen</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={viewer} onChange={(e) => setViewer(e.target.checked)} />
          🚶 Nur-Viewer: begehbares Haus, nur Ansehen + Messen (empfohlen für Kunden)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={readonly} disabled={viewer} onChange={(e) => setReadonly(e.target.checked)} />
          Nur ansehen + messen (kein Bearbeiten)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={withCalibration} onChange={(e) => setWithCalibration(e.target.checked)} />
          Kalibrierung mitgeben {calibrated ? `(${scaleFactor.toPrecision(4)} ${unit}/Einheit)` : '(noch nicht kalibriert)'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={withAlignment} onChange={(e) => setWithAlignment(e.target.checked)} />
          Ausrichtung mitgeben {alignApplied ? '' : '(noch nicht ausgerichtet)'}
        </label>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Zugangscode für den Kunden (optional)</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="leer = sofortiger Zugang" inputMode="numeric" />
        </div>

        {/* 4 · Link */}
        <h3 style={{ marginTop: 16 }}>Link</h3>
        {link ? (
          <>
            <div className="row">
              <input className="mono small" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="active" onClick={() => copy(link, 'link')}>
                {copied === 'link' ? '✓ Kopiert' : 'Kopieren'}
              </button>
            </div>
            <button style={{ marginTop: 8 }} onClick={() => buildLink()} disabled={!modelUrl.trim() || building}>
              Mit aktuellen Optionen neu erzeugen
            </button>
          </>
        ) : (
          <button className="active" onClick={() => buildLink()} disabled={!modelUrl.trim() || building}>
            {building ? 'Erzeuge …' : 'Link erzeugen'}
          </button>
        )}

        {/* Advanced: manual model URL */}
        <div style={{ marginTop: 12 }}>
          <button className="icon-btn" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? '▾' : '▸'} Erweitert: eigene Modell-URL
          </button>
          {showAdvanced && (
            <div className="field" style={{ marginTop: 8 }}>
              <input
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                placeholder="https://…/scan.glb (CORS-fähig) oder models/scan.glb"
              />
              <span className="small muted">Wird vom Upload automatisch gesetzt. Eigene URL muss CORS erlauben.</span>
            </div>
          )}
        </div>

        <div className="actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
