/**
 * Upload a scan file to a GitHub Release asset directly from the browser, using
 * a fine-grained token (Contents: Read/Write) that the owner stores once on this
 * device. Customers never need a token — they just open the generated link.
 *
 * The site stays static; the upload goes browser -> GitHub API.
 */

export interface GithubConfig {
  owner: string;
  repo: string;
  tag: string;
  token: string;
}

const CFG_KEY = 'slicer.github.cfg';

export function loadGithubConfig(): Partial<GithubConfig> {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveGithubConfig(cfg: Partial<GithubConfig>) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

const API = 'https://api.github.com';

async function ghJson(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Get the release for `tag`, creating it if it does not exist. Returns id. */
async function ensureRelease(cfg: GithubConfig): Promise<number> {
  const { owner, repo, tag, token } = cfg;
  const res = await fetch(`${API}/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.ok) return (await res.json()).id;
  if (res.status !== 404) {
    throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const created = await ghJson(`${API}/repos/${owner}/${repo}/releases`, token, {
    method: 'POST',
    body: JSON.stringify({ tag_name: tag, name: tag, body: 'Geteilte Scans (Slicer)' }),
  });
  return created.id;
}

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
}

/** List the scan assets currently stored in the share release (newest first). */
export async function listReleaseAssets(cfg: GithubConfig): Promise<ReleaseAsset[]> {
  const { owner, repo, tag, token } = cfg;
  const res = await fetch(`${API}/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return []; // release not created yet
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rel = await res.json();
  const assets: ReleaseAsset[] = (rel.assets ?? []).map((a: ReleaseAsset) => ({
    id: a.id,
    name: a.name,
    size: a.size,
    browser_download_url: a.browser_download_url,
  }));
  return assets.reverse();
}

/** Delete one uploaded scan asset by its id. */
export async function deleteReleaseAsset(cfg: GithubConfig, assetId: number): Promise<void> {
  const { owner, repo, token } = cfg;
  const res = await fetch(`${API}/repos/${owner}/${repo}/releases/assets/${assetId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

const sanitize = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '_');

/**
 * Upload `file` as a release asset. Returns the public download URL.
 * onProgress is called with a 0..1 fraction.
 */
export async function uploadScanToRelease(
  file: File,
  cfg: GithubConfig,
  onProgress?: (f: number) => void,
): Promise<string> {
  const releaseId = await ensureRelease(cfg);
  const name = `${Date.now()}-${sanitize(file.name)}`;
  const url = `https://uploads.github.com/repos/${cfg.owner}/${cfg.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;

  const buf = await file.arrayBuffer();
  const asset = await new Promise<{ browser_download_url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${cfg.token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Antwort von GitHub nicht lesbar.'));
        }
      } else {
        reject(new Error(`GitHub Upload ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
      }
    };
    xhr.onerror = () => reject(new Error('Netzwerkfehler beim Upload.'));
    xhr.send(buf);
  });
  return asset.browser_download_url;
}
