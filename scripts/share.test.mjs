// Headless test: a ?s= share link must apply calibration + alignment and gate
// access behind the PIN. Build first, then serve dist via `vite preview`.
import puppeteer from 'puppeteer';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/Slicer/';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

// Open the app once to build a share blob (needs crypto.subtle for the PIN hash).
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
const shareUrl = await page.evaluate(async (base) => {
  const enc = new TextEncoder().encode('1234');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const pinHash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const setup = {
    m: 'models/demo-room.glb',
    sf: 2,
    u: 'm',
    cal: true,
    q: [0, 0.3826834, 0, 0.9238795], // 45° about Y
    o: [0, 1.5, 0],
    ro: false,
    p: pinHash,
  };
  const blob = btoa(unescape(encodeURIComponent(JSON.stringify(setup))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${base}?s=${blob}`;
}, BASE);

console.log('Opening share link:', shareUrl.slice(0, 80) + '…');
await page.goto(shareUrl, { waitUntil: 'networkidle2', timeout: 60000 });

try {
  await page.waitForFunction(() => window.slicerStore && window.slicerStore.getState().modelObject !== null, {
    timeout: 45000,
  });
} catch {
  fail('shared model did not load');
}

const applied = await page.evaluate(() => {
  const s = window.slicerStore.getState();
  return {
    scaleFactor: s.scaleFactor,
    calibrated: s.calibrated,
    unit: s.unit,
    alignApplied: s.alignApplied,
    q: s.alignQuaternion,
    o: s.alignOffset,
    locked: s.locked,
    readonly: s.readonly,
    pinHash: s.pinHash,
  };
});
console.log('Applied setup:', JSON.stringify(applied));
if (Math.abs(applied.scaleFactor - 2) > 1e-6) fail('calibration not applied');
if (!applied.calibrated) fail('calibrated flag not set');
if (!applied.alignApplied) fail('alignment not applied');
if (Math.abs(applied.q[1] - 0.3826834) > 1e-5) fail('alignment quaternion wrong');
if (Math.abs(applied.o[1] - 1.5) > 1e-6) fail('alignment offset wrong');
if (!applied.locked) fail('PIN gate not active');

// The PIN gate must be visible in the DOM.
const gateVisible = await page.$('.pin-gate');
if (!gateVisible) fail('PinGate not rendered while locked');

// Wrong code keeps it locked.
const wrong = await page.evaluate(async () => {
  const ok = await window.slicerStore.getState().unlock('0000');
  return { ok, locked: window.slicerStore.getState().locked };
});
console.log('Wrong PIN:', JSON.stringify(wrong));
if (wrong.ok || !wrong.locked) fail('wrong PIN unexpectedly unlocked');

// Right code unlocks.
const right = await page.evaluate(async () => {
  const ok = await window.slicerStore.getState().unlock('1234');
  return { ok, locked: window.slicerStore.getState().locked };
});
console.log('Right PIN:', JSON.stringify(right));
if (!right.ok || right.locked) fail('correct PIN did not unlock');

await page.waitForFunction(() => !document.querySelector('.pin-gate'), { timeout: 5000 }).catch(() => {
  fail('PinGate still visible after unlock');
});

const fatal = errors.filter((e) => !/Download the React DevTools|willReadFrequently|GroupMarker/i.test(e));
if (fatal.length) {
  fatal.forEach((e) => console.log('  console.error:', e));
  fail(`${fatal.length} console error(s)`);
}

await browser.close();
console.log(process.exitCode ? 'SHARE TEST FAILED' : 'SHARE TEST PASSED');
