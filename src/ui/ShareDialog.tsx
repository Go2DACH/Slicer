import { useCallback, useMemo, useState } from 'react';
import { useStore } from '../store';
import { encodeShare, sha256Hex, type ShareSetup } from '../lib/share';
import {
  loadGithubConfig,
  saveGithubConfig,
  uploadScanToRelease,
  listReleaseAssets,
  deleteReleaseAsset,
  type GithubConfig,
  type ReleaseAsset,
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

  // Prefill the model URL from the current link, if any.
  const initialUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') ?? '';
  }, []);

  const [modelUrl, setModelUrl] = useState(initialUrl);
  const [pin, setPin] = useState('');
  const [readonly, setReadonly] = useState(false);
  const [withCalibration, setWithCalibration] = useState(true);
  const [withAlignment, setWithAlignment] = useState(true);

  // GitHub release upload config (owner token stored locally, never shared).
  const saved = useMemo(() => loadGithubConfig(), []);
  const [owner, setOwner] = useState(saved.owner ?? 'go2dach');
  const [repo, setRepo] = useState(saved.repo ?? 'Slicer');
  const [tag, setTag] = useState(saved.tag ?? 'scans');
  const [token, setToken] = useState(saved.token ?? '');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const [link, setLink] = useState('');
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Uploaded scans (for managing / deleting old files).
  const [assets, setAssets] = useState<ReleaseAsset[] | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const currentCfg = useCallback((): GithubConfig | null => {
    if (!owner.trim() || !repo.trim() || !tag.trim() || !token.trim()) return null;
    return { owner: owner.trim(), repo: repo.trim(), tag: tag.trim(), token: token.trim() };
  }, [owner, repo, tag, token]);

  const refreshAssets = useCallback(async () => {
    const cfg = currentCfg();
    if (!cfg) {
      setUploadErr('Bitte Owner, Repo, Tag und Token ausfüllen, um die Dateien zu laden.');
      return;
    }
    setUploadErr(null);
    setListBusy(true);
    try {
      setAssets(await listReleaseAssets(cfg));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, [currentCfg]);

  const removeAsset = async (a: ReleaseAsset) => {
    const cfg = currentCfg();
    if (!cfg) return;
    if (!window.confirm(`„${a.name}“ wirklich löschen? Bestehende Links auf diese Datei funktionieren danach nicht mehr.`))
      return;
    setDeleting(a.id);
    try {
      await deleteReleaseAsset(cfg, a.id);
      setAssets((prev) => (prev ? prev.filter((x) => x.id !== a.id) : prev));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

  const upload = async () => {
    if (!sourceFile) {
      setUploadErr('Keine lokale Scan-Datei vorhanden. Lade den Scan zuerst in den Viewer.');
      return;
    }
    if (!owner || !repo || !tag || !token) {
      setUploadErr('Bitte Owner, Repo, Tag und Token ausfüllen.');
      return;
    }
    const cfg: GithubConfig = { owner: owner.trim(), repo: repo.trim(), tag: tag.trim(), token: token.trim() };
    saveGithubConfig(cfg);
    setUploadErr(null);
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadScanToRelease(sourceFile, cfg, (f) => setProgress(f));
      setModelUrl(url);
      void refreshAssets();
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const buildLink = async () => {
    const trimmed = modelUrl.trim();
    if (!trimmed) return;
    setBuilding(true);
    try {
      const setup: ShareSetup = {
        m: trimmed,
        sf: withCalibration ? scaleFactor : 1,
        u: withCalibration ? unit : 'm',
        cal: withCalibration ? calibrated : false,
        ro: readonly,
      };
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
          Lade den Scan hoch und erzeuge einen Link. Kalibrierung und Ausrichtung werden mitgegeben, damit der Kunde sie
          nicht selbst machen muss — alle anderen Funktionen (messen, zeichnen, exportieren) bleiben verfügbar.
        </p>

        <h3>1 · Scan hochladen (GitHub Release)</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Einmalig: Fine-grained Token mit <b>Contents: Read&nbsp;and&nbsp;write</b> für das Repo. Der Token bleibt nur auf
          diesem Gerät gespeichert und wird nie im Link weitergegeben.
        </p>
        <div className="field-row">
          <div className="field">
            <label>Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="go2dach" />
          </div>
          <div className="field">
            <label>Repo</label>
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Slicer" />
          </div>
          <div className="field">
            <label>Release-Tag</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="scans" />
          </div>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Token (ghp_… / github_pat_…)</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="github_pat_…" />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="active" onClick={upload} disabled={uploading || !sourceFile}>
            {uploading ? `Lädt … ${Math.round(progress * 100)} %` : sourceFile ? `„${sourceFile.name}“ hochladen` : 'Kein Scan geladen'}
          </button>
        </div>
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
          <button onClick={refreshAssets} disabled={listBusy}>
            {listBusy ? 'Lädt …' : 'Hochgeladene Scans anzeigen'}
          </button>
        </div>
        {assets && (
          <div className="card" style={{ marginTop: 8 }}>
            {assets.length === 0 ? (
              <div className="small muted">Noch keine Scans hochgeladen.</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {assets.map((a) => (
                  <li
                    key={a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono small" style={{ wordBreak: 'break-all' }}>{a.name}</div>
                      <div className="small muted">{fmtSize(a.size)}</div>
                    </div>
                    <button onClick={() => setModelUrl(a.browser_download_url)} title="Diese Datei für den Link verwenden">
                      Verwenden
                    </button>
                    <button className="danger" onClick={() => removeAsset(a)} disabled={deleting === a.id}>
                      {deleting === a.id ? '…' : 'Löschen'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3 style={{ marginTop: 16 }}>2 · Modell-URL</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Wird vom Upload automatisch gefüllt. Du kannst auch eine eigene, öffentlich erreichbare URL eintragen.
        </p>
        <input value={modelUrl} onChange={(e) => setModelUrl(e.target.value)} placeholder="https://…/scan.glb oder models/scan.glb" />

        <h3 style={{ marginTop: 16 }}>3 · Optionen</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={withCalibration} onChange={(e) => setWithCalibration(e.target.checked)} />
          Kalibrierung mitgeben {calibrated ? `(${scaleFactor.toPrecision(4)} ${unit}/Einheit)` : '(noch nicht kalibriert)'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={withAlignment} onChange={(e) => setWithAlignment(e.target.checked)} />
          Ausrichtung mitgeben {alignApplied ? '' : '(noch nicht ausgerichtet)'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={readonly} onChange={(e) => setReadonly(e.target.checked)} />
          Nur ansehen + messen (kein Bearbeiten)
        </label>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Zugangscode für den Kunden (optional)</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="z. B. 4-stelliger PIN" inputMode="numeric" />
          <span className="small muted">
            Einfache Zugangshürde (clientseitig), kein harter Schutz — die Modell-URL steckt technisch im Link.
          </span>
        </div>

        <h3 style={{ marginTop: 16 }}>4 · Link erzeugen</h3>
        <div className="row">
          <button className="active" onClick={buildLink} disabled={!modelUrl.trim() || building}>
            {building ? 'Erzeuge …' : 'Link erzeugen'}
          </button>
        </div>
        {link && (
          <div className="row" style={{ marginTop: 10 }}>
            <input className="mono small" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="active" onClick={() => copy(link, 'link')}>
              {copied === 'link' ? '✓ Kopiert' : 'Kopieren'}
            </button>
          </div>
        )}

        <div className="actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
