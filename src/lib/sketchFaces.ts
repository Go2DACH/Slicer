import type { Vec3, SketchLine } from '../types';

/**
 * Detect closed faces from a set of 2D sketch lines on the floor plane (XZ).
 *
 * Endpoints that coincide (within `eps`) are treated as the same vertex. A
 * connected group of lines forms a face when every vertex has exactly two
 * incident edges and the edge count equals the vertex count — i.e. it is a
 * single simple loop. The loop is traced into an ordered polygon ring. Open
 * chains and more complex graphs (a vertex with three+ edges) yield no face.
 */
export function detectSketchFaces(lines: SketchLine[], eps = 1e-5): Vec3[][] {
  if (lines.length < 3) return [];

  const nodes: Vec3[] = [];
  const keyOf = (p: Vec3): number => {
    for (let i = 0; i < nodes.length; i++) {
      if (Math.hypot(nodes[i][0] - p[0], nodes[i][2] - p[2]) < eps) return i;
    }
    nodes.push([p[0], 0, p[2]]);
    return nodes.length - 1;
  };

  const adj = new Map<number, Set<number>>();
  const setOf = (n: number): Set<number> => {
    let s = adj.get(n);
    if (!s) {
      s = new Set();
      adj.set(n, s);
    }
    return s;
  };
  for (const l of lines) {
    const a = keyOf(l.a);
    const b = keyOf(l.b);
    if (a === b) continue;
    setOf(a).add(b);
    setOf(b).add(a);
  }

  const seen = new Set<number>();
  const faces: Vec3[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    // Collect the connected component.
    const comp: number[] = [];
    const stack = [start];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      comp.push(n);
      for (const m of adj.get(n)!) if (!seen.has(m)) stack.push(m);
    }
    if (comp.length < 3) continue;
    let edgeCount = 0;
    for (const n of comp) edgeCount += adj.get(n)!.size;
    edgeCount /= 2;
    const allDeg2 = comp.every((n) => adj.get(n)!.size === 2);
    if (!allDeg2 || edgeCount !== comp.length) continue;

    // Trace the single cycle into an ordered ring.
    const ring: number[] = [];
    let prev = -1;
    let cur = comp[0];
    do {
      ring.push(cur);
      const nbrs = [...adj.get(cur)!];
      const next = nbrs.find((x) => x !== prev) ?? nbrs[0];
      prev = cur;
      cur = next;
    } while (cur !== comp[0] && ring.length <= comp.length);
    if (ring.length === comp.length) faces.push(ring.map((i) => nodes[i]));
  }
  return faces;
}
