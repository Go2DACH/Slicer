import type { Vec3 } from '../types';

/**
 * Compact "share setup" baked into a link so the recipient opens a scan that is
 * already calibrated and aligned. Encoded as a base64url JSON blob in ?s=.
 */
export interface ShareSetup {
  /** Model URL (relative to the app base, or absolute). */
  m: string;
  /** Optional MTL url for OBJ sets. */
  mtl?: string;
  /** Calibration scale factor (raw -> display unit). */
  sf: number;
  /** Display unit label. */
  u: string;
  /** Whether calibration was set. */
  cal: boolean;
  /** Alignment quaternion (x,y,z,w), if aligned. */
  q?: [number, number, number, number];
  /** Alignment offset, if aligned. */
  o?: Vec3;
  /** Read-only (true = only view + measure). */
  ro: boolean;
  /** Viewer mode: minimal UI — only orbit, walkthrough and measuring. */
  v?: boolean;
  /** SHA-256 hex of the access PIN, if set. */
  p?: string;
}

function toB64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(b: string): string {
  const s = b.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(s)));
}

export function encodeShare(setup: ShareSetup): string {
  return toB64url(JSON.stringify(setup));
}

export function decodeShare(blob: string): ShareSetup | null {
  try {
    const obj = JSON.parse(fromB64url(blob));
    if (obj && typeof obj.m === 'string') return obj as ShareSetup;
  } catch {
    /* malformed */
  }
  return null;
}

/** SHA-256 hex digest (for the soft PIN gate). */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
