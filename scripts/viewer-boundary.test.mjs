// Headless test: (1) a viewer share link opens a minimal, measure-only UI;
// (2) drawing a property boundary creates a closed ring and exports to DXF.
// Build + `vite preview` first.
import puppeteer from 'puppeteer';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/Slicer/';
function fail(m) {
  console.error('FAIL:', m);
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

// ---- 1. Viewer share link ----
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
const viewerUrl = await page.evaluate((base) => {
  const setup = { m: 'models/demo-room.glb', sf: 2, u: 'm', cal: true, ro: true, v: true };
  const blob = btoa(unescape(encodeURIComponent(JSON.stringify(setup))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base}?s=${blob}`;
}, BASE);

await page.goto(viewerUrl, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => window.slicerStore && window.slicerStore.getState().modelObject !== null, { timeout: 45000 });

const viewer = await page.evaluate(() => {
  const s = window.slicerStore.getState();
  const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
  const labels = [...document.querySelectorAll('.toolbar *')].map((e) => e.textContent);
  return {
    viewerMode: s.viewerMode,
    readonly: s.readonly,
    scaleFactor: s.scaleFactor,
    hasDateiOeffnen: buttons.some((t) => t.includes('Datei öffnen')),
    hasTeilen: buttons.some((t) => t === 'Teilen'),
    hasAusrichten: buttons.some((t) => t === 'Ausrichten'),
    hasZeichnen: buttons.some((t) => t === 'Zeichnen'),
    hasBegehung: buttons.some((t) => t.includes('Begehung')),
    hasMessen: buttons.some((t) => t === 'Messen'),
    hasViewerBadge: labels.some((t) => t && t.includes('Viewer')),
  };
});
console.log('Viewer:', JSON.stringify(viewer));
if (!viewer.viewerMode) fail('viewerMode not set from link');
if (!viewer.readonly) fail('viewer link not readonly');
if (viewer.hasDateiOeffnen) fail('viewer shows "Datei öffnen"');
if (viewer.hasTeilen) fail('viewer shows "Teilen"');
if (viewer.hasAusrichten || viewer.hasZeichnen) fail('viewer shows editing modes');
if (!viewer.hasBegehung) fail('viewer missing walkthrough');
if (!viewer.hasMessen) fail('viewer missing measure');
if (!viewer.hasViewerBadge) fail('viewer badge missing');

// ---- 2. Property boundary + DXF ----
await page.goto(`${BASE}?model=models/demo-room.glb`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => window.slicerStore && window.slicerStore.getState().modelObject !== null, { timeout: 45000 });

const boundaryState = await page.evaluate(() => {
  const store = window.slicerStore;
  const s = store.getState();
  s.applyCalibration; // noop ref
  s.setMode('draw');
  s.setDrawKind('bim');
  s.setDrawTool('boundary');
  const add = (x, z) => store.getState().addDrawPoint([x, 0, z]);
  add(0, 0);
  add(10, 0);
  add(10, 8);
  add(0, 8);
  add(0, 0); // close
  return { boundary: store.getState().boundary.length, pending: store.getState().pendingBoundary.length };
});
console.log('Boundary:', JSON.stringify(boundaryState));
if (boundaryState.boundary !== 4) fail(`expected 4-point boundary ring, got ${boundaryState.boundary}`);
if (boundaryState.pending !== 0) fail('pending boundary not cleared after closing');

// Export DXF via the export panel and confirm the GRUNDSTUECK layer is present.
const dxf = await page.evaluate(async () => {
  const store = window.slicerStore;
  store.getState().setMode('export');
  await new Promise((r) => setTimeout(r, 60));
  window.__blob = null;
  const orig = URL.createObjectURL;
  URL.createObjectURL = (b) => { window.__blob = b; return orig.call(URL, b); };
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('DXF exportieren'));
  if (!btn) return { error: 'no DXF button' };
  if (btn.disabled) return { error: 'DXF button disabled' };
  btn.click();
  await new Promise((r) => setTimeout(r, 60));
  URL.createObjectURL = orig;
  return { text: window.__blob ? await window.__blob.text() : null };
});
if (dxf.error) fail(dxf.error);
if (!dxf.text || !dxf.text.includes('GRUNDSTUECK')) fail('DXF missing GRUNDSTUECK boundary');
console.log('DXF has GRUNDSTUECK layer:', !!dxf.text?.includes('GRUNDSTUECK'));

const fatal = errors.filter((e) => !/DevTools|willReadFrequently|GroupMarker/i.test(e));
if (fatal.length) {
  fatal.forEach((e) => console.log('  console.error:', e));
  fail(`${fatal.length} console error(s)`);
}

await browser.close();
console.log(process.exitCode ? 'VIEWER/BOUNDARY TEST FAILED' : 'VIEWER/BOUNDARY TEST PASSED');
