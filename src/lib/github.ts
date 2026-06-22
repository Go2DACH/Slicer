/**
 * Store shared scans in the owner's GitHub repo and serve them CORS-friendly.
 *
 * Why not GitHub Releases? Release-asset uploads (uploads.github.com) and their
 * downloads (objects.githubusercontent.com) do NOT send CORS headers, so neither
 * the browser upload nor the customer's model load works from a static site.
 *
 * Instead we commit the file via the Contents API (api.github.com — CORS-enabled)
 * to a dedicated branch, and hand out a raw.githubusercontent.com URL, which does
 * send `Access-Control-Allow-Origin: *`. The owner stores a fine-grained token
 * (Contents: Read and write) once on this device; customers need nothing.
 */

/** Fixed storage target — not shown in the UI. */
export const SCAN_OWNER = 'Go2DACH';
export const SCAN_REPO = 'Slicer';
export const SCAN_BRANCH = 'scan-assets';
const SCAN_DIR = 'scans';

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

const CFG_KEY = 'slicer.github.cfg';

/** Only the token is persisted; owner/repo/branch come from the constants. */
export function loadToken(): string {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY) || '{}').token ?? '';
  } catch {
    return '';
  }
}

export function saveToken(token: string) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ token }));
}

export function clearToken() {
  localStorage.removeItem(CFG_KEY);
}

export function configFor(token: string): GithubConfig {
  return { owner: SCAN_OWNER, repo: SCAN_REPO, branch: SCAN_BRANCH, token: token.trim() };
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
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

const sanitize = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '_');

const rawUrl = (cfg: GithubConfig, path: string) =>
  `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}`;

/** Read a File as base64 (no data: prefix) for the Contents API. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    r.readAsDataURL(file);
  });
}

/** Make sure the storage branch exists, creating it from the default branch. */
async function ensureBranch(cfg: GithubConfig): Promise<void> {
  const base = `${API}/repos/${cfg.owner}/${cfg.repo}`;
  const res = await fetch(`${base}/git/ref/heads/${cfg.branch}`, {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.ok) return;
  if (res.status !== 404) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const repoInfo = await ghJson(base, cfg.token);
  const def = repoInfo.default_branch as string;
  const ref = await ghJson(`${base}/git/ref/heads/${def}`, cfg.token);
  await ghJson(`${base}/git/refs`, cfg.token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${cfg.branch}`, sha: ref.object.sha }),
  });
}

/**
 * Upload `file` by committing it to the storage branch. Returns the public,
 * CORS-enabled raw URL. `onProgress` reports coarse 0..1 stages (the Contents
 * API has no streaming upload progress).
 */
export async function uploadScan(file: File, cfg: GithubConfig, onProgress?: (f: number) => void): Promise<string> {
  onProgress?.(0.05);
  await ensureBranch(cfg);
  onProgress?.(0.2);
  const content = await fileToBase64(file);
  onProgress?.(0.45);
  const path = `${SCAN_DIR}/${Date.now()}-${sanitize(file.name)}`;
  await ghJson(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`, cfg.token, {
    method: 'PUT',
    body: JSON.stringify({ message: `scan: ${file.name}`, content, branch: cfg.branch }),
  });
  onProgress?.(1);
  return rawUrl(cfg, path);
}

export interface ScanFile {
  name: string;
  sha: string;
  size: number;
  url: string;
}

/** List uploaded scans (newest first). */
export async function listScans(cfg: GithubConfig): Promise<ScanFile[]> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${SCAN_DIR}?ref=${cfg.branch}`, {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return []; // branch or folder not created yet
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const arr = (await res.json()) as { name: string; sha: string; size: number }[];
  return arr
    .filter((f) => f.name)
    .map((f) => ({ name: f.name, sha: f.sha, size: f.size, url: rawUrl(cfg, `${SCAN_DIR}/${f.name}`) }))
    .sort((a, b) => (a.name < b.name ? 1 : -1));
}

/** Delete an uploaded scan by path + blob sha. */
export async function deleteScan(cfg: GithubConfig, name: string, sha: string): Promise<void> {
  await ghJson(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(`${SCAN_DIR}/${name}`)}`, cfg.token, {
    method: 'DELETE',
    body: JSON.stringify({ message: `delete scan: ${name}`, sha, branch: cfg.branch }),
  });
}

/** Validate a token by hitting an authenticated endpoint. */
export async function verifyToken(token: string): Promise<boolean> {
  const res = await fetch(`${API}/repos/${SCAN_OWNER}/${SCAN_REPO}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  return res.ok;
}
