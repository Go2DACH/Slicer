import type { Wall, Opening } from '../types';

/**
 * Minimal AutoCAD R12 (AC1009) ASCII DXF writer.
 * R12 is the most widely supported DXF flavor; we emit LINE, POLYLINE and TEXT
 * entities which every CAD program reads. Coordinates are mapped from the
 * world floor plane: DXF X = world X, DXF Y = -world Z (so the plan appears
 * upright). All lengths are multiplied by the calibration scale factor so the
 * file is dimensionally correct in real units.
 */

type P2 = [number, number];

class DxfBuilder {
  private lines: string[] = [];

  private push(code: number, value: string | number) {
    this.lines.push(String(code));
    this.lines.push(String(value));
  }

  line(layer: string, a: P2, b: P2) {
    this.push(0, 'LINE');
    this.push(8, layer);
    this.push(10, a[0]);
    this.push(20, a[1]);
    this.push(30, 0);
    this.push(11, b[0]);
    this.push(21, b[1]);
    this.push(31, 0);
  }

  polyline(layer: string, pts: P2[], closed: boolean) {
    this.push(0, 'POLYLINE');
    this.push(8, layer);
    this.push(66, 1); // vertices follow
    this.push(70, closed ? 1 : 0);
    for (const p of pts) {
      this.push(0, 'VERTEX');
      this.push(8, layer);
      this.push(10, p[0]);
      this.push(20, p[1]);
      this.push(30, 0);
    }
    this.push(0, 'SEQEND');
  }

  text(layer: string, at: P2, height: number, content: string, rotationDeg = 0) {
    this.push(0, 'TEXT');
    this.push(8, layer);
    this.push(10, at[0]);
    this.push(20, at[1]);
    this.push(30, 0);
    this.push(40, height);
    this.push(1, content);
    if (rotationDeg) this.push(50, rotationDeg);
  }

  toString(layers: { name: string; color: number }[]): string {
    const head: string[] = [];
    const out = (code: number, value: string | number) => {
      head.push(String(code));
      head.push(String(value));
    };
    out(0, 'SECTION');
    out(2, 'HEADER');
    out(9, '$ACADVER');
    out(1, 'AC1009');
    out(9, '$INSUNITS');
    out(70, 6); // meters
    out(0, 'ENDSEC');

    out(0, 'SECTION');
    out(2, 'TABLES');
    out(0, 'TABLE');
    out(2, 'LAYER');
    out(70, layers.length);
    for (const l of layers) {
      out(0, 'LAYER');
      out(2, l.name);
      out(70, 0);
      out(62, l.color);
      out(6, 'CONTINUOUS');
    }
    out(0, 'ENDTAB');
    out(0, 'ENDSEC');

    out(0, 'SECTION');
    out(2, 'ENTITIES');

    return [...head, ...this.lines, '0', 'ENDSEC', '0', 'EOF'].join('\n');
  }
}

const LAYERS = [
  { name: 'WALLS', color: 7 }, // white/black
  { name: 'WALLS_CENTER', color: 8 }, // gray
  { name: 'OPENINGS', color: 1 }, // red
  { name: 'DIMS', color: 3 }, // green
];

/** Map world (x, z) → DXF (x, y) in real units. */
const mapPoint = (x: number, z: number, s: number): P2 => [x * s, -z * s];

export function buildFloorPlanDxf(
  walls: Wall[],
  openings: Opening[],
  scaleFactor: number,
  options: { includeDims: boolean } = { includeDims: true },
): string {
  const dxf = new DxfBuilder();
  const s = scaleFactor;

  for (const wall of walls) {
    const sx = wall.start[0];
    const sz = wall.start[2];
    const ex = wall.end[0];
    const ez = wall.end[2];
    // direction & perpendicular on world XZ
    const dx = ex - sx;
    const dz = ez - sz;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    // perpendicular (XZ)
    const px = -uz;
    const pz = ux;
    const half = wall.thickness / 2 / s; // thickness is already real; convert to raw for mapping consistency
    // We map raw world coords by s, and thickness is real, so offset in raw = thickness/2 / s.
    const a = mapPoint(sx + px * half, sz + pz * half, s);
    const b = mapPoint(ex + px * half, ez + pz * half, s);
    const c = mapPoint(ex - px * half, ez - pz * half, s);
    const d = mapPoint(sx - px * half, sz - pz * half, s);
    dxf.polyline('WALLS', [a, b, c, d], true);

    // centerline
    dxf.line('WALLS_CENTER', mapPoint(sx, sz, s), mapPoint(ex, ez, s));

    if (options.includeDims) {
      const realLen = len * s;
      const mid = mapPoint((sx + ex) / 2, (sz + ez) / 2, s);
      const rot = (Math.atan2(-pz, ux) * 180) / Math.PI;
      dxf.text('DIMS', [mid[0], mid[1]], 0.15 * Math.max(s, 0.001) || 0.15, `${realLen.toFixed(2)} m`, rot);
    }

    // openings on this wall
    for (const o of openings.filter((op) => op.wallId === wall.id)) {
      const cxRaw = sx + ux * (o.t * len);
      const czRaw = sz + uz * (o.t * len);
      const halfWRaw = o.width / 2 / s;
      const oa = mapPoint(cxRaw - ux * halfWRaw + px * half, czRaw - uz * halfWRaw + pz * half, s);
      const ob = mapPoint(cxRaw + ux * halfWRaw + px * half, czRaw + uz * halfWRaw + pz * half, s);
      const oc = mapPoint(cxRaw + ux * halfWRaw - px * half, czRaw + uz * halfWRaw - pz * half, s);
      const od = mapPoint(cxRaw - ux * halfWRaw - px * half, czRaw - uz * halfWRaw - pz * half, s);
      dxf.polyline('OPENINGS', [oa, ob, oc, od], true);
      const center = mapPoint(cxRaw, czRaw, s);
      dxf.text('OPENINGS', [center[0], center[1]], 0.12, o.type === 'door' ? 'TUER' : 'FENSTER');
    }
  }

  return dxf.toString(LAYERS);
}
