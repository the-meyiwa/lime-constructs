import type { Cam, Unit, Wall } from './types';
import { FLOOR, TYPE, shellColor, shellG } from './data';

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

export function screenDeltaToWorldXZ(dx: number, dy: number, cam: Cam, w: number, h: number): [number, number] {
  const f = Math.min(w, h) * 1.2;
  const s = Math.max(1, (f / Math.max(cam.dist, 1)) * FIT);
  const dxc = dx / s;
  const dyc = -dy / s;
  const sinEl = Math.max(0.22, Math.abs(Math.sin(cam.el))) * (cam.el >= 0 ? 1 : -1);
  const ca = Math.cos(cam.az);
  const sa = Math.sin(cam.az);
  const dX = ca * dxc - (sa / sinEl) * dyc;
  const dZ = -sa * dxc - (ca / sinEl) * dyc;
  return [dX, dZ];
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

// Directional sunlight vector from upper-left
export const LIGHT: P3 = (() => {
  const v: P3 = [-0.45, 0.85, 0.35];
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
})();

export function normalVisible(n: P3, cam: Cam) {
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  const v = [ce * Math.sin(cam.az), se, ce * Math.cos(cam.az)];
  return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 0;
}

/**
 * Realistic Corten steel and material shading:
 * combines ambient skylight (0.42), direct sun diffuse (0.58), and subtle metallic specular lift.
 */
export function shadeColor(rgb: [number, number, number], n: P3, lift = 0) {
  const dot = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const factor = clamp(0.38 + 0.62 * dot + lift, 0.12, 1.45);
  const r = Math.round(clamp(rgb[0] * factor, 0, 255));
  const g = Math.round(clamp(rgb[1] * factor, 0, 255));
  const b = Math.round(clamp(rgb[2] * factor, 0, 255));
  return `rgb(${r},${g},${b})`;
}

export function shade(base: number, n: P3, lift = 0) {
  const dot = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const v = clamp(0.12 + base * (0.54 + 0.52 * dot) + lift, 0, 1);
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
  strokeWidth?: number;
  opacity?: number;
  depth: number;
  hidden?: boolean;
  line?: number;
};

export type GroundShadow = {
  key: string;
  pts: number[][];
  fill: string;
  opacity?: number;
};

export function unitBox(u: Unit) {
  const t = TYPE[u.type] || TYPE['20ft'];
  const y0 = u.level * FLOOR;
  const L = u.rot ? t.wid : t.len;
  const W = u.rot ? t.len : t.wid;
  return { x0: u.x, z0: u.z, y0, L, W, H: t.hgt };
}

function q(
  key: string,
  unit: string,
  pts: P3[],
  n: P3,
  rgb: [number, number, number],
  cam: Cam,
  w: number,
  h: number,
  lift = 0,
  stroke = 'rgba(0,0,0,0.22)',
  strokeWidth = 0.7
) {
  const proj = pts.map((p) => project(p, cam, w, h));
  const depth = proj.reduce((a, p) => a + p.d, 0) / proj.length;
  return {
    key,
    unit,
    pts: proj.map((p) => [p.x, p.y]),
    fill: shadeColor(rgb, n, lift),
    stroke,
    strokeWidth,
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

export function wallPointOffset(id: Wall, u: number, v: number, box: ReturnType<typeof unitBox>, offset: number): P3 {
  const p = wallPoint(id, u, v, box);
  if (id === 'front') return [p[0] + offset, p[1], p[2]];
  if (id === 'back') return [p[0] - offset, p[1], p[2]];
  if (id === 'left') return [p[0], p[1], p[2] - offset];
  return [p[0], p[1], p[2] + offset];
}

export function wallLen(id: Wall, box: ReturnType<typeof unitBox>) {
  return id === 'front' || id === 'back' ? box.W : box.L;
}

export function unsupportedCorners(u: Unit, allUnits: Unit[]): [number, number][] {
  if (u.level === 0) return [];
  const box = unitBox(u);
  const corners: [number, number][] = [
    [box.x0 + 0.08, box.z0 + 0.08],
    [box.x0 + box.L - 0.08, box.z0 + 0.08],
    [box.x0 + box.L - 0.08, box.z0 + box.W - 0.08],
    [box.x0 + 0.08, box.z0 + box.W - 0.08],
  ];
  const lower = allUnits.filter((x) => x.level === u.level - 1).map(unitBox);
  return corners.filter(
    ([cx, cz]) => !lower.some((b) => cx >= b.x0 - 0.05 && cx <= b.x0 + b.L + 0.05 && cz >= b.z0 - 0.05 && cz <= b.z0 + b.W + 0.05)
  );
}

export function buildScene(units: Unit[], cam: Cam, w: number, h: number, selected: string | null) {
  const faces: Face[] = [];
  const groundShadows: GroundShadow[] = [];

  // 1. Realistic ground contact and sun shadows for ground-level containers
  for (const u of units) {
    if (u.level === 0) {
      const box = unitBox(u);
      const { x0, z0, L, W, H } = box;

      // Dark contact ambient occlusion shadow directly under chassis
      const aoPad = 0.04;
      const aoCorners: P3[] = [
        [x0 - aoPad, 0.005, z0 - aoPad],
        [x0 + L + aoPad, 0.005, z0 - aoPad],
        [x0 + L + aoPad, 0.005, z0 + W + aoPad],
        [x0 - aoPad, 0.005, z0 + W + aoPad],
      ];
      groundShadows.push({
        key: u.id + '_ao',
        pts: aoCorners.map((p) => {
          const pr = project(p, cam, w, h);
          return [pr.x, pr.y];
        }),
        fill: '#040506',
        opacity: 0.65,
      });

      // Directional sun shadow cast along ground plane
      const sx = -LIGHT[0] * (H * 0.42);
      const sz = -LIGHT[2] * (H * 0.42);
      const sunCorners: P3[] = [
        [x0, 0.003, z0],
        [x0 + sx, 0.003, z0 + sz],
        [x0 + L + sx, 0.003, z0 + sz],
        [x0 + L + sx, 0.003, z0 + W + sz],
        [x0 + L, 0.003, z0 + W],
        [x0, 0.003, z0 + W],
      ];
      groundShadows.push({
        key: u.id + '_sun_shadow',
        pts: sunCorners.map((p) => {
          const pr = project(p, cam, w, h);
          return [pr.x, pr.y];
        }),
        fill: 'rgba(0,0,0,0.3)',
      });
    }
  }

  // 2. Build 3D Container Bodies with corrugation, castings, posts and doors
  for (const u of units) {
    const box = unitBox(u);
    const rgb = shellColor(u.color);
    const castingRgb: [number, number, number] = [48, 52, 58];
    const railRgb: [number, number, number] = [Math.round(rgb[0] * 0.88), Math.round(rgb[1] * 0.88), Math.round(rgb[2] * 0.88)];

    // WALLS
    for (const wall of WALLS) {
      const len = wallLen(wall.id, box);
      const holes = u.openings
        .filter((o) => o.wall === wall.id)
        .map((o) => [o.along - o.w / 2, o.sill, o.along + o.w / 2, o.sill + o.h] as [number, number, number, number]);

      // Base wall panels
      const rects = splitWall(len, box.H, holes);
      for (let ri = 0; ri < rects.length; ri++) {
        const [u0, v0, u1, v1] = rects[ri];
        faces.push(
          q(
            u.id + '_' + wall.id + '_' + ri,
            u.id,
            [
              wallPoint(wall.id, u0, v0, box),
              wallPoint(wall.id, u1, v0, box),
              wallPoint(wall.id, u1, v1, box),
              wallPoint(wall.id, u0, v1, box),
            ],
            wall.n,
            rgb,
            cam,
            w,
            h
          )
        );
      }

      // Vertical corrugated ribs on visible side walls (left & right)
      const isSideWall = wall.id === 'left' || wall.id === 'right';
      if (isSideWall && normalVisible(wall.n, cam)) {
        const fluteStep = 0.28;
        const fluteW = 0.14;
        const fluteH0 = 0.16;
        const fluteH1 = box.H - 0.14;

        for (let fp = 0.22; fp < len - 0.25; fp += fluteStep) {
          const fu0 = fp;
          const fu1 = fp + fluteW;
          const collides = holes.some(([hu0, hv0, hu1, hv1]) => fu1 > hu0 - 0.05 && fu0 < hu1 + 0.05 && fluteH1 > hv0 && fluteH0 < hv1);
          if (collides) continue;

          // Raised flute face
          const fluteFace: P3[] = [
            wallPointOffset(wall.id, fu0, fluteH0, box, 0.025),
            wallPointOffset(wall.id, fu1, fluteH0, box, 0.025),
            wallPointOffset(wall.id, fu1, fluteH1, box, 0.025),
            wallPointOffset(wall.id, fu0, fluteH1, box, 0.025),
          ];

          faces.push(
            q(
              u.id + '_' + wall.id + '_flute_' + fp.toFixed(2),
              u.id,
              fluteFace,
              wall.n,
              rgb,
              cam,
              w,
              h,
              0.08,
              'rgba(0,0,0,0.18)',
              0.5
            )
          );
        }
      }

      // Cargo Doors on Front wall (if no wide cutouts)
      const isFront = wall.id === 'front';
      const hasCutoutOnFront = u.openings.some((o) => o.wall === 'front' && (o.kind === 'cutout' || o.w > 1.8));
      if (isFront && !hasCutoutOnFront && normalVisible(wall.n, cam)) {
        // Vertical split line between the dual doors
        const doorY0 = 0.16;
        const doorY1 = box.H - 0.14;
        const midZ = len / 2;

        // Center rubber seal strip
        const seal: P3[] = [
          wallPointOffset('front', midZ - 0.02, doorY0, box, 0.015),
          wallPointOffset('front', midZ + 0.02, doorY0, box, 0.015),
          wallPointOffset('front', midZ + 0.02, doorY1, box, 0.015),
          wallPointOffset('front', midZ - 0.02, doorY1, box, 0.015),
        ];
        faces.push(
          q(u.id + '_door_seal', u.id, seal, wall.n, [24, 26, 28], cam, w, h, 0, '#101214')
        );

        // 4 Galvanized Steel Vertical Locking Rods
        const rodPositions = [0.42, 0.88, len - 0.88, len - 0.42];
        for (let rIdx = 0; rIdx < rodPositions.length; rIdx++) {
          const rz = rodPositions[rIdx];
          const rw = 0.028;
          const rod: P3[] = [
            wallPointOffset('front', rz - rw / 2, 0.1, box, 0.038),
            wallPointOffset('front', rz + rw / 2, 0.1, box, 0.038),
            wallPointOffset('front', rz + rw / 2, box.H - 0.08, box, 0.038),
            wallPointOffset('front', rz - rw / 2, box.H - 0.08, box, 0.038),
          ];
          faces.push(
            q(u.id + '_rod_' + rIdx, u.id, rod, wall.n, [185, 192, 198], cam, w, h, 0.22, '#485058', 0.6)
          );

          // Cam keepers top and bottom
          for (const ky of [0.08, box.H - 0.1]) {
            const camKeeper: P3[] = [
              wallPointOffset('front', rz - 0.035, ky - 0.03, box, 0.046),
              wallPointOffset('front', rz + 0.035, ky - 0.03, box, 0.046),
              wallPointOffset('front', rz + 0.035, ky + 0.03, box, 0.046),
              wallPointOffset('front', rz - 0.035, ky + 0.03, box, 0.046),
            ];
            faces.push(
              q(u.id + '_keeper_' + rIdx + '_' + ky.toFixed(1), u.id, camKeeper, wall.n, [55, 60, 68], cam, w, h, 0.15)
            );
          }

          // Door handles with high-vis yellow/lime grip at 1.15m
          const handle: P3[] = [
            wallPointOffset('front', rz - 0.02, 1.1, box, 0.05),
            wallPointOffset('front', rz + 0.18, 1.1, box, 0.05),
            wallPointOffset('front', rz + 0.18, 1.16, box, 0.05),
            wallPointOffset('front', rz - 0.02, 1.16, box, 0.05),
          ];
          faces.push(
            q(u.id + '_handle_' + rIdx, u.id, handle, wall.n, [201, 242, 77], cam, w, h, 0.3, '#101214', 0.8)
          );
        }

        // Industrial door hinges on each side post
        for (const hz of [0.12, len - 0.12]) {
          for (const hy of [0.35, 1.0, 1.65, 2.3]) {
            const hinge: P3[] = [
              wallPointOffset('front', hz - 0.025, hy - 0.04, box, 0.028),
              wallPointOffset('front', hz + 0.025, hy - 0.04, box, 0.028),
              wallPointOffset('front', hz + 0.025, hy + 0.04, box, 0.028),
              wallPointOffset('front', hz - 0.025, hy + 0.04, box, 0.028),
            ];
            faces.push(
              q(u.id + '_hinge_' + hz.toFixed(2) + '_' + hy.toFixed(2), u.id, hinge, wall.n, [44, 48, 54], cam, w, h, 0.1)
            );
          }
        }
      }

      // Openings (Windows, Doors, Cutouts) with 3D structural frames & tinted glazing
      for (const o of u.openings.filter((x) => x.wall === wall.id)) {
        if (o.kind === 'cutout') continue; // Walk-through void

        const u0 = o.along - o.w / 2;
        const u1 = o.along + o.w / 2;
        const v0 = o.sill;
        const v1 = o.sill + o.h;

        // Perimeter structural steel box frame (reveal)
        const frameThick = 0.045;
        const frameOuter: P3[] = [
          wallPointOffset(wall.id, u0 - frameThick, v0 - frameThick, box, 0.015),
          wallPointOffset(wall.id, u1 + frameThick, v0 - frameThick, box, 0.015),
          wallPointOffset(wall.id, u1 + frameThick, v1 + frameThick, box, 0.015),
          wallPointOffset(wall.id, u0 - frameThick, v1 + frameThick, box, 0.015),
        ];
        faces.push(
          q(u.id + '_frame_' + o.id, u.id, frameOuter, wall.n, [38, 42, 48], cam, w, h, 0.1, '#1A1C20', 1)
        );

        // Tinted architectural glass
        const glassPts: P3[] = [
          wallPoint(wall.id, u0, v0, box),
          wallPoint(wall.id, u1, v0, box),
          wallPoint(wall.id, u1, v1, box),
          wallPoint(wall.id, u0, v1, box),
        ];
        const glassColor: [number, number, number] = o.kind === 'door' ? [28, 46, 68] : [32, 64, 94];
        faces.push(
          q(u.id + '_glass_' + o.id, u.id, glassPts, wall.n, glassColor, cam, w, h, 0.28, 'rgba(200,230,255,0.4)', 0.8)
        );

        // Window/door mullions for wide sliders & bi-folds
        if (o.w >= 1.9) {
          const panels = o.w > 3.0 ? 3 : 2;
          for (let m = 1; m < panels; m++) {
            const mu = u0 + (o.w * m) / panels;
            const mullion: P3[] = [
              wallPointOffset(wall.id, mu - 0.02, v0, box, 0.01),
              wallPointOffset(wall.id, mu + 0.02, v0, box, 0.01),
              wallPointOffset(wall.id, mu + 0.02, v1, box, 0.01),
              wallPointOffset(wall.id, mu - 0.02, v1, box, 0.01),
            ];
            faces.push(
              q(u.id + '_mullion_' + o.id + '_' + m, u.id, mullion, wall.n, [32, 35, 40], cam, w, h, 0.1)
            );
          }
        }
      }
    }

    // Top structural header & bottom chassis rails
    const { x0, z0, y0, L, W, H } = box;

    // Roof & Floor
    faces.push(
      q(
        u.id + '_roof',
        u.id,
        [
          [x0, y0 + H, z0],
          [x0 + L, y0 + H, z0],
          [x0 + L, y0 + H, z0 + W],
          [x0, y0 + H, z0 + W],
        ],
        [0, 1, 0],
        u.roofDeck ? [128, 92, 64] : railRgb,
        cam,
        w,
        h,
        0.18,
        'rgba(0,0,0,0.2)'
      ),
      q(
        u.id + '_floor',
        u.id,
        [
          [x0, y0, z0],
          [x0, y0, z0 + W],
          [x0 + L, y0, z0 + W],
          [x0 + L, y0, z0],
        ],
        [0, -1, 0],
        [32, 34, 38],
        cam,
        w,
        h,
        -0.2
      )
    );

    // 8 ISO 1161 Corner Castings
    const cSizeX = 0.16;
    const cSizeZ = 0.16;
    const cSizeY = 0.13;
    const cornerOffsets: [number, number, number][] = [
      [x0, y0, z0],
      [x0 + L - cSizeX, y0, z0],
      [x0 + L - cSizeX, y0, z0 + W - cSizeZ],
      [x0, y0, z0 + W - cSizeZ],
      [x0, y0 + H - cSizeY, z0],
      [x0 + L - cSizeX, y0 + H - cSizeY, z0],
      [x0 + L - cSizeX, y0 + H - cSizeY, z0 + W - cSizeZ],
      [x0, y0 + H - cSizeY, z0 + W - cSizeZ],
    ];

    for (let ci = 0; ci < cornerOffsets.length; ci++) {
      const [cx, cy, cz] = cornerOffsets[ci];
      const isTop = cy > y0 + 1;
      const cNorm: P3 = isTop ? [0, 1, 0] : [0, -1, 0];
      if (normalVisible(cNorm, cam)) {
        faces.push(
          q(
            u.id + '_casting_' + ci,
            u.id,
            [
              [cx, cy + (isTop ? cSizeY : 0), cz],
              [cx + cSizeX, cy + (isTop ? cSizeY : 0), cz],
              [cx + cSizeX, cy + (isTop ? cSizeY : 0), cz + cSizeZ],
              [cx, cy + (isTop ? cSizeY : 0), cz + cSizeZ],
            ],
            cNorm,
            castingRgb,
            cam,
            w,
            h,
            0.12,
            'rgba(0,0,0,0.3)',
            0.8
          )
        );
      }
    }

    // Solar package
    if (u.solar) {
      const insetX = Math.min(0.8, L * 0.15);
      const insetZ = Math.min(0.45, W * 0.18);
      const sy = y0 + H + 0.05;
      const proj = (
        [
          [x0 + insetX, sy, z0 + insetZ],
          [x0 + L - insetX, sy, z0 + insetZ],
          [x0 + L - insetX, sy, z0 + W - insetZ],
          [x0 + insetX, sy, z0 + W - insetZ],
        ] as P3[]
      ).map((p) => project(p, cam, w, h));
      faces.push({
        key: u.id + '_solar',
        unit: u.id,
        pts: proj.map((p) => [p.x, p.y]),
        fill: '#122034',
        stroke: '#5894D8',
        strokeWidth: 1.2,
        depth: proj.reduce((a, p) => a + p.d, 0) / proj.length - 0.05,
        hidden: !normalVisible([0, 1, 0], cam),
      });
    }
  }

  return { faces, groundShadows };
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
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  return edgesIdx.map(([a, b]) => [
    [pts[a].x, pts[a].y],
    [pts[b].x, pts[b].y],
  ]) as ScreenPoly[];
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
  const out: { pts: number[][]; stroke: string; strokeWidth?: number }[] = [];
  const line = (a: P3, b: P3, stroke: string, strokeWidth = 1) => {
    const pa = project(a, cam, w, h);
    const pb = project(b, cam, w, h);
    out.push({ pts: [[pa.x, pa.y], [pb.x, pb.y]], stroke, strokeWidth });
  };

  for (const u of units) {
    const box = unitBox(u);

    // Roof pressed ribs across the roof width
    if (normalVisible([0, 1, 0], cam)) {
      const ribStep = 0.5;
      for (let rx = box.x0 + 0.35; rx < box.x0 + box.L - 0.35; rx += ribStep) {
        line(
          [rx, box.y0 + box.H + 0.005, box.z0 + 0.12],
          [rx, box.y0 + box.H + 0.005, box.z0 + box.W - 0.12],
          'rgba(0,0,0,0.22)',
          1
        );
      }
    }

    // Roof deck railing & plank lines
    if (u.roofDeck) {
      const { x0, z0, y0, L, W, H } = box;
      const ry = y0 + H;
      const rail = ry + 0.95;
      const railColor = 'rgba(201,242,77,0.55)';
      const corners: P3[] = [
        [x0, ry, z0],
        [x0 + L, ry, z0],
        [x0 + L, ry, z0 + W],
        [x0, ry, z0 + W],
      ];
      const topCorners: P3[] = [
        [x0, rail, z0],
        [x0 + L, rail, z0],
        [x0 + L, rail, z0 + W],
        [x0, rail, z0 + W],
      ];
      for (let i = 0; i < 4; i++) {
        line(corners[i], topCorners[i], railColor, 1.4);
        line(topCorners[i], topCorners[(i + 1) % 4], railColor, 1.4);
        // Middle balustrade wire
        line(
          [corners[i][0], ry + 0.48, corners[i][2]],
          [corners[(i + 1) % 4][0], ry + 0.48, corners[(i + 1) % 4][2]],
          'rgba(201,242,77,0.3)',
          0.8
        );
      }
    }

    // External staircase lines
    if (u.stairs) {
      const { x0, z0, y0, W } = box;
      const sy1 = y0 + FLOOR;
      const sx = x0 - 0.15;
      const sz0 = z0 + Math.min(0.3, W * 0.1);
      const sz1 = sz0 + 0.95;
      const run = 2.4;
      const stairColor = 'rgba(201,242,77,0.7)';
      line([sx, sy1, sz0], [sx - run, y0, sz0], stairColor, 1.5);
      line([sx, sy1, sz1], [sx - run, y0, sz1], stairColor, 1.5);
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = sx - run * t;
        const py = sy1 * (1 - t) + y0 * t;
        line([px, py, sz0], [px, py, sz1], stairColor, 1.2);
      }
    }

    // Cantilever support columns for unsupported upper corners
    const cols = unsupportedCorners(u, units);
    for (const [cx, cz] of cols) {
      line([cx, 0, cz], [cx, box.y0, cz], 'rgba(255,190,100,0.85)', 1.8);
    }
  }
  return out;
}

export type DimensionLine = {
  a: [number, number];
  b: [number, number];
  label: string;
  x: number;
  y: number;
  accent?: boolean;
};

export function dimensionOverlay(
  units: Unit[],
  cam: Cam,
  w: number,
  h: number,
  selectedId: string | null,
  imperial = false
): DimensionLine[] {
  if (!units.length) return [];
  const fmt = (m: number) => (imperial ? (m * 3.28084).toFixed(1) + ' ft' : m.toFixed(2) + ' m');
  const boxes = units.map(unitBox);
  const minX = Math.min(...boxes.map((b) => b.x0));
  const maxX = Math.max(...boxes.map((b) => b.x0 + b.L));
  const minZ = Math.min(...boxes.map((b) => b.z0));
  const maxZ = Math.max(...boxes.map((b) => b.z0 + b.W));

  const out: DimensionLine[] = [];
  const addDim = (p0: P3, p1: P3, label: string, accent = false) => {
    const a = project(p0, cam, w, h);
    const b = project(p1, cam, w, h);
    out.push({
      a: [a.x, a.y],
      b: [b.x, b.y],
      label,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - 6,
      accent,
    });
  };

  // Overall footprint X and Z dimensions
  addDim([minX, 0, maxZ + 0.9], [maxX, 0, maxZ + 0.9], 'Total X: ' + fmt(maxX - minX));
  addDim([minX - 0.9, 0, minZ], [minX - 0.9, 0, maxZ], 'Total Z: ' + fmt(maxZ - minZ));

  // Selected unit dimensions
  if (selectedId) {
    const su = units.find((u) => u.id === selectedId);
    if (su) {
      const b = unitBox(su);
      addDim([b.x0, b.y0, b.z0 - 0.45], [b.x0 + b.L, b.y0, b.z0 - 0.45], fmt(b.L), true);
      addDim([b.x0 + b.L + 0.45, b.y0, b.z0], [b.x0 + b.L + 0.45, b.y0, b.z0 + b.W], fmt(b.W), true);
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
