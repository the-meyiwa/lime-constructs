import type { Cam, Unit, Wall } from './types';
import { FLOOR, TYPE, shellG } from './data';

export type P3 = [number, number, number];
export type P2 = { x: number; y: number; d: number };
export type ScreenPoly = number[][];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

let PIVOT: P3 = [0, 0, 0];
let FIT = 1;

export function setView(pivot: P3, fit: number) {
  PIVOT = pivot;
  FIT = fit;
}

export function project(p: P3, cam: Cam, w: number, h: number): P2 {
  const x = p[0] - PIVOT[0];
  const y = p[1] - PIVOT[1];
  const z = p[2] - PIVOT[2];
  const ca = Math.cos(cam.az);
  const sa = Math.sin(cam.az);
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  const xc = x * ca - z * sa;
  const zc = x * ce * sa + y * se + z * ce * ca;
  const yc = -x * se * sa + y * ce - z * se * ca;
  const depth = Math.max(cam.dist - zc, 0.5);
  const f = Math.min(w, h) * 1.2;
  const s = (f / depth) * FIT;
  return { x: w / 2 + xc * s, y: h / 2 - yc * s + h * 0.04, d: depth };
}

const LIGHT: P3 = (() => {
  const v: P3 = [-0.42, 0.82, 0.38];
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
})();

function normalVisible(n: P3, cam: Cam) {
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  const v = [ce * Math.sin(cam.az), se, ce * Math.cos(cam.az)];
  return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 0;
}

function shade(base: number, n: P3, lift = 0) {
  const dot = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const v = clamp(0.1 + base * (0.56 + 0.55 * dot) + lift, 0, 1);
  const g = Math.round(v * 255);
  const b = Math.round(clamp(v + 0.015, 0, 1) * 255);
  return 'rgb(' + g + ',' + g + ',' + b + ')';
}

export type Face = {
  key: string;
  unit: string;
  pts: number[][];
  fill: string;
  stroke: string;
  depth: number;
  hidden?: boolean;
  line?: number;
};

export function unitBox(u: Unit) {
  const t = TYPE[u.type];
  const y0 = u.level * FLOOR;
  const L = u.rot ? t.wid : t.len;
  const W = u.rot ? t.len : t.wid;
  return { x0: u.x, z0: u.z, y0, L, W, H: t.hgt };
}

function q(key: string, unit: string, pts: P3[], n: P3, base: number, cam: Cam, w: number, h: number) {
  const proj = pts.map((p) => project(p, cam, w, h));
  const depth = proj.reduce((a, p) => a + p.d, 0) / proj.length;
  return {
    key,
    unit,
    pts: proj.map((p) => [p.x, p.y]),
    fill: shade(base, n),
    stroke: 'rgba(255,255,255,0.09)',
    depth,
    hidden: !normalVisible(n, cam),
  } as Face;
}

export function splitWall(w: number, h: number, holes: [number, number, number, number][]) {
  let rects: [number, number, number, number][] = [[0, 0, w, h]];
  for (const hole of holes) {
    const [hu0, hv0, hu1, hv1] = hole;
    const next: [number, number, number, number][] = [];
    for (const [u0, v0, u1, v1] of rects) {
      if (hu1 <= u0 || hu0 >= u1 || hv1 <= v0 || hv0 >= v1) {
        next.push([u0, v0, u1, v1]);
        continue;
      }
      if (hv0 > v0) next.push([u0, v0, u1, Math.min(hv0, v1)]);
      if (hv1 < v1) next.push([u0, Math.max(hv1, v0), u1, v1]);
      const mv0 = Math.max(v0, hv0);
      const mv1 = Math.min(v1, hv1);
      if (hu0 > u0) next.push([u0, mv0, Math.min(hu0, u1), mv1]);
      if (hu1 < u1) next.push([Math.max(hu1, u0), mv0, u1, mv1]);
    }
    rects = next;
  }
  return rects.filter(([a, b, cc, d]) => cc - a > 0.02 && d - b > 0.02);
}

const WALLS: { id: Wall; n: P3 }[] = [
  { id: 'front', n: [1, 0, 0] },
  { id: 'back', n: [-1, 0, 0] },
  { id: 'left', n: [0, 0, -1] },
  { id: 'right', n: [0, 0, 1] },
];

export function wallPoint(id: Wall, u: number, v: number, box: ReturnType<typeof unitBox>): P3 {
  const { x0, z0, y0, L, W } = box;
  if (id === 'front') return [x0 + L, y0 + v, z0 + u];
  if (id === 'back') return [x0, y0 + v, z0 + u];
  if (id === 'left') return [x0 + u, y0 + v, z0];
  return [x0 + u, y0 + v, z0 + W];
}

function wallLen(id: Wall, box: ReturnType<typeof unitBox>) {
  return id === 'front' || id === 'back' ? box.W : box.L;
}

export function buildScene(units: Unit[], cam: Cam, w: number, h: number, selected: string | null) {
  const faces: Face[] = [];

  for (const u of units) {
    const box = unitBox(u);
    const base = shellG(u.color);
    const sel = u.id === selected;

    for (const wall of WALLS) {
      const len = wallLen(wall.id, box);
      const holes = u.openings
        .filter((o) => o.wall === wall.id)
        .map((o) => [o.along - o.w / 2, o.sill, o.along + o.w / 2, o.sill + o.h] as [number, number, number, number]);

      for (const [u0, v0, u1, v1] of splitWall(len, box.H, holes)) {
        faces.push(
          q(
            u.id + wall.id + u0 + v0,
            u.id,
            [
              wallPoint(wall.id, u0, v0, box),
              wallPoint(wall.id, u1, v0, box),
              wallPoint(wall.id, u1, v1, box),
              wallPoint(wall.id, u0, v1, box),
            ],
            wall.n,
            base,
            cam,
            w,
            h
          )
        );
      }

      for (const o of u.openings.filter((x) => x.wall === wall.id)) {
        const p = 0.012;
        faces.push(
          q(
            u.id + 'glass' + o.id,
            u.id,
            [
              wallPoint(wall.id, o.along - o.w / 2, o.sill, box),
              wallPoint(wall.id, o.along + o.w / 2, o.sill, box),
              wallPoint(wall.id, o.along + o.w / 2, o.sill + o.h, box),
              wallPoint(wall.id, o.along - o.w / 2, o.sill + o.h, box),
            ],
            wall.n,
            o.kind === 'door' ? 0.24 : 0.78,
            cam,
            w,
            h
          )
        );
      }
    }

    const { x0, z0, y0, L, W, H } = box;
    faces.push(
      q(u.id + 'roof', u.id, [[x0, y0 + H, z0], [x0 + L, y0 + H, z0], [x0 + L, y0 + H, z0 + W], [x0, y0 + H, z0 + W]], [0, 1, 0], base * 0.92, cam, w, h),
      q(u.id + 'floor', u.id, [[x0, y0, z0], [x0, y0, z0 + W], [x0 + L, y0, z0 + W], [x0 + L, y0, z0]], [0, -1, 0], base * 0.6, cam, w, h)
    );
  }

  return faces;
}

export function edges(units: Unit[], cam: Cam, w: number, h: number, id: string) {
  const u = units.find((x) => x.id === id);
  if (!u) return [] as number[][][];
  const { x0, z0, y0, L, W, H } = unitBox(u);
  const pts: P2[] = [
    [x0, y0, z0],
    [x0 + L, y0, z0],
    [x0 + L, y0, z0 + W],
    [x0, y0, z0 + W],
    [x0, y0 + H, z0],
    [x0 + L, y0 + H, z0],
    [x0 + L, y0 + H, z0 + W],
    [x0, y0 + H, z0 + W],
  ].map((p) => project(p as P3, cam, w, h));
  const edgesIdx = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return edgesIdx.map(([a, b]) => [[pts[a].x, pts[a].y], [pts[b].x, pts[b].y]]) as ScreenPoly[];
}

export function footprint(u: Unit) {
  const { x0, z0, L, W } = unitBox(u);
  return [
    [x0, z0],
    [x0 + L, z0],
    [x0 + L, z0 + W],
    [x0, z0 + W],
  ];
}

export function detailLines(units: Unit[], cam: Cam, w: number, h: number) {
  const out: { pts: number[][]; stroke: string }[] = [];
  const line = (a: P3, b: P3, stroke: string) => {
    const pa = project(a, cam, w, h);
    const pb = project(b, cam, w, h);
    out.push({ pts: [[pa.x, pa.y], [pb.x, pb.y]], stroke });
  };

  for (const u of units) {
    const box = unitBox(u);
    for (const wall of WALLS) {
      if (!normalVisible(wall.n, cam)) continue;
      const len = wallLen(wall.id, box);
      const side = wall.id === 'left' || wall.id === 'right';
      if (!side) continue;
      const step = 0.6;
      for (let p = 0.3; p < len - 0.2; p += step) {
        const blocked = u.openings.some(
          (o) => o.wall === wall.id && p > o.along - o.w / 2 && p < o.along + o.w / 2
        );
        if (blocked) continue;
        line(wallPoint(wall.id, p, 0.08, box), wallPoint(wall.id, p, box.H - 0.08, box), 'rgba(0,0,0,0.2)');
      }
      line(wallPoint(wall.id, 0.05, box.H - 0.1, box), wallPoint(wall.id, len - 0.05, box.H - 0.1, box), 'rgba(0,0,0,0.26)');
      line(wallPoint(wall.id, 0.05, 0.1, box), wallPoint(wall.id, len - 0.05, 0.1, box), 'rgba(0,0,0,0.26)');
    }
  }
  return out;
}

export function inPoly(pt: number[], poly: number[][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
