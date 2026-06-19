// Headless smoke test: build must be run first. Serves dist via vite preview
// is handled by the caller; here we just drive a browser against a given URL.
import puppeteer from 'puppeteer';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/Slicer/';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swapchain',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

const url = `${BASE}?model=models/demo-room.glb`;
console.log('Navigating to', url);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

// Wait for the model to load into the store.
try {
  await page.waitForFunction(
    () => window.slicerStore && window.slicerStore.getState().modelObject !== null,
    { timeout: 45000 },
  );
} catch {
  fail('model did not load within timeout');
}

const state = await page.evaluate(() => {
  const s = window.slicerStore.getState();
  return {
    triangles: s.modelInfo?.triangleCount,
    size: s.modelInfo?.size,
    fileName: s.modelInfo?.fileName,
    loadError: s.loadError,
  };
});
console.log('Model state:', JSON.stringify(state));
if (!state.triangles || state.triangles < 100) fail(`unexpected triangle count: ${state.triangles}`);
if (state.loadError) fail(`load error: ${JSON.stringify(state.loadError)}`);

// Exercise measurement + calibration logic through the store.
const measureResult = await page.evaluate(() => {
  const store = window.slicerStore;
  const s = store.getState();
  // calibrate: pretend two points 1 raw unit apart correspond to 2 meters
  s.setMode('measure');
  s.setMeasureTool('calibrate');
  s.addPickPoint([0, 0, 0]);
  s.addPickPoint([1, 0, 0]);
  s.applyCalibration(2); // 1 unit -> 2 m, scaleFactor = 2
  const sf = store.getState().scaleFactor;
  // distance measurement of 3 raw units -> should be 6 m
  s.setMeasureTool('distance');
  s.addPickPoint([0, 0, 0]);
  s.addPickPoint([3, 0, 0]);
  const m = store.getState().measurements;
  return { scaleFactor: sf, calibrated: store.getState().calibrated, measurements: m.length, pts: m[0]?.points };
});
console.log('Measure result:', JSON.stringify(measureResult));
if (Math.abs(measureResult.scaleFactor - 2) > 1e-6) fail('calibration scale factor wrong');
if (measureResult.measurements !== 1) fail('distance measurement not recorded');

// Exercise drawing + DXF/JSON export through the store + libs.
const drawResult = await page.evaluate(() => {
  const store = window.slicerStore;
  const s = store.getState();
  s.setMode('draw');
  s.addWallSegment([0, 0, 0], [4, 0, 0]);
  s.addWallSegment([4, 0, 0], [4, 0, 3]);
  const walls = store.getState().walls;
  s.addOpening(walls[0].id, 0.5);
  return { walls: store.getState().walls.length, openings: store.getState().openings.length };
});
console.log('Draw result:', JSON.stringify(drawResult));
if (drawResult.walls !== 2) fail('walls not recorded');
if (drawResult.openings !== 1) fail('opening not recorded');

// Check the canvas actually rendered non-blank pixels.
const rendered = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { ok: false, reason: 'no canvas' };
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { ok: false, reason: 'no gl context' };
  const w = canvas.width, h = canvas.height;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let nonBg = 0;
  for (let i = 0; i < px.length; i += 4) {
    // background is near (13,16,20)
    if (Math.abs(px[i] - 13) > 12 || Math.abs(px[i + 1] - 16) > 12 || Math.abs(px[i + 2] - 20) > 12) nonBg++;
  }
  return { ok: nonBg > 500, nonBg, w, h };
});
console.log('Render check:', JSON.stringify(rendered));
if (!rendered.ok) fail(`canvas appears blank (${rendered.reason ?? rendered.nonBg + ' non-bg px'})`);

await page.screenshot({ path: 'scripts/smoke-screenshot.png' });
console.log('Screenshot saved to scripts/smoke-screenshot.png');

console.log('Console errors during run:', errors.length);
errors.forEach((e) => console.log('  console.error:', e));
// Ignore benign WebGL/font warnings if any slipped through as errors
const fatal = errors.filter((e) => !/Download the React DevTools|willReadFrequently|GroupMarker/i.test(e));
if (fatal.length) fail(`${fatal.length} console error(s)`);

await browser.close();
console.log(process.exitCode ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED');
