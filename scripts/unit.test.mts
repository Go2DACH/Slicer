// Pure-logic unit tests. Run with: node --experimental-strip-types scripts/unit.test.mts
import assert from 'node:assert';
import {
  rawDistance,
  rawPolylineLength,
  rawPolygonArea,
  snapAngleXZ,
  nearestPointOnSegmentXZ,
} from '../src/lib/geometry.ts';
import { formatLength, formatArea, unitPresetScale } from '../src/lib/units.ts';
import { buildFloorPlanDxf, buildSketchDxf } from '../src/lib/dxf.ts';
import { detectSketchFaces } from '../src/lib/sketchFaces.ts';
import type { Wall, Opening, SketchLine, SketchCircle } from '../src/types.ts';

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

// DXF property boundary -> GRUNDSTUECK layer + closed polyline
const boundary: [number, number, number][] = [[0, 0, 0], [10, 0, 0], [10, 0, 8], [0, 0, 8]];
const dxfB = buildFloorPlanDxf(walls, openings, 1, { boundary });
ok('dxf has GRUNDSTUECK layer', dxfB.includes('GRUNDSTUECK'));
ok('dxf without boundary omits GRUNDSTUECK polyline', !buildFloorPlanDxf(walls, openings, 1).includes('\n8\nGRUNDSTUECK\n'));

// 2D sketch DXF: line + circle, scaled
const sketchLines: SketchLine[] = [{ id: 'l1', a: [0, 0, 0], b: [2, 0, 0] }];
const sketchCircles: SketchCircle[] = [{ id: 'c1', center: [1, 0, 1], r: 0.5 }];
const sdxf = buildSketchDxf(sketchLines, sketchCircles, 1, 'm');
ok('sketch dxf has LINE', sdxf.includes('LINE'));
ok('sketch dxf has CIRCLE', sdxf.includes('CIRCLE'));
ok('sketch dxf has SKETCH layer', sdxf.includes('SKETCH'));
ok('sketch dxf ends with EOF', sdxf.trim().endsWith('EOF'));
// scaled radius: scaleFactor 2 -> r 0.5 becomes 1.0
const sdxf2 = buildSketchDxf([], sketchCircles, 2, 'm');
ok('sketch dxf scaled radius = 1', sdxf2.includes('\n40\n1\n'));

// nearest point on segment (basis for edge snapping)
const np = nearestPointOnSegmentXZ([2, 0, 1], [0, 0, 0], [4, 0, 0]);
ok('nearestPointOnSegment foot', Math.abs(np.point[0] - 2) < 1e-9 && Math.abs(np.point[2]) < 1e-9 && Math.abs(np.dist - 1) < 1e-9);
const np2 = nearestPointOnSegmentXZ([-1, 0, 0], [0, 0, 0], [4, 0, 0]);
ok('nearestPointOnSegment clamps to endpoint', Math.abs(np2.point[0]) < 1e-9 && Math.abs(np2.dist - 1) < 1e-9);

// face detection from closed line loops
const square: SketchLine[] = [
  { id: 's1', a: [0, 0, 0], b: [2, 0, 0] },
  { id: 's2', a: [2, 0, 0], b: [2, 0, 2] },
  { id: 's3', a: [2, 0, 2], b: [0, 0, 2] },
  { id: 's4', a: [0, 0, 2], b: [0, 0, 0] },
];
const facesSquare = detectSketchFaces(square);
ok('detects one face from closed square', facesSquare.length === 1);
ok('square face has 4 vertices', facesSquare[0]?.length === 4);

// open chain (no closing edge) -> no face
const openChain: SketchLine[] = [
  { id: 'o1', a: [0, 0, 0], b: [2, 0, 0] },
  { id: 'o2', a: [2, 0, 0], b: [2, 0, 2] },
  { id: 'o3', a: [2, 0, 2], b: [0, 0, 2] },
];
ok('open chain yields no face', detectSketchFaces(openChain).length === 0);

// two separate triangles -> two faces
const twoTris: SketchLine[] = [
  { id: 'a1', a: [0, 0, 0], b: [1, 0, 0] },
  { id: 'a2', a: [1, 0, 0], b: [0, 0, 1] },
  { id: 'a3', a: [0, 0, 1], b: [0, 0, 0] },
  { id: 'b1', a: [5, 0, 0], b: [6, 0, 0] },
  { id: 'b2', a: [6, 0, 0], b: [5, 0, 1] },
  { id: 'b3', a: [5, 0, 1], b: [5, 0, 0] },
];
ok('two separate loops yield two faces', detectSketchFaces(twoTris).length === 2);

// a loop with an extra dangling line (degree-3 vertex) -> not a clean face
const dangling: SketchLine[] = [...square, { id: 'x', a: [0, 0, 0], b: [-1, 0, 0] }];
ok('loop with dangling edge yields no face', detectSketchFaces(dangling).length === 0);

console.log(`\n${passed} assertions passed.`);
