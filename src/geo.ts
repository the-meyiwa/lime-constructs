import type { Cam, Item, Unit, Wall } from './types';
import { FLOOR, TYPE, shellOf } from './data';
import { FURN } from './furniture';

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

function solve3(M: number[][], b: number[]): [number, number, number] | null {
  const a = M.map((r, i) => [r[0], r[1], r[2], b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-9) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col || a[r][col] === 0) continue;
      const f = a[r][col] / a[col][col];
      for (let k = col; k < 4; k++) a[r][k] -= f * a[col][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/**
 * Inverse of project(): screen point back onto the horizontal plane y = level.
 * Used so a finger can drag a piece across the floor instead of orbiting.
 */
export function unprojectGround(sx: number, sy: number, cam: Cam, w: number, h: number, level: number): [number, number] {
  const ca = Math.cos(cam.az);
  const sa = Math.sin(cam.az);
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  const f0 = Math.min(w, h) * 1.2 * FIT;
  const A = sx - w / 2;
  const B = h / 2 + h * 0.04 - sy;
  const yv = level - PIVOT[1];
  const sol = solve3(
    [
      [ca, -sa, -A],
      [ce * sa, ce * ca, f0],
      [-se * sa, -se * ca, -B],
    ],
    [0, cam.dist - yv * se, -yv * ce]
  );
  if (!sol) return [PIVOT[0], PIVOT[2]];
  return [sol[0] + PIVOT[0], sol[1] + PIVOT[2]];
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

/** afternoon sun, slightly from behind the left shoulder */
const LIGHT: P3 = (() => {
  const v: P3 = [-0.46, 0.8, 0.38];
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
})();
const SKY: P3 = [0.55, 0.64, 0.78];

function toRgb(hex: string): P3 {
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  return [140, 140, 140];
}

/**
 * Lambert plus a cool sky fill. k is a surface factor (corrugation valley,
 * trim, dark moulding); ao darkens recessed geometry.
 */
function shade(hex: string, n: P3, cam: Cam, k = 1, ao = 1) {
  const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const [r0, g0, b0] = toRgb(hex);
  const d = 0.34 + 0.92 * lit;
  const fill = 0.13 * (1 - lit);
  const r = clamp(((r0 / 255) * d * k * ao + SKY[0] * fill) * 255, 0, 255);
  const g = clamp(((g0 / 255) * d * k * ao + SKY[1] * fill) * 255, 0, 255);
  const b = clamp(((b0 / 255) * d * k * ao + SKY[2] * fill) * 255, 0, 255);
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

function normalVisible(n: P3, cam: Cam) {
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  const v = [ce * Math.sin(cam.az), se, ce * Math.cos(cam.az)];
  return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 0;
}

export type Face = {
  key: string;
  unit: string;
  item?: string;
  pts: number[][];
  fill: string;
  stroke: string;
  depth: number;
  hidden?: boolean;
  kind: 'wall' | 'roof' | 'floor' | 'opening' | 'item' | 'trim' | 'lining';
};

type Ctx = {
  out: Face[];
  cam: Cam;
  w: number;
  h: number;
  cut: boolean;
};

function push(
  ctx: Ctx,
  key: string,
  unit: string,
  pts: P3[],
  n: P3,
  hex: string,
  opt: { k?: number; ao?: number; kind?: Face['kind']; stroke?: string; item?: string } = {}
) {
  const proj = pts.map((p) => project(p, ctx.cam, ctx.w, ctx.h));
  const depth = proj.reduce((a, p) => a + p.d, 0) / proj.length;
      ctx.out.push({
        key: key + '#' + ctx.out.length,
        unit,
        item: opt.item,
    pts: proj.map((p) => [p.x, p.y]),
    fill: shade(hex, n, ctx.cam, opt.k ?? 1, opt.ao ?? 1),
    stroke: opt.stroke ?? 'none',
    depth,
    kind: opt.kind ?? 'wall',
  });
}

/** six-sided box, back faces culled */
function solid(
  ctx: Ctx,
  key: string,
  unit: string,
  bb: [number, number, number, number, number, number],
  hex: string,
  opt: { k?: number; kind?: Face['kind']; item?: string; ao?: number } = {}
) {
  const [x0, y0, z0, x1, y1, z1] = bb;
  boxFaces(ctx, key, unit, x0, y0, z0, x1, y1, z1, (n) => hex, opt);
}

function boxFaces(
  ctx: Ctx,
  key: string,
  unit: string,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  hexOf: (n: P3) => string,
  opt: { k?: number; kind?: Face['kind']; item?: string; ao?: number } = {}
) {
  const faces: { n: P3; pts: P3[] }[] = [
    { n: [1, 0, 0], pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]] },
    { n: [-1, 0, 0], pts: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]] },
    { n: [0, 0, 1], pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { n: [0, 0, -1], pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    { n: [0, 1, 0], pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
  ];
  faces.forEach((f, i) => {
    if (!normalVisible(f.n, ctx.cam)) return;
    push(ctx, key + i, unit, f.pts, f.n, hexOf(f.n), { ...opt, kind: opt.kind ?? 'item' });
  });
}

export type Box = { x0: number; z0: number; y0: number; L: number; W: number; H: number };

export function unitBox(u: Unit): Box {
  const t = TYPE[u.type];
  const y0 = u.level * FLOOR;
  const L = u.rot ? t.wid : t.len;
  const W = u.rot ? t.len : t.wid;
  return { x0: u.x, z0: u.z, y0, L, W, H: t.hgt };
}

/** split a rectangle into what is left after rectangular holes */
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
  return rects.filter(([a, b, cc, d]) => cc - a > 0.015 && d - b > 0.015);
}

const WALLS: { id: Wall; n: P3 }[] = [
  { id: 'front', n: [1, 0, 0] },
  { id: 'back', n: [-1, 0, 0] },
  { id: 'left', n: [0, 0, -1] },
  { id: 'right', n: [0, 0, 1] },
];

export function wallPoint(id: Wall, u: number, v: number, box: Box, off = 0): P3 {
  const { x0, z0, y0, L, W } = box;
  if (id === 'front') return [x0 + L + off, y0 + v, z0 + u];
  if (id === 'back') return [x0 - off, y0 + v, z0 + u];
  if (id === 'left') return [x0 + u, y0 + v, z0 - off];
  return [x0 + u, y0 + v, z0 + W + off];
}

const wallLen = (id: Wall, box: Box) => (id === 'front' || id === 'back' ? box.W : box.L);

const PITCH = 0.28;

/**
 * Corrugation as figure and ground: a wide flat pan and a narrow valley.
 * Drawn with no outline, because stroking each band is what turned the shell
 * into a brick grid.
 */
const VALLEY = 0.105;
const PAN = PITCH - VALLEY;

function bands(u0: number, u1: number, v0: number, v1: number) {
  const out: [number, number, number, number, number][] = [];
  let a = u0;
  let guard = 0;
  while (a < u1 - 1e-4 && guard++ < 400) {
    const i = Math.floor(a / PITCH + 1e-6);
    const panEnd = Math.min(u1, i * PITCH + PAN);
    const valEnd = Math.min(u1, (i + 1) * PITCH);
    if (panEnd > a + 1e-4) {
      out.push([a, v0, panEnd, v1, 1]);
    }
    if (valEnd > Math.max(a, panEnd) + 1e-4) {
      out.push([Math.max(a, panEnd), v0, valEnd, v1, 0.82]);
    }
    a = valEnd;
  }
  return out;
}

function glassQuad(ctx: Ctx, key: string, unit: string, pts: P3[], n: P3) {
  const proj = pts.map((p) => project(p, ctx.cam, ctx.w, ctx.h));
  const depth = proj.reduce((a, p) => a + p.d, 0) / proj.length;
  ctx.out.push({
    key,
    unit,
    pts: proj.map((p) => [p.x, p.y]),
      fill: 'rgba(176,204,214,0.62)',
    stroke: 'none',
    depth,
    kind: 'opening',
  });
}

function drawOpening(
  ctx: Ctx,
  unit: Unit,
  box: Box,
  wall: { id: Wall; n: P3 },
  o: Unit['openings'][0],
  facing: 'out' | 'in'
) {
  const len = wallLen(wall.id, box);
  const dir = facing === 'out' ? 1 : -1;
  const off = facing === 'out' ? 0.005 : -0.055;
  const u0 = clamp(o.along - o.w / 2, 0.02, len - 0.02);
  const u1 = clamp(o.along + o.w / 2, 0.02, len - 0.02);
  const v0 = o.sill;
  const v1 = o.sill + o.h;
  const n: P3 = [wall.n[0] * dir, wall.n[1] * dir, wall.n[2] * dir];
  const P = (u: number, v: number, extra = 0) => wallPoint(wall.id, u, v, box, off + extra * dir);

  // reveal: the inside of the cut, dark
  const rev = 0.07;
  push(ctx, unit.id + 'rev' + o.id + facing, unit.id, [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], n, '#26282B', {
    k: 0.75,
    kind: 'opening',
    ao: 0.85,
  });

  const leaf = o.label === 'Glazed door' ? 'glass' : 'panel';
  const frame = '#2E3134';

  const bar = (a0: number, b0: number, a1: number, b1: number, hex: string, k = 1) =>
    push(ctx, unit.id + 'b' + o.id + facing + a0 + b0, unit.id, [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], n, hex, {
      k,
      kind: 'opening',
    });

  if (o.kind === 'window') {
    // aluminium frame around a glass pane, with a mullion on wide windows
    const t = 0.05;
    bar(u0, v0, u1, v0 + t, '#B9BFC3');
    bar(u0, v1 - t, u1, v1, '#B9BFC3');
    bar(u0, v0, u0 + t, v1, '#B9BFC3');
    bar(u1 - t, v0, u1, v1, '#B9BFC3');
    glassQuad(ctx, unit.id + 'gl' + o.id + facing, unit.id, [P(u0 + t, v0 + t), P(u1 - t, v0 + t), P(u1 - t, v1 - t), P(u0 + t, v1 - t)], n);
    if (o.w > 1.6) bar((u0 + u1) / 2 - 0.02, v0 + t, (u0 + u1) / 2 + 0.02, v1 - t, '#B9BFC3');
    // cill
    push(ctx, unit.id + 'cill' + o.id + facing, unit.id, [P(u0 - 0.06, v0 - 0.04), P(u1 + 0.06, v0 - 0.04), P(u1 + 0.06, v0), P(u0 - 0.06, v0)], n, '#C7CCD0', { k: 1.05, kind: 'opening' });
    return;
  }

  // doors
  if (o.label === 'Bi-fold wall') {
    const panels = 4;
    const pw = (u1 - u0) / panels;
    for (let i = 0; i < panels; i++) {
      const a = u0 + i * pw + 0.01;
      const b = u0 + (i + 1) * pw - 0.01;
      if (i === 2) {
        glassQuad(ctx, unit.id + 'gl' + o.id + facing + i, unit.id, [P(a, v0), P(b, v0), P(b, v1), P(a, v1)], n);
      } else {
        bar(a, v0, b, v1, '#494F54', 0.95);
      }
    }
    bar(u0, v1 - 0.04, u1, v1, '#4E5459');
    return;
  }

  if (o.label === 'Sliding door') {
    const half = (u1 - u0) / 2;
    for (let i = 0; i < 2; i++) {
      const a = u0 + i * half + 0.015;
      const b = u0 + (i + 1) * half - 0.015;
      glassQuad(ctx, unit.id + 'gl' + o.id + facing + i, unit.id, [P(a, v0 + 0.03), P(b, v0 + 0.03), P(b, v1 - 0.03), P(a, v1 - 0.03)], n);
      bar(a, v0, b, v0 + 0.06, frame);
      bar(a, v1 - 0.06, b, v1, frame);
      bar(a, v0, a + 0.05, v1, frame);
      bar(b - 0.05, v0, b, v1, frame);
    }
    bar((u0 + u1) / 2 - 0.03, v0, (u0 + u1) / 2 + 0.03, v1, frame, 1.1);
    return;
  }

  // plain or glazed personnel door
  const t = 0.06;
  bar(u0, v0, u1, v0 + t, frame);
  bar(u0, v1 - t, u1, v1, frame);
  bar(u0, v0, u0 + t, v1, frame);
  bar(u1 - t, v0, u1, v1, frame);
  if (leaf === 'glass') {
    glassQuad(ctx, unit.id + 'gl' + o.id + facing, unit.id, [P(u0 + t, v0 + t), P(u1 - t, v0 + t), P(u1 - t, v1 - t), P(u0 + t, v1 - t)], n);
    bar((u0 + u1) / 2 - 0.03, v0 + t, (u0 + u1) / 2 + 0.03, v1 - t, frame);
  } else {
    bar(u0 + t, v0 + t, u1 - t, v1 - t, '#D7D2C6', 1.02);
    bar(u0 + t, v0 + v1 * 0.5 - 0.09, u1 - t, v0 + v1 * 0.5 + 0.09, '#CFC9BC', 0.98);
  }
  // lever
  const hu = u1 - 0.14;
  bar(hu - 0.03, 1.02, hu + 0.03, 1.16, '#AEB4B8', 1.1);
}

function drawWall(ctx: Ctx, unit: Unit, box: Box, wall: { id: Wall; n: P3 }, cut: boolean) {
  const facing = normalVisible(wall.n, ctx.cam);
  if (cut && facing) return;
  const len = wallLen(wall.id, box);
  const t = TYPE[unit.type];
  const isCabin = t.group === 'cabin';
  const hex = cut ? '#C9C6BE' : shellOf(unit.color).hex;

  const holes: [number, number, number, number][] = unit.openings
    .filter((o) => o.wall === wall.id)
    .map((o) => [o.along - o.w / 2, o.sill, o.along + o.w / 2, o.sill + o.h]);

  const n = cut ? ([(-wall.n[0]) as number, (-wall.n[1]) as number, (-wall.n[2]) as number] as P3) : wall.n;
  const off = cut ? -0.075 : 0;

  for (const [u0, v0, u1, v1] of splitWall(len, box.H, holes)) {
    if (isCabin || cut) {
      push(ctx, unit.id + wall.id + u0 + v0, unit.id, [wallPoint(wall.id, u0, v0, box, off), wallPoint(wall.id, u1, v0, box, off), wallPoint(wall.id, u1, v1, box, off), wallPoint(wall.id, u0, v1, box, off)], n, hex, {
        kind: cut ? 'lining' : 'wall',
        ao: cut ? 0.92 : 1,
      });
      continue;
    }
    for (const [a0, b0, a1, b1, k] of bands(u0, u1, v0, v1)) {
      push(ctx, unit.id + wall.id + a0 + b0, unit.id, [wallPoint(wall.id, a0, b0, box), wallPoint(wall.id, a1, b0, box), wallPoint(wall.id, a1, b1, box), wallPoint(wall.id, a0, b1, box)], n, hex, {
        k,
        kind: 'wall',
        ao: 0.97,
        stroke: 'none',
      });
    }
  }

  // base rail and top rail, plus a shadow band where the shell meets the ground
  if (!cut) {
    const railH = 0.12;
    push(ctx, unit.id + wall.id + 'railB', unit.id, [wallPoint(wall.id, 0, 0, box, 0.008), wallPoint(wall.id, len, 0, box, 0.008), wallPoint(wall.id, len, railH, box, 0.008), wallPoint(wall.id, 0, railH, box, 0.008)], wall.n, '#3A3D40', { k: 1, kind: 'trim' });
    push(ctx, unit.id + wall.id + 'railT', unit.id, [wallPoint(wall.id, 0, box.H - 0.1, box, 0.008), wallPoint(wall.id, len, box.H - 0.1, box, 0.008), wallPoint(wall.id, len, box.H, box, 0.008), wallPoint(wall.id, 0, box.H, box, 0.008)], wall.n, '#3A3D40', { k: 1, kind: 'trim' });
    if (isCabin) {
      const seam = 1.22;
      for (let u = seam; u < len - 0.1; u += seam) {
        push(ctx, unit.id + wall.id + 'seam' + u, unit.id, [wallPoint(wall.id, u - 0.015, 0.12, box, 0.01), wallPoint(wall.id, u + 0.015, 0.12, box, 0.01), wallPoint(wall.id, u + 0.015, box.H - 0.1, box, 0.01), wallPoint(wall.id, u - 0.015, box.H - 0.1, box, 0.01)], wall.n, '#9C978C', { k: 0.92, kind: 'trim' });
      }
    }
  }

  for (const o of unit.openings.filter((x) => x.wall === wall.id)) {
    drawOpening(ctx, unit, box, wall, o, cut ? 'in' : 'out');
  }
}

function drawRoof(ctx: Ctx, unit: Unit, box: Box) {
  const { x0, z0, y0, L, W, H } = box;
  const t = TYPE[unit.type];
  const hex = shellOf(unit.color).hex;
  const y = y0 + H + 0.01;
  if (t.group === 'cabin') {
    push(ctx, unit.id + 'roof', unit.id, [[x0 - 0.06, y, z0 - 0.06], [x0 + L + 0.06, y, z0 - 0.06], [x0 + L + 0.06, y, z0 + W + 0.06], [x0 - 0.06, y, z0 + W + 0.06]], [0, 1, 0], hex, { k: 0.82, kind: 'roof', ao: 0.95 });
    push(ctx, unit.id + 'fascia', unit.id, [[x0 - 0.06, y - 0.12, z0 + W + 0.06], [x0 + L + 0.06, y - 0.12, z0 + W + 0.06], [x0 + L + 0.06, y, z0 + W + 0.06], [x0 - 0.06, y, z0 + W + 0.06]], [0, 0, 1], '#B7B2A7', { kind: 'trim' });
    return;
  }
  // roof: one pan, then the transverse valley ribs laid over it unoutlined
  const ox = 0.04;
  push(ctx, unit.id + 'roofFlat', unit.id, [[x0 - ox, y, z0 - ox], [x0 + L + ox, y, z0 - ox], [x0 + L + ox, y, z0 + W + ox], [x0 - ox, y, z0 + W + ox]], [0, 1, 0], hex, { k: 0.94, kind: 'roof', ao: 0.95, stroke: 'none' });
  let z = z0;
  let i = 0;
  while (z < z0 + W - 0.01) {
    const zz = Math.min(z0 + W, z + 0.09);
    push(ctx, unit.id + 'roofr' + i, unit.id, [[x0 - ox, y, z], [x0 + L + ox, y, z], [x0 + L + ox, y, zz], [x0 - ox, y, zz]], [0, 1, 0], hex, {
      k: 0.79,
      kind: 'roof',
      stroke: 'none',
    });
    z += 0.26;
    i++;
  }
  // drip edge round the roof perimeter
  const de = 0.09;
  for (const [ax, az, bx, bz, nn] of [
    [x0 - ox, z0 + W + ox, x0 + L + ox, z0 + W + ox, [0, 0, 1]],
    [x0 - ox, z0 - ox, x0 + L + ox, z0 - ox, [0, 0, -1]],
    [x0 + L + ox, z0 - ox, x0 + L + ox, z0 + W + ox, [1, 0, 0]],
    [x0 - ox, z0 - ox, x0 - ox, z0 + W + ox, [-1, 0, 0]],
  ] as [number, number, number, number, P3][]) {
    if (!normalVisible(nn, ctx.cam)) continue;
    push(ctx, unit.id + 'drip' + ax + az, unit.id, [[ax, y - 0.05, az], [bx, y - 0.05, bz], [bx, y + 0.005, bz], [ax, y + 0.005, az]], nn, '#4A4E52', { kind: 'trim', k: 0.95 });
  }
  void de;
}

function drawFrame(ctx: Ctx, unit: Unit, box: Box, cut = false) {
  const t = TYPE[unit.type];
  const { x0, z0, y0, L, W, H } = box;
  if (t.group === 'cabin') {
    // steel base frame, slightly proud
    solid(ctx, unit.id + 'base', unit.id, [x0 - 0.04, y0, z0 - 0.04, x0 + L + 0.04, y0 + 0.14, z0 + W + 0.04], '#4C5155', { kind: 'trim' });
    return;
  }
  const c = 0.18;
  const cast = 0.17;
  // in cutaway the near corner posts would stand in front of the room, so they go too
  const near = (cx: number, cz: number) => {
    if (!cut) return false;
    const dx = cx === x0 ? -1 : 1;
    const dz = cz === z0 ? -1 : 1;
    return normalVisible([dx, 0, 0], ctx.cam) || normalVisible([0, 0, dz], ctx.cam);
  };
  for (const [cx, cz] of [
    [x0, z0],
    [x0 + L, z0],
    [x0, z0 + W],
    [x0 + L, z0 + W],
  ]) {
    if (near(cx, cz)) continue;
    for (const cy of [y0, y0 + H]) {
      solid(ctx, unit.id + 'cast' + cx + cz + cy, unit.id, [cx - cast / 2, cy - (cy === y0 ? 0.02 : 0.15), cz - cast / 2, cx + cast / 2, cy + (cy === y0 ? 0.15 : 0.02), cz + cast / 2], '#43474B', { kind: 'trim', k: 0.9 });
    }
  }
  // corner posts catch the light differently to the panel
  for (const [cx, cz] of [
    [x0, z0],
    [x0 + L, z0],
    [x0, z0 + W],
    [x0 + L, z0 + W],
  ]) {
    if (near(cx, cz)) continue;
    solid(ctx, unit.id + 'post' + cx + cz, unit.id, [cx - c / 2, y0 + 0.14, cz - c / 2, cx + c / 2, y0 + H - 0.14, cz + c / 2], '#3E4246', { kind: 'trim', k: 1.02 });
  }
}

function drawPad(ctx: Ctx, unit: Unit, box: Box) {
  if (unit.level !== 0) return;
  const { x0, z0, y0, L, W } = box;
  solid(ctx, unit.id + 'pad', unit.id, [x0 - 0.18, y0 - 0.16, z0 - 0.18, x0 + L + 0.18, y0, z0 + W + 0.18], '#6E6C64', { kind: 'floor', k: 0.95 });
}

/** room-local (length, width, height) to world */
function worldOf(unit: Unit, box: Box, U: number, W: number): [number, number] {
  return unit.rot ? [box.x0 + W, box.z0 + U] : [box.x0 + U, box.z0 + W];
}

const rot2 = (x: number, z: number, k: number): [number, number] => {
  switch (((k % 4) + 4) % 4) {
    case 1:
      return [-z, x];
    case 2:
      return [-x, -z];
    case 3:
      return [z, -x];
    default:
      return [x, z];
  }
};

/** world delta → local (x,z) delta for an item, by finite difference of its world centre */
export function localDelta(unit: Unit, box: Box, it: Item, dwx: number, dwz: number): [number, number] {
  const at = (x: number, z: number) => itemWorldBox(unit, box, { ...it, x, z }, 0, 0, 0, 0, 0, 0);
  const p0 = at(it.x, it.z);
  const px = at(it.x + 0.01, it.z);
  const pz = at(it.x, it.z + 0.01);
  const a11 = (px.wx - p0.wx) / 0.01;
  const a21 = (px.wz - p0.wz) / 0.01;
  const a12 = (pz.wx - p0.wx) / 0.01;
  const a22 = (pz.wz - p0.wz) / 0.01;
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-9) return [0, 0];
  return [(dwx * a22 - dwz * a12) / det, (a11 * dwz - a21 * dwx) / det];
}

export function itemWorldBox(unit: Unit, box: Box, it: Item, px: number, py: number, pz: number, pw: number, ph: number, pd: number) {
  const k = (((unit.rot as number) + (it.rot as number)) % 4 + 4) % 4;
  const [du, dw] = rot2(px, pz, k);
  const cu = it.x + du;
  const cw = it.z + dw;
  const su = k % 2 === 0 ? pw : pd;
  const sd = k % 2 === 0 ? pd : pw;
  const [wx, wz] = worldOf(unit, box, cu, cw);
  return { wx, wz, su, sd, y: box.y0 + py, ph };
}

function drawItems(ctx: Ctx, unit: Unit, box: Box, glow: string | null) {
  for (const it of unit.items) {
    const f = FURN[it.kind];
    if (!f) continue;
    const parts = f.parts(f.w, f.d, f.h);
    const sel = glow === it.id;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const b = itemWorldBox(unit, box, it, p.x, p.y, p.z, p.w, p.h, p.d);
      boxFaces(ctx, unit.id + 'i' + it.id + i, unit.id, b.wx - b.su / 2, b.y - p.h / 2, b.wz - b.sd / 2, b.wx + b.su / 2, b.y + p.h / 2, b.wz + b.sd / 2, () => p.c, {
        item: it.id,
        kind: 'item',
        k: sel ? 1.12 : 1,
      });
    }
  }
}

export function buildScene(
  units: Unit[],
  cam: Cam,
  w: number,
  h: number,
  sel: { unit: string | null; item: string | null },
  cut: boolean
) {
  const ctx: Ctx = { out: [], cam, w, h, cut };
  const shadows: { pts: number[][]; a: number }[] = [];

  for (const u of units) {
    const box = unitBox(u);
    drawPad(ctx, u, box);
    drawFrame(ctx, u, box, cut);

    if (u.level === 0) {
      const { x0, z0, L, W, y0 } = box;
      const dx = (-LIGHT[0] / LIGHT[1]) * y0 * 0.55;
      const dz = (-LIGHT[2] / LIGHT[1]) * y0 * 0.55;
      const q = [
        [x0 + dx, y0 * 0.02, z0 + dz],
        [x0 + L + dx, y0 * 0.02, z0 + dz],
        [x0 + L + dx, y0 * 0.02, z0 + W + dz],
        [x0 + dx, y0 * 0.02, z0 + W + dz],
      ] as P3[];
      shadows.push({ pts: q.map((p) => { const s = project(p, cam, w, h); return [s.x, s.y]; }), a: 0.3 });
    }

    for (const wall of WALLS) drawWall(ctx, u, box, wall, cut);
    if (!cut) drawRoof(ctx, u, box);

    if (cut) {
      const { x0, z0, y0, L, W } = box;
      push(ctx, u.id + 'floorTop', u.id, [[x0 - 0.05, y0 + 0.04, z0 - 0.05], [x0 + L + 0.05, y0 + 0.04, z0 - 0.05], [x0 + L + 0.05, y0 + 0.04, z0 + W + 0.05], [x0 - 0.05, y0 + 0.04, z0 + W + 0.05]], [0, 1, 0], '#B49A75', { kind: 'lining', k: 0.86, ao: 0.95, stroke: 'none' });
      // plank seams across the floor, then a skirting line at the wall base
      let pz = z0 + 0.19;
      let pi = 0;
      while (pz < z0 + W - 0.02) {
        push(ctx, u.id + 'plank' + pi, u.id, [[x0, y0 + 0.045, pz - 0.008], [x0 + L, y0 + 0.045, pz - 0.008], [x0 + L, y0 + 0.045, pz + 0.008], [x0, y0 + 0.045, pz + 0.008]], [0, 1, 0], '#8E7554', { kind: 'lining', k: 0.92, stroke: 'none' });
        pz += 0.19;
        pi++;
      }
      for (const [ax, az, bx, bz, nx, nz] of [
        [x0, z0, x0 + L, z0, 0, 1],
        [x0, z0 + W, x0 + L, z0 + W, 0, -1],
        [x0, z0, x0, z0 + W, 1, 0],
        [x0 + L, z0, x0 + L, z0 + W, -1, 0],
      ] as [number, number, number, number, number, number][]) {
        if (!normalVisible([nx, 0, nz], ctx.cam)) continue;
        push(ctx, u.id + 'skirt' + ax + az, u.id, [[ax, y0 + 0.04, az], [bx, y0 + 0.04, bz], [bx, y0 + 0.14, bz], [ax, y0 + 0.14, az]], [nx, 0, nz], '#E6E2D8', { kind: 'lining', k: 1.02, stroke: 'none' });
      }
      drawItems(ctx, u, box, sel.item);
    }
  }

  return { faces: ctx.out, shadows };
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

export function itemEdges(units: Unit[], cam: Cam, w: number, h: number, unitId: string, itemId: string) {
  const u = units.find((x) => x.id === unitId);
  const it = u && u.items.find((x) => x.id === itemId);
  if (!u || !it) return [] as number[][][];
  const f = FURN[it.kind];
  if (!f) return [] as number[][][];
  const box = unitBox(u);
  const b = itemWorldBox(u, box, it, 0, f.h / 2, 0, f.w, f.h, f.d);
  const x0 = b.wx - b.su / 2;
  const x1 = b.wx + b.su / 2;
  const z0 = b.wz - b.sd / 2;
  const z1 = b.wz + b.sd / 2;
  const y0 = box.y0;
  const y1 = box.y0 + f.h;
  const pts: P2[] = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ].map((p) => project(p as P3, cam, w, h));
  const edgesIdx = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return edgesIdx.map(([a, b2]) => [[pts[a].x, pts[a].y], [pts[b2].x, pts[b2].y]]) as ScreenPoly[];
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
