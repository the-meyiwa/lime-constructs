/* ============================================================
   Container Builder — 3D scene projector & painter's sort renderer
   for React Native SVG (mobile & web).

   Renders every unit, corrugated wall, ISO corner casting, cargo door,
   lined interior wall, concrete foundation pad, and every placed part
   from container-library.ts:
     - opening   cut through the wall with welded RHS frame & glazing/door
     - fitting   furniture, partitions, mezzanines, stairs inside the unit
     - facade    timber slat screens, fins, green walls, awnings, hoods
     - roof      roof decks + glass balustrades, solar arrays, green roofs,
                 skylights, roof hatches, rooftop pergolas, mono-pitch roofs
     - site      decks, pergolas, canopies, steps, ramps, external stairs,
                 spiral stairs, link bridges, balustrades, privacy screens,
                 planters, hot tubs, steel posts, rainwater tanks, septic
                 tanks, generators
   ============================================================ */

import {
  PART,
  SHELL_COLORS,
  extOf,
  layoutUnits,
  planSize,
  unitRect,
  type PlacedItem,
  type UnitLayoutInfo,
  type UnitModel,
  type WallId,
} from './container-library';
import { FLOOR_DEPTH, ISO, MEMBERS, ROOF_DEPTH } from './container-structure';

export type P3 = [number, number, number];
export type P2 = { x: number; y: number; d: number };
export type ScreenPoly = number[][];
export type Cam = { az: number; el: number; dist: number };
export type SelRef =
  | { t: 'unit'; id: string }
  | { t: 'item'; id: string; key: number }
  | { t: 'site'; key: number }
  | null;

export const PAD_H = 0.1;
export const BASE_Y = FLOOR_DEPTH + PAD_H; // 0.255m world Y of ground-floor internal floor

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

let PIVOT: P3 = [0, 1.2, 0];
let FIT = 1;

export function setView(pivot: P3, fit: number) {
  PIVOT = pivot;
  FIT = fit;
}

export function getView() {
  return { pivot: PIVOT, fit: FIT };
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

/**
 * Unproject a screen point (sx, sy) onto a horizontal plane y = planeY in world space.
 */
export function screenToWorldXZ(sx: number, sy: number, planeY: number, cam: Cam, w: number, h: number): [number, number] {
  const p0 = project([PIVOT[0], planeY, PIVOT[2]], cam, w, h);
  const px = project([PIVOT[0] + 1, planeY, PIVOT[2]], cam, w, h);
  const pz = project([PIVOT[0], planeY, PIVOT[2] + 1], cam, w, h);
  const a11 = px.x - p0.x;
  const a21 = px.y - p0.y;
  const a12 = pz.x - p0.x;
  const a22 = pz.y - p0.y;
  const det = a11 * a22 - a12 * a21;
  const dx = sx - p0.x;
  const dy = sy - p0.y;
  if (Math.abs(det) < 1e-5) {
    return [PIVOT[0], PIVOT[2]];
  }
  const wx = PIVOT[0] + (dx * a22 - dy * a12) / det;
  const wz = PIVOT[2] + (a11 * dy - a21 * dx) / det;
  return [wx, wz];
}

export function screenDeltaToWorldXZ(dx: number, dy: number, cam: Cam, w: number, h: number): [number, number] {
  const f = Math.min(w, h) * 1.2;
  const s = Math.max(1, (f / Math.max(cam.dist, 1)) * FIT);
  const dxc = dx / s;
  const dyc = -dy / s;
  const sinEl = Math.max(0.18, Math.abs(Math.sin(cam.el))) * (cam.el >= 0 ? 1 : -1);
  const ca = Math.cos(cam.az);
  const sa = Math.sin(cam.az);
  const dX = ca * dxc - (sa / sinEl) * dyc;
  const dZ = -sa * dxc - (ca / sinEl) * dyc;
  return [dX, dZ];
}

const LIGHT: P3 = (() => {
  const v: P3 = [-0.46, 0.82, 0.36];
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
})();
const SKY: P3 = [0.55, 0.64, 0.78];

export function numToRgb(hex: number | string): [number, number, number] {
  if (typeof hex === 'number') {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }
  if (typeof hex === 'string' && hex.startsWith('#')) {
    const h = hex.slice(1);
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  return [140, 140, 140];
}

export function hexOfColorId(id: string): number {
  return (SHELL_COLORS.find((c) => c.id === id) || SHELL_COLORS[0]).hex;
}

export function cssHex(h: number): string {
  return `#${h.toString(16).padStart(6, '0')}`;
}

export function shade(hex: number | string, n: P3, k = 1, ao = 1): string {
  const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const [r0, g0, b0] = numToRgb(hex);
  const d = 0.36 + 0.88 * lit;
  const fill = 0.13 * (1 - lit);
  const r = clamp(((r0 / 255) * d * k * ao + SKY[0] * fill) * 255, 0, 255);
  const g = clamp(((g0 / 255) * d * k * ao + SKY[1] * fill) * 255, 0, 255);
  const b = clamp(((b0 / 255) * d * k * ao + SKY[2] * fill) * 255, 0, 255);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function normalVisible(n: P3, cam: Cam) {
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  const v: P3 = [ce * Math.sin(cam.az), se, ce * Math.cos(cam.az)];
  return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > -0.02;
}

export type Face = {
  key: string;
  ref: SelRef;
  pts: number[][];
  fill: string;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  depth: number;
  worldPt: P3;
  wall?: WallId;
};

export type GroundShadow = {
  key: string;
  pts: number[][];
  fill: string;
  opacity?: number;
};

type Transform = {
  pos: P3;
  rot: number; // quarter turns clockwise around Y
};

function rotY(p: P3, rot: number): P3 {
  const r = ((rot % 4) + 4) % 4;
  if (r === 1) return [-p[2], p[1], p[0]];
  if (r === 2) return [-p[0], p[1], -p[2]];
  if (r === 3) return [p[2], p[1], -p[0]];
  return [p[0], p[1], p[2]];
}

function applyTf(p: P3, tf: Transform): P3 {
  const rp = rotY(p, tf.rot);
  return [tf.pos[0] + rp[0], tf.pos[1] + rp[1], tf.pos[2] + rp[2]];
}

function composeTf(parent: Transform, child: Transform): Transform {
  return {
    pos: applyTf(child.pos, parent),
    rot: (parent.rot + child.rot) % 4,
  };
}

export function worldToUnitLocal(worldPt: P3, u: UnitModel, elev: number): P3 {
  const dx = worldPt[0] - u.cx;
  const dy = worldPt[1] - (BASE_Y + elev);
  const dz = worldPt[2] - u.cz;
  return rotY([dx, dy, dz], -(u.rot || 0));
}

export function unitLocalToWorld(localPt: P3, u: UnitModel, elev: number): P3 {
  return applyTf(localPt, { pos: [u.cx, BASE_Y + elev, u.cz], rot: u.rot || 0 });
}

type BuildCtx = {
  faces: Face[];
  cam: Cam;
  w: number;
  h: number;
  seq: number;
};

function pushQuad(
  ctx: BuildCtx,
  ref: SelRef,
  localPts: P3[],
  localN: P3,
  tf: Transform,
  color: number | string,
  opts: {
    k?: number;
    ao?: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    rawFill?: string;
    doubleSided?: boolean;
    depthBias?: number;
    wall?: WallId;
  } = {}
) {
  let worldN = rotY(localN, tf.rot);
  if (!normalVisible(worldN, ctx.cam)) {
    if (!opts.doubleSided) return;
    worldN = [-worldN[0], -worldN[1], -worldN[2]];
  }
  const worldPts = localPts.map((p) => applyTf(p, tf));
  const proj = worldPts.map((p) => project(p, ctx.cam, ctx.w, ctx.h));
  const depth = proj.reduce((a, p) => a + p.d, 0) / proj.length + (opts.depthBias || 0);
  const cx = worldPts.reduce((a, p) => a + p[0], 0) / worldPts.length;
  const cy = worldPts.reduce((a, p) => a + p[1], 0) / worldPts.length;
  const cz = worldPts.reduce((a, p) => a + p[2], 0) / worldPts.length;

  ctx.faces.push({
    key: 'f' + ctx.seq++,
    ref,
    pts: proj.map((p) => [p.x, p.y]),
    fill: opts.rawFill || shade(color, worldN, opts.k ?? 1, opts.ao ?? 1),
    stroke: opts.stroke ?? 'rgba(0,0,0,0.16)',
    strokeWidth: opts.strokeWidth ?? 0.55,
    opacity: opts.opacity,
    depth,
    worldPt: [cx, cy, cz],
    wall: opts.wall,
  });
}

function addBox(
  ctx: BuildCtx,
  ref: SelRef,
  w: number,
  h: number,
  d: number,
  cx: number,
  cy: number,
  cz: number,
  tf: Transform,
  color: number | string,
  opts: {
    k?: number;
    ao?: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    rawFill?: string;
    depthBias?: number;
  } = {}
) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  addBoxMM(ctx, ref, x0, y0, z0, x1, y1, z1, tf, color, opts);
}

function addBoxMM(
  ctx: BuildCtx,
  ref: SelRef,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  tf: Transform,
  color: number | string,
  opts: {
    k?: number;
    ao?: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    rawFill?: string;
    depthBias?: number;
  } = {}
) {
  const sides: { n: P3; pts: P3[] }[] = [
    { n: [1, 0, 0], pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]] },
    { n: [-1, 0, 0], pts: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]] },
    { n: [0, 0, 1], pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { n: [0, 0, -1], pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    { n: [0, 1, 0], pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
  ];
  for (const s of sides) {
    pushQuad(ctx, ref, s.pts, s.n, tf, color, opts);
  }
}

export function subtractRect(
  rects: { x0: number; x1: number; y0: number; y1: number }[],
  hole: { x0: number; x1: number; y0: number; y1: number }
) {
  const out: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const r of rects) {
    if (hole.x1 <= r.x0 || hole.x0 >= r.x1 || hole.y1 <= r.y0 || hole.y0 >= r.y1) {
      out.push(r);
      continue;
    }
    if (hole.y0 > r.y0) out.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: hole.y0 });
    if (hole.y1 < r.y1) out.push({ x0: r.x0, x1: r.x1, y0: hole.y1, y1: r.y1 });
    const y0 = Math.max(r.y0, hole.y0), y1 = Math.min(r.y1, hole.y1);
    if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, y0, y1 });
    if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, y0, y1 });
  }
  return out.filter((r) => r.x1 - r.x0 > 1e-3 && r.y1 - r.y0 > 1e-3);
}

/* ---------------- Wall local transform helper ---------------- */

function wallTransform(wall: WallId, along: number, sill: number, u: UnitModel, ext: { len: number; wid: number; hgt: number }, unitTf: Transform): Transform {
  // Local frame of an opening/facade on `wall`:
  // X across the opening width (from left to right when looking at the wall from outside),
  // Y up from the sill, Z outward from the outer face of the wall.
  let lx = 0, lz = 0, rot = 0;
  if (wall === 'left') {
    // Normal [0, 0, -1] → rot 2 so local +Z points to -Z, local +X points to -X
    // Wait: let's match container-mesh.js placeOnWall:
    // WALL_NORMAL = { left: (0,0,-1), right: (0,0,1), front: (1,0,0), back: (-1,0,0) }
    // Math.atan2(n.x, n.z)
    lx = -u.len / 2 + along;
    lz = -ext.wid / 2;
    rot = 2;
  } else if (wall === 'right') {
    lx = u.len / 2 - along;
    lz = ext.wid / 2;
    rot = 0;
  } else if (wall === 'front') {
    lx = ext.len / 2;
    lz = -u.wid / 2 + along;
    rot = 3; // rotY([0,0,1], 3) = [1, 0, 0]
  } else {
    lx = -ext.len / 2;
    lz = u.wid / 2 - along;
    rot = 1; // rotY([0,0,1], 1) = [-1, 0, 0]
  }
  return composeTf(unitTf, { pos: [lx, sill, lz], rot });
}

/* ---------------- Opening inserts ---------------- */

function buildOpeningInsert(
  ctx: BuildCtx,
  ref: SelRef,
  it: PlacedItem,
  u: UnitModel,
  ext: { len: number; wid: number; hgt: number },
  unitTf: Transform,
  colorHex: number
) {
  const wall = it.wall || 'left';
  const p = PART[it.type];
  const w = it.w ?? p?.w ?? 1.2;
  const h = it.h ?? p?.h ?? 1.0;
  const sill = it.sill ?? p?.sill ?? 0;
  const depth = wall === 'left' || wall === 'right' ? 0.08 : 0.11;
  const tf = wallTransform(wall, it.along ?? 1, sill, u, ext, unitTf);

  if (it.type === 'cutout') {
    // Framed doorway to next unit
    const t = 0.05;
    addBox(ctx, ref, w + 2 * t, t, depth, 0, h + t / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });
    addBox(ctx, ref, t, h, depth, -w / 2 - t / 2, h / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });
    addBox(ctx, ref, t, h, depth, w / 2 + t / 2, h / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });
    return;
  }

  if (it.type === 'wall-removal') {
    // Steel moment frame: HSS columns and UB header
    const steel = 0x2a2c2f;
    const hd = 0.18;
    addBox(ctx, ref, w + 0.18, hd, 0.1, 0, h - hd / 2, -depth / 2, tf, steel, { depthBias: -0.02 });
    addBox(ctx, ref, 0.1, h, 0.1, -w / 2 + 0.05, h / 2, -depth / 2, tf, steel, { depthBias: -0.02 });
    addBox(ctx, ref, 0.1, h, 0.1, w / 2 - 0.05, h / 2, -depth / 2, tf, steel, { depthBias: -0.02 });
    if (w > 4) {
      const bays = Math.ceil(w / 3.6);
      for (let i = 1; i < bays; i++) {
        addBox(ctx, ref, 0.1, h, 0.1, -w / 2 + (w * i) / bays, h / 2, -depth / 2, tf, steel, { depthBias: -0.02 });
      }
    }
    return;
  }

  // Welded RHS perimeter frame
  const t = 0.048;
  const alu = 0x2b2d30;
  addBox(ctx, ref, w + 2 * t, t, depth, 0, -t / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });
  addBox(ctx, ref, w + 2 * t, t, depth, 0, h + t / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });
  addBox(ctx, ref, t, h, depth, -w / 2 - t / 2, h / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });
  addBox(ctx, ref, t, h, depth, w / 2 + t / 2, h / 2, -depth / 2, tf, colorHex, { k: 0.85, depthBias: -0.02 });

  const addGlazing = (gw: number, gh: number, x0: number, y0: number, zc: number, mullions = 0) => {
    const f = 0.04;
    addBox(ctx, ref, gw, f, 0.05, x0 + gw / 2, y0 + f / 2, zc, tf, alu, { depthBias: -0.03 });
    addBox(ctx, ref, gw, f, 0.05, x0 + gw / 2, y0 + gh - f / 2, zc, tf, alu, { depthBias: -0.03 });
    addBox(ctx, ref, f, gh, 0.05, x0 + f / 2, y0 + gh / 2, zc, tf, alu, { depthBias: -0.03 });
    addBox(ctx, ref, f, gh, 0.05, x0 + gw - f / 2, y0 + gh / 2, zc, tf, alu, { depthBias: -0.03 });
    for (let i = 1; i <= mullions; i++) {
      addBox(ctx, ref, f * 0.8, gh, 0.05, x0 + (gw * i) / (mullions + 1), y0 + gh / 2, zc, tf, alu, { depthBias: -0.03 });
    }
    pushQuad(
      ctx,
      ref,
      [
        [x0 + f, y0 + f, zc],
        [x0 + gw - f, y0 + f, zc],
        [x0 + gw - f, y0 + gh - f, zc],
        [x0 + f, y0 + gh - f, zc],
      ],
      [0, 0, 1],
      tf,
      0x94c2d8,
      {
        rawFill: 'rgba(135, 190, 215, 0.52)',
        stroke: 'rgba(210, 240, 255, 0.45)',
        doubleSided: true,
        depthBias: -0.025,
      }
    );
  };

  const addDoorLeaf = (lw: number, lh: number, x0: number, glazed = false) => {
    const zc = -depth * 0.35;
    if (glazed) {
      addGlazing(lw, lh, x0, 0, zc, 0);
    } else {
      addBox(ctx, ref, lw - 0.02, lh - 0.02, 0.04, x0 + lw / 2, lh / 2, zc, tf, 0xe4e2dc, { depthBias: -0.025 });
      addBox(ctx, ref, 0.1, 0.03, 0.04, x0 + lw - 0.14, 1.02, zc + 0.03, tf, 0xc8cdd2, { depthBias: -0.035 });
    }
  };

  switch (it.type) {
    case 'personnel-door':
      addDoorLeaf(w, h, -w / 2, false);
      break;
    case 'glass-door':
      addDoorLeaf(w, h, -w / 2, true);
      break;
    case 'double-door':
      addDoorLeaf(w / 2, h, -w / 2, false);
      addDoorLeaf(w / 2, h, 0, false);
      break;
    case 'french-door':
      addDoorLeaf(w / 2, h, -w / 2, true);
      addDoorLeaf(w / 2, h, 0, true);
      break;
    case 'pivot-door':
      addBox(ctx, ref, w - 0.02, h - 0.02, 0.055, 0, h / 2, -depth * 0.35, tf, 0x6e4a2f, { depthBias: -0.025 });
      addBox(ctx, ref, 0.03, h * 0.65, 0.04, w / 2 - 0.15, h * 0.48, 0.03, tf, 0x222428, { depthBias: -0.035 });
      break;
    case 'sliding-door':
      addGlazing(w / 2 + 0.02, h, -w / 2, 0, -depth * 0.45, 0);
      addGlazing(w / 2 + 0.02, h, -0.02, 0, -depth * 0.25, 0);
      break;
    case 'bifold': {
      const n = Math.max(3, Math.round(w / 0.75));
      addGlazing(w, h, -w / 2, 0, -depth * 0.35, n - 1);
      break;
    }
    case 'garage-door':
    case 'roller-door': {
      const slats = 6;
      for (let i = 0; i < slats; i++) {
        addBox(ctx, ref, w - 0.02, h / slats - 0.015, 0.04, 0, ((i + 0.5) * h) / slats, -depth * 0.35, tf, 0x8e959a, {
          depthBias: -0.025,
        });
      }
      if (it.type === 'roller-door') {
        addBox(ctx, ref, w + 0.16, 0.28, 0.28, 0, h + 0.14, 0.1, tf, 0x9ea5a9, { depthBias: -0.03 });
      }
      break;
    }
    case 'fold-down-deck': {
      addGlazing(w, h, -w / 2, 0, -depth * 0.45, 1);
      const D = Math.min(h, 2.0);
      addBox(ctx, ref, w, 0.07, D, 0, -0.035, D / 2 + 0.02, tf, colorHex, { depthBias: -0.02 });
      addBox(ctx, ref, w - 0.06, 0.02, D - 0.06, 0, 0.01, D / 2 + 0.02, tf, 0x8a6b4a, { depthBias: -0.025 });
      for (const sx of [-1, 1]) {
        addBox(ctx, ref, 0.03, 1.0, 0.03, sx * (w / 2 - 0.03), 0.5, D, tf, alu, { depthBias: -0.03 });
        addBox(ctx, ref, 0.03, 0.03, D, sx * (w / 2 - 0.03), 1.0, D / 2, tf, alu, { depthBias: -0.03 });
      }
      addBox(ctx, ref, w - 0.06, 0.03, 0.03, 0, 1.0, D, tf, alu, { depthBias: -0.03 });
      break;
    }
    case 'box-window': {
      addGlazing(w, h, -w / 2, 0, -depth * 0.4, 0);
      const P = it.proj ?? 0.3;
      const T = 0.03;
      addBox(ctx, ref, w + 2 * T, T, P, 0, h + T / 2, P / 2, tf, 0x1f2023, { depthBias: -0.03 });
      addBox(ctx, ref, w + 2 * T, T, P, 0, -T / 2, P / 2, tf, 0x1f2023, { depthBias: -0.03 });
      addBox(ctx, ref, T, h, P, -w / 2 - T / 2, h / 2, P / 2, tf, 0x1f2023, { depthBias: -0.03 });
      addBox(ctx, ref, T, h, P, w / 2 + T / 2, h / 2, P / 2, tf, 0x1f2023, { depthBias: -0.03 });
      break;
    }
    case 'serving-hatch':
      addGlazing(w, h, -w / 2, 0, -depth * 0.4, 1);
      addBox(ctx, ref, w + 0.1, 0.04, 0.34, 0, -0.02, 0.14, tf, 0xdadde0, { depthBias: -0.03 });
      break;
    case 'vent':
      addBox(ctx, ref, w, h, 0.04, 0, h / 2, 0.01, tf, 0x8a9298, { depthBias: -0.03 });
      break;
    case 'glass-wall':
    case 'clerestory':
      addGlazing(w, h, -w / 2, 0, -depth * 0.4, Math.max(0, Math.ceil(w / 1.2) - 1));
      break;
    default:
      // window, small-window, picture-window
      addGlazing(w, h, -w / 2, 0, -depth * 0.4, w > 1.0 && it.type !== 'picture-window' ? 1 : 0);
      addBox(ctx, ref, w + 0.08, 0.03, 0.1, 0, -0.015, 0.03, tf, 0xc8ccd0, { depthBias: -0.03 });
      break;
  }
}

/* ---------------- Facade parts ---------------- */

function buildFacadePart(
  ctx: BuildCtx,
  ref: SelRef,
  it: PlacedItem,
  u: UnitModel,
  ext: { len: number; wid: number; hgt: number },
  unitTf: Transform
) {
  const wall = it.wall || 'left';
  const p = PART[it.type];
  const w = it.w ?? p?.w ?? 2.0;
  const h = it.h ?? p?.h ?? 2.0;
  const sill = it.sill ?? p?.sill ?? 0;
  const proj = it.proj ?? p?.proj ?? 0.3;
  const tf = wallTransform(wall, it.along ?? 1, sill, u, ext, unitTf);

  switch (it.type) {
    case 'slat-screen': {
      const slats = Math.max(4, Math.min(18, Math.round(w / 0.14)));
      addBox(ctx, ref, w, 0.04, 0.03, 0, 0.05, 0.04, tf, 0x2a2c2f);
      addBox(ctx, ref, w, 0.04, 0.03, 0, h - 0.05, 0.04, tf, 0x2a2c2f);
      for (let i = 0; i < slats; i++) {
        const x = -w / 2 + ((i + 0.5) * w) / slats;
        addBox(ctx, ref, 0.045, h, 0.025, x, h / 2, 0.07, tf, 0x7a5236);
      }
      break;
    }
    case 'fins': {
      const n = Math.max(3, Math.round(w / 0.3));
      for (let i = 0; i <= n; i++) {
        const x = -w / 2 + (i * w) / n;
        addBox(ctx, ref, 0.02, h, 0.2, x, h / 2, 0.1, tf, 0x2b2d30);
      }
      addBox(ctx, ref, w, 0.02, 0.2, 0, h, 0.1, tf, 0x2b2d30);
      break;
    }
    case 'green-wall':
      addBox(ctx, ref, w, h, 0.12, 0, h / 2, 0.06, tf, 0x3f6b35);
      addBox(ctx, ref, w - 0.12, h - 0.12, 0.05, 0, h / 2, 0.13, tf, 0x4f7d3c);
      break;
    case 'awning':
      addBox(ctx, ref, w, 0.04, proj, 0, 0, proj / 2, tf, 0xb8bec2);
      addBox(ctx, ref, w, 0.09, 0.05, 0, -0.03, proj, tf, 0x2a2c2f);
      break;
    case 'window-hood': {
      const T = 0.03;
      addBox(ctx, ref, w + 2 * T, T, proj, 0, h + T / 2, proj / 2, tf, 0x1f2023);
      addBox(ctx, ref, w + 2 * T, T, proj, 0, -T / 2, proj / 2, tf, 0x1f2023);
      addBox(ctx, ref, T, h, proj, -w / 2 - T / 2, h / 2, proj / 2, tf, 0x1f2023);
      addBox(ctx, ref, T, h, proj, w / 2 + T / 2, h / 2, proj / 2, tf, 0x1f2023);
      break;
    }
    case 'ac-outdoor':
      addBox(ctx, ref, w, h, 0.3, 0, h / 2, 0.18, tf, 0xe9e9e6);
      addBox(ctx, ref, h * 0.65, h * 0.65, 0.02, -w * 0.12, h / 2, 0.34, tf, 0x55595c);
      break;
    default:
      addBox(ctx, ref, w, h, 0.06, 0, h / 2, 0.03, tf, 0xcccccc);
      break;
  }
}

/* ---------------- Glass balustrade helper ---------------- */

function addGlassBalustrade(
  ctx: BuildCtx,
  ref: SelRef,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  h: number,
  tf: Transform
) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  if (L < 0.05) return;
  const isX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = isX ? Math.abs(x1 - x0) : 0.04;
  const d = isX ? 0.04 : Math.abs(z1 - z0);
  addBox(ctx, ref, w, 0.07, d, cx, y0 + 0.035, cz, tf, 0x2f3134);
  addBox(ctx, ref, w, 0.03, d, cx, y0 + h, cz, tf, 0x9aa0a4);
  if (isX) {
    pushQuad(
      ctx,
      ref,
      [
        [cx - w / 2, y0 + 0.07, cz],
        [cx + w / 2, y0 + 0.07, cz],
        [cx + w / 2, y0 + h - 0.02, cz],
        [cx - w / 2, y0 + h - 0.02, cz],
      ],
      [0, 0, 1],
      tf,
      0x94c2d8,
      { rawFill: 'rgba(150, 205, 225, 0.36)', stroke: 'rgba(200, 235, 250, 0.45)', doubleSided: true }
    );
  } else {
    pushQuad(
      ctx,
      ref,
      [
        [cx, y0 + 0.07, cz - d / 2],
        [cx, y0 + 0.07, cz + d / 2],
        [cx, y0 + h - 0.02, cz + d / 2],
        [cx, y0 + h - 0.02, cz - d / 2],
      ],
      [1, 0, 0],
      tf,
      0x94c2d8,
      { rawFill: 'rgba(150, 205, 225, 0.36)', stroke: 'rgba(200, 235, 250, 0.45)', doubleSided: true }
    );
  }
}

/* ---------------- Stair flight helper ---------------- */

function addFlight(
  ctx: BuildCtx,
  ref: SelRef,
  w: number,
  run: number,
  rise: number,
  z0: number,
  y0: number,
  tf: Transform,
  treadColor = 0x8a6b4a
) {
  const n = Math.max(4, Math.min(14, Math.round(rise / 0.2)));
  const going = run / n;
  const r = rise / n;
  const st = 0x2a2c2f;
  for (let i = 0; i < n; i++) {
    const ty = y0 + (i + 1) * r;
    const tz = z0 + (i + 0.5) * going;
    addBox(ctx, ref, w - 0.04, 0.04, going + 0.02, 0, ty - 0.02, tz, tf, treadColor);
    for (const sx of [-1, 1]) {
      addBox(ctx, ref, 0.03, r + 0.08, going + 0.04, sx * (w / 2 - 0.015), ty - r / 2, tz, tf, st);
    }
  }
  // Handrail posts & top rail
  for (const sx of [-1, 1]) {
    for (const f of [0.1, 0.5, 0.9]) {
      addBox(ctx, ref, 0.03, 0.92, 0.03, sx * (w / 2 - 0.015), y0 + rise * f + 0.46, z0 + run * f, tf, st);
    }
    pushQuad(
      ctx,
      ref,
      [
        [sx * (w / 2 - 0.015), y0 + 0.9, z0],
        [sx * (w / 2 - 0.015), y0 + 0.94, z0],
        [sx * (w / 2 - 0.015), y0 + rise + 0.94, z0 + run],
        [sx * (w / 2 - 0.015), y0 + rise + 0.9, z0 + run],
      ],
      [sx, 0, 0],
      tf,
      st,
      { doubleSided: true }
    );
  }
}

function addSpiralStair(ctx: BuildCtx, ref: SelRef, dia: number, rise: number, tf: Transform) {
  const st = 0x2a2c2f;
  addBox(ctx, ref, 0.14, rise + 0.95, 0.14, 0, (rise + 0.95) / 2, 0, tf, st);
  const n = Math.max(8, Math.min(14, Math.round(rise / 0.24)));
  const R = dia / 2;
  for (let i = 1; i <= n; i++) {
    const ang = (i * Math.PI * 2) / 10;
    const tx = Math.cos(ang) * (R * 0.52);
    const tz = Math.sin(ang) * (R * 0.52);
    const ty = (i * rise) / n;
    addBox(ctx, ref, R * 0.72, 0.04, 0.28, tx, ty, tz, tf, 0x9aa1a6);
    const px = Math.cos(ang) * (R - 0.05);
    const pz = Math.sin(ang) * (R - 0.05);
    addBox(ctx, ref, 0.03, 0.9, 0.03, px, ty + 0.45, pz, tf, st);
  }
}

/* ---------------- Interior fittings ---------------- */

function buildFittingPart(ctx: BuildCtx, ref: SelRef, it: PlacedItem, u: UnitModel, unitTf: Transform) {
  const p = PART[it.type];
  if (!p) return;
  const w = it.w ?? p.w ?? 1;
  const d = it.d ?? p.d ?? 1;
  const h = it.h ?? p.h ?? 0.8;
  const color = p.color ?? 0xb08d5f;
  const mount = p.mount || 0;
  const tf = composeTf(unitTf, {
    pos: [(it.x ?? u.len / 2) - u.len / 2, mount, (it.z ?? u.wid / 2) - u.wid / 2],
    rot: it.rot || 0,
  });

  switch (it.type) {
    case 'bed':
    case 'double-bed':
      addBox(ctx, ref, w, 0.26, d, 0, 0.13, 0, tf, 0x8f7f6a);
      addBox(ctx, ref, w - 0.06, 0.18, d - 0.06, 0, 0.35, 0.02, tf, 0xeeeae2);
      if (it.type === 'double-bed') {
        addBox(ctx, ref, w * 0.4, 0.09, 0.34, -w * 0.24, 0.48, -d / 2 + 0.24, tf, 0xffffff);
        addBox(ctx, ref, w * 0.4, 0.09, 0.34, w * 0.24, 0.48, -d / 2 + 0.24, tf, 0xffffff);
      } else {
        addBox(ctx, ref, w - 0.2, 0.09, 0.34, 0, 0.48, -d / 2 + 0.24, tf, 0xffffff);
      }
      addBox(ctx, ref, w, 0.85, 0.06, 0, 0.425, -d / 2 + 0.03, tf, 0x6b4f36);
      break;
    case 'bunk':
      for (const y of [0.32, 1.25]) {
        addBox(ctx, ref, w, 0.06, d, 0, y, 0, tf, 0x3d4145);
        addBox(ctx, ref, w - 0.06, 0.15, d - 0.06, 0, y + 0.1, 0, tf, 0xeeeae2);
      }
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(ctx, ref, 0.04, h, 0.04, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), tf, 0x3d4145);
        }
      }
      break;
    case 'sofa':
    case 'armchair':
      addBox(ctx, ref, w, 0.4, d, 0, 0.2, 0, tf, color);
      addBox(ctx, ref, w, h - 0.4, 0.18, 0, (h + 0.4) / 2, -d / 2 + 0.09, tf, color, { k: 0.92 });
      addBox(ctx, ref, 0.15, 0.22, d, -w / 2 + 0.075, 0.51, 0, tf, color, { k: 0.95 });
      addBox(ctx, ref, 0.15, 0.22, d, w / 2 - 0.075, 0.51, 0, tf, color, { k: 0.95 });
      break;
    case 'table':
    case 'desk':
    case 'bistro':
      addBox(ctx, ref, w, 0.04, d, 0, h - 0.02, 0, tf, color);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(ctx, ref, 0.04, h - 0.04, 0.04, sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05), tf, 0x3d4145);
        }
      }
      break;
    case 'chair':
    case 'stool': {
      const seatH = it.type === 'stool' ? h : 0.46;
      addBox(ctx, ref, w * 0.88, 0.05, d * 0.88, 0, seatH, 0, tf, color);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(ctx, ref, 0.03, seatH, 0.03, sx * (w * 0.36), seatH / 2, sz * (d * 0.36), tf, 0x3d4145);
        }
      }
      if (it.type === 'chair') {
        addBox(ctx, ref, w * 0.85, h - seatH, 0.05, 0, (h + seatH) / 2, -d * 0.4, tf, color);
      }
      break;
    }
    case 'kitchen':
    case 'counter':
    case 'reception':
    case 'island':
      addBox(ctx, ref, w, h - 0.04, d - 0.03, 0, (h - 0.04) / 2, 0, tf, color);
      addBox(ctx, ref, w + 0.02, 0.04, d + 0.02, 0, h - 0.02, 0, tf, it.type === 'kitchen' ? 0x3a3d40 : 0xb08d5f);
      if (it.type === 'kitchen') {
        addBox(ctx, ref, 0.48, 0.02, 0.35, w * 0.22, h + 0.005, 0, tf, 0xc3c9ce);
      }
      break;
    case 'shower':
      addBox(ctx, ref, w, 0.06, d, 0, 0.03, 0, tf, 0xf2f2ef);
      addGlassBalustrade(ctx, ref, -w / 2, d / 2, w / 2, d / 2, 0.06, h - 0.12, tf);
      addGlassBalustrade(ctx, ref, w / 2, -d / 2, w / 2, d / 2, 0.06, h - 0.12, tf);
      break;
    case 'toilet':
      addBox(ctx, ref, 0.38, 0.4, 0.52, 0, 0.2, 0.05, tf, 0xf2f2ef);
      addBox(ctx, ref, 0.38, 0.38, 0.18, 0, 0.58, -0.14, tf, 0xf2f2ef);
      break;
    case 'bath':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0xf2f2ef);
      addBox(ctx, ref, w - 0.14, 0.03, d - 0.14, 0, h - 0.04, 0, tf, 0x9fc3cf);
      break;
    case 'vanity':
      addBox(ctx, ref, w, h - 0.04, d, 0, (h - 0.04) / 2, 0, tf, color);
      addBox(ctx, ref, w, 0.04, d, 0, h - 0.02, 0, tf, 0xefefec);
      addBox(ctx, ref, w * 0.5, 0.1, d * 0.55, 0, h + 0.05, 0, tf, 0xffffff);
      break;
    case 'partition': {
      const H = Math.min(h, u.hgt - 0.02);
      const D = Math.min(d, u.wid - 0.04);
      addBox(ctx, ref, w, H, D, 0, H / 2, 0, tf, 0xe8e4dc);
      break;
    }
    case 'glass-partition': {
      const H = Math.min(h, u.hgt - 0.02);
      const D = Math.min(d, u.wid - 0.04);
      addGlassBalustrade(ctx, ref, 0, -D / 2, 0, D / 2, 0, H, tf);
      break;
    }
    case 'mezzanine': {
      const deck = it.deck ?? p.deck ?? 1.8;
      const D = Math.min(d, u.wid - 0.04);
      addBox(ctx, ref, w, 0.12, D, 0, deck - 0.06, 0, tf, 0xa07a52);
      addBox(ctx, ref, 0.08, deck - 0.12, 0.08, w / 2 - 0.05, (deck - 0.12) / 2, -D / 2 + 0.06, tf, 0x2a2c2f);
      addBox(ctx, ref, 0.08, deck - 0.12, 0.08, w / 2 - 0.05, (deck - 0.12) / 2, D / 2 - 0.06, tf, 0x2a2c2f);
      addGlassBalustrade(ctx, ref, w / 2 - 0.03, -D / 2 + 0.7, w / 2 - 0.03, D / 2 - 0.03, deck, 0.95, tf);
      addBox(ctx, ref, w * 0.62, 0.14, D * 0.72, -w * 0.14, deck + 0.07, 0, tf, 0xeeeae2);
      break;
    }
    case 'stair':
    case 'ship-ladder':
      addFlight(ctx, ref, w, d, it.h ?? p.h ?? 2.2, -d / 2, 0, tf);
      break;
    case 'spiral-in':
      addSpiralStair(ctx, ref, w, it.h ?? p.h ?? 2.6, tf);
      break;
    case 'tv-unit':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, color);
      addBox(ctx, ref, Math.min(1.3, w * 0.75), 0.72, 0.05, 0, h + 0.4, -d * 0.2, tf, 0x15171a);
      break;
    default:
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, color);
      break;
  }
}

/* ---------------- Roof parts ---------------- */

function buildRoofPart(ctx: BuildCtx, ref: SelRef, it: PlacedItem, u: UnitModel, unitTf: Transform) {
  const p = PART[it.type];
  if (!p) return;
  const w = it.w ?? p.w ?? 2;
  const d = it.d ?? p.d ?? 2;
  const h = it.h ?? p.h ?? 0.2;
  const tf = composeTf(unitTf, {
    pos: [(it.x ?? u.len / 2) - u.len / 2, u.hgt + ROOF_DEPTH + 0.005, (it.z ?? u.wid / 2) - u.wid / 2],
    rot: 0,
  });

  switch (it.type) {
    case 'roof-deck':
      addBox(ctx, ref, w, 0.1, d, 0, 0.05, 0, tf, 0x7b6a58);
      addGlassBalustrade(ctx, ref, -w / 2, -d / 2, w / 2, -d / 2, 0.1, 1.05, tf);
      addGlassBalustrade(ctx, ref, -w / 2, d / 2, w / 2, d / 2, 0.1, 1.05, tf);
      addGlassBalustrade(ctx, ref, w / 2, -d / 2, w / 2, d / 2, 0.1, 1.05, tf);
      addGlassBalustrade(ctx, ref, -w / 2, -d / 2, -w / 2, d / 2 - 0.9, 0.1, 1.05, tf);
      break;
    case 'solar': {
      const pw = p.panel?.w ?? 1.13;
      const pd = p.panel?.d ?? 1.76;
      const cols = Math.max(1, Math.floor(w / pw));
      const rows = Math.max(1, Math.floor(d / pd));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = (-cols * pw) / 2 + (c + 0.5) * pw;
          const pz = (-rows * pd) / 2 + (r + 0.5) * pd;
          addBox(ctx, ref, pw - 0.05, 0.05, pd - 0.05, px, 0.12, pz, tf, 0x162844, { stroke: '#6090C8' });
        }
      }
      break;
    }
    case 'green-roof':
      addBox(ctx, ref, w, 0.09, d, 0, 0.045, 0, tf, 0x4b3b2c);
      addBox(ctx, ref, w - 0.06, 0.04, d - 0.06, 0, 0.11, 0, tf, 0x5f8a3f);
      break;
    case 'skylight':
    case 'roof-hatch':
      addBox(ctx, ref, w, 0.15, d, 0, 0.075, 0, tf, 0x2a2c2f);
      addBox(
        ctx,
        ref,
        w + 0.04,
        0.04,
        d + 0.04,
        0,
        0.17,
        0,
        tf,
        it.type === 'skylight' ? 0x94c2d8 : 0xb9bec2,
        it.type === 'skylight' ? { rawFill: 'rgba(145, 205, 230, 0.65)' } : {}
      );
      break;
    case 'roof-pergola':
      buildPergola(ctx, ref, w, d, h, tf);
      break;
    case 'pitched-roof':
      for (const sx of [-1, 0, 1]) {
        for (const sz of [-1, 1]) {
          const ph = sz > 0 ? 0.45 : 0.25;
          addBox(ctx, ref, 0.06, ph, 0.06, sx * (w / 2 - 0.15), ph / 2, sz * (d / 2 - 0.25), tf, 0x2a2c2f);
        }
      }
      pushQuad(
        ctx,
        ref,
        [
          [-w / 2, 0.25, -d / 2],
          [w / 2, 0.25, -d / 2],
          [w / 2, 0.48, d / 2],
          [-w / 2, 0.48, d / 2],
        ],
        [0, 1, -0.08],
        tf,
        0xa9b0b4,
        { doubleSided: true }
      );
      break;
    default:
      addBox(ctx, ref, w, 0.08, d, 0, 0.04, 0, tf, 0xcccccc);
      break;
  }
}

function buildPergola(ctx: BuildCtx, ref: SelRef, w: number, d: number, h: number, tf: Transform) {
  const st = 0x2a2c2f;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(ctx, ref, 0.1, h, 0.1, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06), tf, st);
    }
  }
  for (const sz of [-1, 1]) {
    addBox(ctx, ref, w, 0.14, 0.08, 0, h - 0.07, sz * (d / 2 - 0.06), tf, st);
  }
  const n = Math.max(4, Math.min(14, Math.round(w / 0.32)));
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + 0.08 + (i * (w - 0.16)) / n;
    addBox(ctx, ref, 0.05, 0.1, d + 0.16, x, h + 0.05, 0, tf, 0x8a6242);
  }
}

/* ---------------- Site parts ---------------- */

function buildSitePart(ctx: BuildCtx, it: PlacedItem) {
  const p = PART[it.type];
  if (!p) return;
  const ref: SelRef = { t: 'site', key: it.key };
  const w = it.w ?? p.w ?? 2;
  const d = it.d ?? p.d ?? 2;
  const h = it.h ?? p.h ?? 0.26;
  const tf: Transform = {
    pos: [it.x ?? 0, it.elev || 0, it.z ?? 0],
    rot: it.rot || 0,
  };

  switch (it.type) {
    case 'deck':
    case 'walkway':
      addBox(ctx, ref, w, 0.08, d, 0, h - 0.04, 0, tf, it.type === 'deck' ? 0x7b6a58 : 0x9aa1a6);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (h > 0.1) {
            addBox(ctx, ref, 0.08, h - 0.08, 0.08, sx * (w / 2 - 0.08), (h - 0.08) / 2, sz * (d / 2 - 0.08), tf, 0x6f7479);
          }
        }
      }
      if (it.type === 'walkway') {
        addGlassBalustrade(ctx, ref, -w / 2, -d / 2 + 0.02, w / 2, -d / 2 + 0.02, h, 1.05, tf);
        addGlassBalustrade(ctx, ref, -w / 2, d / 2 - 0.02, w / 2, d / 2 - 0.02, h, 1.05, tf);
      }
      break;
    case 'pergola':
      buildPergola(ctx, ref, w, d, h, tf);
      break;
    case 'canopy':
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(ctx, ref, 0.1, h, 0.1, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06), tf, 0x2a2c2f);
        }
      }
      addBox(ctx, ref, w, 0.1, d, 0, h - 0.05, 0, tf, 0x2a2c2f);
      pushQuad(
        ctx,
        ref,
        [
          [-w / 2 - 0.1, h + 0.01, -d / 2 - 0.1],
          [w / 2 + 0.1, h + 0.01, -d / 2 - 0.1],
          [w / 2 + 0.1, h + 0.01, d / 2 + 0.1],
          [-w / 2 - 0.1, h + 0.01, d / 2 + 0.1],
        ],
        [0, 1, 0],
        tf,
        0xdfe8ec,
        { rawFill: 'rgba(200, 225, 238, 0.45)', doubleSided: true }
      );
      break;
    case 'steps': {
      const n = Math.max(2, Math.round(h / 0.13));
      for (let i = 0; i < n; i++) {
        const sh = ((i + 1) * h) / n;
        addBox(ctx, ref, w, sh, d / n, 0, sh / 2, d / 2 - ((i + 0.5) * d) / n, tf, 0x9aa1a6);
      }
      break;
    }
    case 'ramp':
      pushQuad(
        ctx,
        ref,
        [
          [-w / 2, 0, -d / 2],
          [w / 2, 0, -d / 2],
          [w / 2, h, d / 2],
          [-w / 2, h, d / 2],
        ],
        [0, 1, -h / Math.max(d, 0.1)],
        tf,
        0x9aa1a6,
        { doubleSided: true }
      );
      for (const sx of [-1, 1]) {
        addBox(ctx, ref, 0.03, 0.9, 0.03, sx * (w / 2 - 0.03), 0.45, -d / 2 + 0.05, tf, 0x2a2c2f);
        addBox(ctx, ref, 0.03, 0.9 + h, 0.03, sx * (w / 2 - 0.03), (0.9 + h) / 2, d / 2 - 0.05, tf, 0x2a2c2f);
      }
      break;
    case 'ext-stair': {
      const land = Math.min(1.0, d * 0.28);
      const run = d - land;
      addFlight(ctx, ref, w, run, h, -d / 2, 0, tf, 0x9aa1a6);
      addBox(ctx, ref, w, 0.06, land, 0, h - 0.03, d / 2 - land / 2, tf, 0x9aa1a6);
      for (const sx of [-1, 1]) {
        for (const sz of [d / 2 - 0.05, d / 2 - land + 0.05]) {
          addBox(ctx, ref, 0.07, h - 0.06, 0.07, sx * (w / 2 - 0.04), (h - 0.06) / 2, sz, tf, 0x2a2c2f);
        }
      }
      break;
    }
    case 'spiral':
      addSpiralStair(ctx, ref, w, h, tf);
      break;
    case 'balustrade':
      addGlassBalustrade(ctx, ref, -w / 2, 0, w / 2, 0, 0, h, tf);
      break;
    case 'screen':
      addBox(ctx, ref, w, h, 0.08, 0, h / 2, 0, tf, 0x7a5236);
      break;
    case 'planter':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0x8a4b2a);
      addBox(ctx, ref, w - 0.12, 0.18, d - 0.12, 0, h + 0.07, 0, tf, 0x4f7d3c);
      break;
    case 'hot-tub':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0x6d4a31);
      addBox(ctx, ref, w - 0.2, 0.04, d - 0.2, 0, h - 0.03, 0, tf, 0x6fa7b8);
      break;
    case 'column':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0x2a2c2f);
      addBox(ctx, ref, 0.35, 0.03, 0.35, 0, 0.015, 0, tf, 0x2a2c2f);
      break;
    case 'rain-tank':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0x3d5a45);
      break;
    case 'septic':
      addBox(ctx, ref, w, 0.1, d, 0, 0.05, 0, tf, 0xa9a59c);
      break;
    case 'generator':
      addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0x5e6468);
      break;
    default:
      if (p.kind === 'fitting') {
        buildFittingPart(
          ctx,
          ref,
          { ...it, x: 0.5, z: 0.5 },
          { id: 'site', name: '', preset: '20ft', len: 1, wid: 1, hgt: 2.4, cx: 0, cz: 0, rot: 0, level: 0, color: 'charcoal', items: [] },
          tf
        );
      } else {
        addBox(ctx, ref, w, h, d, 0, h / 2, 0, tf, 0xcccccc);
      }
      break;
  }
}

/* ---------------- Unit shell & parts ---------------- */

function buildUnitModel(
  ctx: BuildCtx,
  u: UnitModel,
  info: UnitLayoutInfo,
  opts: { roofOn: boolean; showRoofItems: boolean; lined: boolean }
) {
  const unitRef: SelRef = { t: 'unit', id: u.id };
  const ext = extOf(u);
  const iso = ISO[u.preset] && u.preset !== 'custom' ? ISO[u.preset] : null;
  const colorHex = hexOfColorId(u.color);
  const unitTf: Transform = {
    pos: [u.cx, BASE_Y + info.elev, u.cz],
    rot: u.rot || 0,
  };

  const xb = -ext.len / 2, xf = ext.len / 2;
  const zl = -ext.wid / 2, zr = ext.wid / 2;
  const yb = -FLOOR_DEPTH, yt = u.hgt + ROOF_DEPTH;

  // 1. Concrete foundation pads on ground level
  if ((u.level || 0) === 0) {
    const xs = ext.len > 7 ? [-1, 0, 1] : [-1, 1];
    for (const sx of xs) {
      for (const sz of [-1, 1]) {
        addBox(
          ctx,
          unitRef,
          0.6,
          PAD_H,
          0.6,
          sx * (ext.len / 2 - 0.22),
          yb - PAD_H / 2,
          sz * (ext.wid / 2 - 0.22),
          unitTf,
          0x9e9a91
        );
      }
    }
  }

  // 2. Floor deck & chassis base
  addBoxMM(ctx, unitRef, xb, yb, zl, xf, 0, zr, unitTf, 0x26282b, { k: 0.9 });
  pushQuad(
    ctx,
    unitRef,
    [
      [-u.len / 2, 0.002, -u.wid / 2],
      [u.len / 2, 0.002, -u.wid / 2],
      [u.len / 2, 0.002, u.wid / 2],
      [-u.len / 2, 0.002, u.wid / 2],
    ],
    [0, 1, 0],
    unitTf,
    opts.lined ? 0x9e7d56 : 0x8b6b45,
    { stroke: 'rgba(0,0,0,0.2)' }
  );

  // 3. Corner posts & castings
  const P = MEMBERS.post;
  const C = MEMBERS.casting;
  if (iso) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x0 = sx < 0 ? xb : xf - P.x;
        const z0 = sz < 0 ? zl : zr - P.z;
        addBoxMM(ctx, unitRef, x0, yb, z0, x0 + P.x, yt, z0 + P.z, unitTf, colorHex, { k: 0.92 });
        // Top & bottom ISO corner castings
        for (const top of [false, true]) {
          const cy0 = top ? yt - C.y : yb;
          addBoxMM(ctx, unitRef, x0 - 0.005, cy0, z0 - 0.005, x0 + P.x + 0.005, cy0 + C.y, z0 + P.z + 0.005, unitTf, colorHex, {
            k: 0.78,
          });
        }
      }
    }
  }

  const openings = u.items.filter((i) => i.kind === 'opening');
  const onWall = (w: WallId) => openings.filter((o) => o.wall === w);
  const cargoDoors = Boolean(iso) && onWall('front').length === 0;

  // 4. Four Walls with opening holes cut out
  const wallDefs: {
    id: WallId;
    span: number;
    n: P3;
    pt: (along: number, y: number, offset?: number) => P3;
  }[] = [
    {
      id: 'left',
      span: u.len,
      n: [0, 0, -1],
      pt: (a, y, off = 0) => [-u.len / 2 + a, y, zl - off],
    },
    {
      id: 'right',
      span: u.len,
      n: [0, 0, 1],
      pt: (a, y, off = 0) => [u.len / 2 - a, y, zr + off],
    },
    {
      id: 'front',
      span: u.wid,
      n: [1, 0, 0],
      pt: (a, y, off = 0) => [xf + off, y, -u.wid / 2 + a],
    },
    {
      id: 'back',
      span: u.wid,
      n: [-1, 0, 0],
      pt: (a, y, off = 0) => [xb - off, y, u.wid / 2 - a],
    },
  ];

  for (const w of wallDefs) {
    let rects = [{ x0: 0, x1: w.span, y0: 0, y1: u.hgt }];
    for (const o of onWall(w.id)) {
      const ow = o.w ?? PART[o.type]?.w ?? 1;
      const oh = o.h ?? PART[o.type]?.h ?? 1;
      const osill = o.sill ?? PART[o.type]?.sill ?? 0;
      const oalong = o.along ?? w.span / 2;
      rects = subtractRect(rects, {
        x0: oalong - ow / 2,
        x1: oalong + ow / 2,
        y0: osill,
        y1: osill + oh,
      });
    }

    const wallColor = iso ? colorHex : 0xecebe6;
    for (const r of rects) {
      // Outer wall face
      pushQuad(
        ctx,
        unitRef,
        [w.pt(r.x0, r.y0), w.pt(r.x1, r.y0), w.pt(r.x1, r.y1), w.pt(r.x0, r.y1)],
        w.n,
        unitTf,
        wallColor,
        { wall: w.id }
      );
      // Inner wall face (lined or bare inside)
      const inN: P3 = [-w.n[0], -w.n[1], -w.n[2]];
      pushQuad(
        ctx,
        unitRef,
        [w.pt(r.x1, r.y0, -0.04), w.pt(r.x0, r.y0, -0.04), w.pt(r.x0, r.y1, -0.04), w.pt(r.x1, r.y1, -0.04)],
        inN,
        unitTf,
        opts.lined ? 0xf1efea : wallColor,
        { k: opts.lined ? 0.96 : 0.82, wall: w.id }
      );
    }

    // Corrugation ribs on visible side walls of ISO containers
    if (iso && (w.id === 'left' || w.id === 'right')) {
      const worldN = rotY(w.n, unitTf.rot);
      if (normalVisible(worldN, ctx.cam)) {
        const pitch = 0.28;
        const ribW = 0.11;
        const wallOps = onWall(w.id);
        for (let a = 0.22; a < w.span - 0.25; a += pitch) {
          const hit = wallOps.some((o) => {
            const ow = o.w ?? PART[o.type]?.w ?? 1;
            const oalong = o.along ?? w.span / 2;
            return a + ribW > oalong - ow / 2 - 0.06 && a < oalong + ow / 2 + 0.06;
          });
          if (hit) continue;
          pushQuad(
            ctx,
            unitRef,
            [w.pt(a, 0.08, 0.012), w.pt(a + ribW, 0.08, 0.012), w.pt(a + ribW, u.hgt - 0.08, 0.012), w.pt(a, u.hgt - 0.08, 0.012)],
            w.n,
            unitTf,
            colorHex,
            { k: 0.84, stroke: 'none', depthBias: -0.01, wall: w.id }
          );
        }
      }
    }

    // Cargo door hardware on front end if intact
    if (w.id === 'front' && cargoDoors) {
      const worldN = rotY(w.n, unitTf.rot);
      if (normalVisible(worldN, ctx.cam)) {
        const mid = w.span / 2;
        pushQuad(
          ctx,
          unitRef,
          [w.pt(mid - 0.02, 0.06, 0.015), w.pt(mid + 0.02, 0.06, 0.015), w.pt(mid + 0.02, u.hgt - 0.06, 0.015), w.pt(mid - 0.02, u.hgt - 0.06, 0.015)],
          w.n,
          unitTf,
          0x1a1c1e,
          { depthBias: -0.015, wall: 'front' }
        );
        for (const rz of [0.38, 0.82, w.span - 0.82, w.span - 0.38]) {
          pushQuad(
            ctx,
            unitRef,
            [w.pt(rz - 0.016, 0.06, 0.022), w.pt(rz + 0.016, 0.06, 0.022), w.pt(rz + 0.016, u.hgt - 0.06, 0.022), w.pt(rz - 0.016, u.hgt - 0.06, 0.022)],
            w.n,
            unitTf,
            0xa8b0b6,
            { depthBias: -0.02, wall: 'front' }
          );
        }
      }
    }
  }

  // 5. Roof (if roofOn)
  if (opts.roofOn) {
    addBoxMM(ctx, unitRef, xb, u.hgt, zl, xf, yt, zr, unitTf, iso ? colorHex : 0xb5bbbf, { k: 0.94 });
  }

  // 6. Openings & placed items
  for (const it of u.items) {
    const itemRef: SelRef = { t: 'item', id: u.id, key: it.key };
    if (it.kind === 'opening') {
      buildOpeningInsert(ctx, itemRef, it, u, ext, unitTf, colorHex);
    } else if (it.kind === 'facade') {
      buildFacadePart(ctx, itemRef, it, u, ext, unitTf);
    } else if (it.kind === 'fitting') {
      buildFittingPart(ctx, itemRef, it, u, unitTf);
    } else if (it.kind === 'roof' && opts.showRoofItems) {
      buildRoofPart(ctx, itemRef, it, u, unitTf);
    }
  }
}

/* ---------------- Scene build & bounding box ---------------- */

export function sceneBounds(units: UnitModel[], site: PlacedItem[]) {
  if (!units.length && !site.length) {
    return { x0: -4, x1: 4, y0: 0, y1: 3, z0: -4, z1: 4 };
  }
  const layout = layoutUnits(units);
  let x0 = Infinity, x1 = -Infinity, y0 = 0, y1 = 2.8, z0 = Infinity, z1 = -Infinity;
  for (const u of units) {
    const r = unitRect(u);
    const info = layout.get(u.id);
    const ext = extOf(u);
    const top = BASE_Y + (info?.elev || 0) + ext.hgt;
    x0 = Math.min(x0, r.x0);
    x1 = Math.max(x1, r.x1);
    z0 = Math.min(z0, r.z0);
    z1 = Math.max(z1, r.z1);
    y1 = Math.max(y1, top);
  }
  for (const s of site) {
    const { dx, dz } = planSize(s);
    const sx = s.x ?? 0, sz = s.z ?? 0;
    const sh = (s.elev || 0) + (s.h ?? PART[s.type]?.h ?? 1);
    x0 = Math.min(x0, sx - dx / 2);
    x1 = Math.max(x1, sx + dx / 2);
    z0 = Math.min(z0, sz - dz / 2);
    z1 = Math.max(z1, sz + dz / 2);
    y1 = Math.max(y1, sh);
  }
  return { x0, x1, y0, y1, z0, z1 };
}

export function buildScene(
  state: {
    units: UnitModel[];
    site: PlacedItem[];
    showRoof: boolean;
    level: 'all' | number;
    spec?: Record<string, string>;
  },
  cam: Cam,
  w: number,
  h: number
) {
  const ctx: BuildCtx = { faces: [], cam, w, h, seq: 1 };
  const groundShadows: GroundShadow[] = [];
  const layout = layoutUnits(state.units);
  const lined = Boolean(state.spec?.interior && state.spec.interior !== 'none');
  const maxL = state.level === 'all' ? Infinity : state.level;

  for (const u of state.units) {
    const L = u.level || 0;
    if (L > maxL) continue;
    const info = layout.get(u.id) || {
      elev: 0,
      below: [],
      supported: true,
      aligned: true,
      overhang: 0,
      covered: 0,
      span: false,
    };
    const covered = info.covered > 0.5 && state.level === 'all';
    const cutHere = state.level !== 'all' && L === maxL;
    const roofOn = (state.showRoof && !cutHere) || covered;
    const showRoofItems = !(!state.showRoof || covered || cutHere);

    if (L === 0) {
      const r = unitRect(u);
      const sx = -LIGHT[0] * 1.1;
      const sz = -LIGHT[2] * 1.1;
      const pts: P3[] = [
        [r.x0 + sx, 0.005, r.z0 + sz],
        [r.x1 + sx, 0.005, r.z0 + sz],
        [r.x1 + sx, 0.005, r.z1 + sz],
        [r.x0 + sx, 0.005, r.z1 + sz],
      ];
      groundShadows.push({
        key: 'sh_' + u.id,
        pts: pts.map((p) => {
          const pr = project(p, cam, w, h);
          return [pr.x, pr.y];
        }),
        fill: 'rgba(0,0,0,0.22)',
      });
    }

    buildUnitModel(ctx, u, info, { roofOn, showRoofItems, lined });
  }

  for (const it of state.site) {
    if (state.level !== 'all' && (it.elev || 0) > 0.5 + state.level * 2.9) continue;
    buildSitePart(ctx, it);
  }

  ctx.faces.sort((a, b) => b.depth - a.depth);
  return { faces: ctx.faces, groundShadows, layout };
}

/* ---------------- Selection wireframe edges ---------------- */

function boxWireEdges(
  w: number,
  h: number,
  d: number,
  cx: number,
  cy: number,
  cz: number,
  tf: Transform,
  cam: Cam,
  sw: number,
  sh: number
): ScreenPoly[] {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const corners: P3[] = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  const proj = corners.map((p) => project(applyTf(p, tf), cam, sw, sh));
  const pairs = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return pairs.map(([a, b]) => [
    [proj[a].x, proj[a].y],
    [proj[b].x, proj[b].y],
  ]);
}

export function selectionEdges(
  sel: SelRef,
  units: UnitModel[],
  site: PlacedItem[],
  layout: Map<string, UnitLayoutInfo>,
  cam: Cam,
  sw: number,
  sh: number
): ScreenPoly[] {
  if (!sel) return [];
  if (sel.t === 'unit') {
    const u = units.find((x) => x.id === sel.id);
    if (!u) return [];
    const ext = extOf(u);
    const elev = layout.get(u.id)?.elev || 0;
    const tf: Transform = { pos: [u.cx, BASE_Y + elev, u.cz], rot: u.rot || 0 };
    return boxWireEdges(ext.len + 0.04, ext.hgt + 0.04, ext.wid + 0.04, 0, ext.hgt / 2 - FLOOR_DEPTH, 0, tf, cam, sw, sh);
  }
  if (sel.t === 'site') {
    const it = site.find((x) => x.key === sel.key);
    if (!it) return [];
    const p = PART[it.type];
    const w = it.w ?? p?.w ?? 1;
    const d = it.d ?? p?.d ?? 1;
    const h = it.h ?? p?.h ?? 1;
    const tf: Transform = { pos: [it.x ?? 0, it.elev || 0, it.z ?? 0], rot: it.rot || 0 };
    return boxWireEdges(w + 0.06, h + 0.06, d + 0.06, 0, h / 2, 0, tf, cam, sw, sh);
  }
  if (sel.t === 'item') {
    const u = units.find((x) => x.id === sel.id);
    const it = u?.items.find((x) => x.key === sel.key);
    if (!u || !it) return [];
    const p = PART[it.type];
    const ext = extOf(u);
    const elev = layout.get(u.id)?.elev || 0;
    const unitTf: Transform = { pos: [u.cx, BASE_Y + elev, u.cz], rot: u.rot || 0 };
    if (it.kind === 'opening' || it.kind === 'facade') {
      const w = it.w ?? p?.w ?? 1;
      const h = it.h ?? p?.h ?? 1;
      const sill = it.sill ?? p?.sill ?? 0;
      const proj = it.proj ?? p?.proj ?? 0.14;
      const tf = wallTransform(it.wall || 'left', it.along ?? 1, sill, u, ext, unitTf);
      return boxWireEdges(w + 0.08, h + 0.08, proj + 0.08, 0, h / 2, 0, tf, cam, sw, sh);
    }
    if (it.kind === 'roof') {
      const w = it.w ?? p?.w ?? 1;
      const d = it.d ?? p?.d ?? 1;
      const h = it.h ?? p?.h ?? 0.35;
      const tf = composeTf(unitTf, {
        pos: [(it.x ?? u.len / 2) - u.len / 2, u.hgt + ROOF_DEPTH, (it.z ?? u.wid / 2) - u.wid / 2],
        rot: 0,
      });
      return boxWireEdges(w + 0.06, h + 0.06, d + 0.06, 0, h / 2, 0, tf, cam, sw, sh);
    }
    // fitting
    const w = it.w ?? p?.w ?? 1;
    const d = it.d ?? p?.d ?? 1;
    const h = it.type === 'mezzanine' ? (it.deck ?? p?.deck ?? 1.8) + 0.9 : it.h ?? p?.h ?? 1;
    const mount = p?.mount || 0;
    const tf = composeTf(unitTf, {
      pos: [(it.x ?? u.len / 2) - u.len / 2, mount, (it.z ?? u.wid / 2) - u.wid / 2],
      rot: it.rot || 0,
    });
    return boxWireEdges(w + 0.05, h + 0.05, d + 0.05, 0, h / 2, 0, tf, cam, sw, sh);
  }
  return [];
}

export function inPoly(pt: [number, number], poly: number[][]) {
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
