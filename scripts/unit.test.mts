// Pure-logic unit tests. Run with: node --experimental-strip-types scripts/unit.test.mts
import assert from 'node:assert';
import { rawDistance, rawPolylineLength, rawPolygonArea, snapAngleXZ } from '../src/lib/geometry.ts';
import { formatLength, formatArea, unitPresetScale } from '../src/lib/units.ts';
import { buildFloorPlanDxf } from '../src/lib/dxf.ts';
import type { Wall, Opening } from '../src/types.ts';

let passed = 0;
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, name);
  passed++;
  console.log('  ✓', name);
};

// geometry
ok('distance 3-4-5', Math.abs(rawDistance([0, 0, 0], [3, 4, 0]) - 5) < 1e-9);
ok('polyline length', Math.abs(rawPolylineLength([[0, 0, 0], [2, 0, 0], [2, 0, 3]]) - 5) < 1e-9);
ok(
  'square area 2x2 = 4',
  Math.abs(rawPolygonArea([[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]]) - 4) < 1e-9,
);
// angle snap: target near 80 deg should snap to 90 (45-step) -> direction along +z
const snapped = snapAngleXZ([0, 0, 0], [0.1, 0, 1], 45);
ok('angle snap to 90deg', Math.abs(snapped[0]) < 1e-6 && snapped[2] > 0.9);

// units with calibration scaleFactor=2 (1 unit -> 2 m)
ok('formatLength calibrated', formatLength(3, 2, 'm') === '6.00 m');
ok('formatArea calibrated', formatArea(4, 2, 'm') === '16.00 m²'); // 4 units^2 * 2^2 = 16

// unit presets: a 60mm Benchy (raw=60) must read 60 mm, 6 cm, 0.06 m
ok('preset mm->mm', formatLength(60, unitPresetScale('mm', 'mm'), 'mm') === '60.00 mm');
ok('preset mm->cm', formatLength(60, unitPresetScale('mm', 'cm'), 'cm') === '6.00 cm');
ok('preset mm->m', formatLength(60, unitPresetScale('mm', 'm'), 'm') === '0.060 m');
ok('preset in->mm', Math.abs(60 * unitPresetScale('in', 'mm') - 1524) < 1e-6); // 60 in = 1524 mm

// DXF
const walls: Wall[] = [
  { id: 'w1', name: 'Wand 1', start: [0, 0, 0], end: [4, 0, 0], thickness: 0.2, height: 2.5 },
  { id: 'w2', name: 'Wand 2', start: [4, 0, 0], end: [4, 0, 3], thickness: 0.2, height: 2.5 },
];
const openings: Opening[] = [
  { id: 'o1', name: 'Tür 1', type: 'door', wallId: 'w1', t: 0.5, width: 0.9, height: 2, sill: 0 },
];
const dxf = buildFloorPlanDxf(walls, openings, 1, { includeDims: true });
ok('dxf has header', dxf.includes('AC1009'));
ok('dxf has ENTITIES', dxf.includes('ENTITIES'));
ok('dxf has POLYLINE (walls)', dxf.includes('POLYLINE'));
ok('dxf has WALLS layer', dxf.includes('WALLS'));
ok('dxf has OPENINGS layer', dxf.includes('OPENINGS'));
ok('dxf has dim text 4.00', dxf.includes('4.00 m'));
ok('dxf ends with EOF', dxf.trim().endsWith('EOF'));

// DXF with calibration scaleFactor 0.5 -> a 4-unit wall is 2.00 m
const dxf2 = buildFloorPlanDxf(walls, openings, 0.5, { includeDims: true });
ok('dxf scaled dim 2.00', dxf2.includes('2.00 m'));

console.log(`\n${passed} assertions passed.`);
