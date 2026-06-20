// Headless test: drawing a closed area in the 2D sketch must produce a face and
// the real STL export must yield a valid, correctly-dimensioned mesh (mm).
// Build the app and serve dist via `vite preview` before running.
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

await page.goto(`${BASE}?model=models/demo-room.glb`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => window.slicerStore && window.slicerStore.getState().modelObject !== null, {
  timeout: 45000,
});

// Calibrate 1 raw unit = 1 m, then draw a closed 0.1 x 0.1 m square area.
await page.evaluate(() => {
  const store = window.slicerStore;
  const s = store.getState();
  s.setMode('measure');
  s.setMeasureTool('calibrate');
  s.addPickPoint([0, 0, 0]);
  s.addPickPoint([1, 0, 0]);
  s.applyCalibration(1);

  s.setMode('draw');
  s.setDrawKind('sketch2d');
  s.setSketchTool('area');
  const add = (x, z) => store.getState().addSketchPoint([x, 0, z]);
  add(0, 0);
  add(0.1, 0);
  add(0.1, 0.1);
  add(0, 0.1);
  add(0, 0); // close onto first point
});

const lines = await page.evaluate(() => window.slicerStore.getState().sketchLines.length);
if (lines !== 4) fail(`expected 4 closing lines, got ${lines}`);

// Capture the real STL produced by the export button (hook object URL creation).
const stl = await page.evaluate(async () => {
  window.__blob = null;
  const orig = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    window.__blob = blob;
    return orig.call(URL, blob);
  };
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('STL exportieren'));
  if (!btn) return { error: 'export button not found' };
  if (btn.disabled) return { error: 'export button disabled (no face detected)' };
  btn.click();
  await new Promise((r) => setTimeout(r, 50));
  URL.createObjectURL = orig;
  if (!window.__blob) return { error: 'no blob captured' };
  return { text: await window.__blob.text() };
});

if (stl.error) fail(stl.error);
const text = stl.text ?? '';

// Parse ASCII STL vertices.
const verts = [...text.matchAll(/vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/g)].map((m) => [
  parseFloat(m[1]),
  parseFloat(m[2]),
  parseFloat(m[3]),
]);
const facets = (text.match(/facet normal/g) || []).length;
const bbox = verts.reduce(
  (a, v) => ({
    minx: Math.min(a.minx, v[0]), maxx: Math.max(a.maxx, v[0]),
    miny: Math.min(a.miny, v[1]), maxy: Math.max(a.maxy, v[1]),
    minz: Math.min(a.minz, v[2]), maxz: Math.max(a.maxz, v[2]),
  }),
  { minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9, minz: 1e9, maxz: -1e9 },
);
console.log('STL facets:', facets, 'verts:', verts.length, 'bbox:', JSON.stringify(bbox));

if (!text.startsWith('solid')) fail('not an ASCII STL');
if (facets < 8) fail(`too few facets for an extruded box: ${facets}`); // 2 caps*2 + 4 sides*2 = 12
if (Math.abs(bbox.maxx - bbox.minx - 100) > 0.5) fail(`width should be 100 mm, got ${bbox.maxx - bbox.minx}`);
if (Math.abs(bbox.maxy - bbox.miny - 100) > 0.5) fail(`depth should be 100 mm, got ${bbox.maxy - bbox.miny}`);
if (Math.abs(bbox.maxz - bbox.minz - 1) > 1e-3) fail(`height should be 1 mm, got ${bbox.maxz - bbox.minz}`);

const fatal = errors.filter((e) => !/DevTools|willReadFrequently|GroupMarker/i.test(e));
if (fatal.length) {
  fatal.forEach((e) => console.log('  console.error:', e));
  fail(`${fatal.length} console error(s)`);
}

await browser.close();
console.log(process.exitCode ? 'STL TEST FAILED' : 'STL TEST PASSED');
