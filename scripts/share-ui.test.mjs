// Headless UI test for the reworked ShareDialog: token-connect gating, the
// "connected" state, and ?s= link generation from a manual URL. The actual
// GitHub upload needs a real token and is not exercised here.
import puppeteer from 'puppeteer';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/Slicer/';
function fail(m) {
  console.error('FAIL:', m);
  process.exitCode = 1;
}
const clickByText = async (page, text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.evaluateOnNewDocument(() => localStorage.removeItem('slicer.github.cfg'));
await page.goto(`${BASE}?model=models/demo-room.glb`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => window.slicerStore && window.slicerStore.getState().modelObject !== null, { timeout: 45000 });

// Open share dialog.
if (!(await clickByText(page, 'Teilen'))) fail('no Teilen button');
await new Promise((r) => setTimeout(r, 200));

const notConnected = await page.evaluate(() => {
  const dlg = document.querySelector('.dialog');
  return {
    hasConnect: !!dlg && /Einmal mit GitHub verbinden/.test(dlg.textContent),
    hasPasswordInput: !!document.querySelector('.dialog input[type="password"]'),
    noOwnerField: !/Owner/.test(dlg?.textContent || '') && !/Release-Tag/.test(dlg?.textContent || ''),
  };
});
console.log('Not connected:', JSON.stringify(notConnected));
if (!notConnected.hasConnect) fail('connect prompt missing');
if (!notConnected.hasPasswordInput) fail('token input missing');
if (!notConnected.noOwnerField) fail('owner/repo/tag fields should be hidden');

// Simulate a stored token -> connected state.
await page.evaluate(() => localStorage.setItem('slicer.github.cfg', JSON.stringify({ token: 'github_pat_dummy' })));
await clickByText(page, 'Schließen');
await new Promise((r) => setTimeout(r, 150));
await clickByText(page, 'Teilen');
await new Promise((r) => setTimeout(r, 200));

const connected = await page.evaluate(() => {
  const dlg = document.querySelector('.dialog');
  return {
    isConnected: !!dlg && /Mit GitHub verbunden/.test(dlg.textContent),
    hasUploadSection: !!dlg && /Scan hochladen/.test(dlg.textContent),
  };
});
console.log('Connected:', JSON.stringify(connected));
if (!connected.isConnected) fail('connected state not shown after token stored');
if (!connected.hasUploadSection) fail('upload section missing when connected');

// Expand advanced, type a manual URL, build the link.
await clickByText(page, 'Erweitert');
await new Promise((r) => setTimeout(r, 100));
await page.evaluate(() => {
  const inp = [...document.querySelectorAll('.dialog input')].find((i) => i.placeholder && i.placeholder.includes('scan.glb'));
  if (inp) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'https://example.com/scan.glb');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await new Promise((r) => setTimeout(r, 100));
await clickByText(page, 'Link erzeugen');
await new Promise((r) => setTimeout(r, 250));

const linkOk = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.dialog input')].map((i) => i.value);
  const link = inputs.find((v) => v && v.includes('?s='));
  return { link: link || null };
});
console.log('Link:', linkOk.link ? linkOk.link.slice(0, 70) + '…' : 'none');
if (!linkOk.link) fail('no ?s= link generated');

const fatal = errors.filter((e) => !/DevTools|willReadFrequently|GroupMarker/i.test(e));
if (fatal.length) {
  fatal.forEach((e) => console.log('  console.error:', e));
  fail(`${fatal.length} console error(s)`);
}

await browser.close();
console.log(process.exitCode ? 'SHARE-UI TEST FAILED' : 'SHARE-UI TEST PASSED');
