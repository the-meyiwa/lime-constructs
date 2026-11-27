/* ============================================================
   TOOLBOX — Shipping-container structural model

   Real ISO container data and a preliminary structural check for
   container buildings, shared by the design engine and the Container
   Builder. Pure: no DOM, no three.js.
   ============================================================ */

import type { PlacedItem, WallId } from './container-library';

const G = 9.81;
const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/* ---------------- ISO data ---------------- */

export const FLOOR_DEPTH = 0.155;
export const ROOF_DEPTH = 0.043;

export type IsoSpec = {
  code: string;
  ext: { len: number; wid: number; hgt: number };
  tare: number;
  maxGross: number;
  door: { w: number; h: number };
  forkPockets: boolean;
};

export const ISO: Record<string, IsoSpec> = {
  '10ft': { code: '1D', ext: { len: 2.991, wid: 2.438, hgt: 2.591 }, tare: 1300, maxGross: 10160, door: { w: 2.34, h: 2.28 }, forkPockets: false },
  '20ft': { code: '22G1', ext: { len: 6.058, wid: 2.438, hgt: 2.591 }, tare: 2230, maxGross: 30480, door: { w: 2.34, h: 2.28 }, forkPockets: true },
  '40ft': { code: '42G1', ext: { len: 12.192, wid: 2.438, hgt: 2.591 }, tare: 3750, maxGross: 30480, door: { w: 2.34, h: 2.28 }, forkPockets: false },
  '40hc': { code: '45G1', ext: { len: 12.192, wid: 2.438, hgt: 2.896 }, tare: 3900, maxGross: 30480, door: { w: 2.34, h: 2.585 }, forkPockets: false },
  '45hc': { code: 'L5G1', ext: { len: 13.716, wid: 2.438, hgt: 2.896 }, tare: 4800, maxGross: 32500, door: { w: 2.34, h: 2.585 }, forkPockets: false },
};

export const RATINGS = {
  stackingKg: 192000,
  postTestKn: 848,
  transverseRackingKn: 150,
  longitudinalRackingKn: 75,
  roofPointKg: 300,
  floorAxleKg: 7260,
  sideWallFraction: 0.6,
  endWallFraction: 0.4,
};

export const SKIN = {
  side: { t: 1.6, pitch: 0.278, depth: 0.036, outer: 0.072, inner: 0.068 },
  end: { t: 2.0, pitch: 0.232, depth: 0.045, outer: 0.064, inner: 0.06 },
  roof: { t: 2.0, pitch: 0.2, depth: 0.02, outer: 0.07, inner: 0.07 },
  door: { t: 2.0, pitch: 0.25, depth: 0.03, outer: 0.07, inner: 0.07 },
};

export const MEMBERS = {
  post: { x: 0.16, z: 0.12 },
  casting: { x: 0.178, y: 0.118, z: 0.162 },
  bottomRail: { h: 0.162, d: 0.05 },
  topRail: { h: 0.06, d: 0.06 },
  doorHeader: { h: 0.13 },
  crossMember: { h: 0.122, w: 0.045, pitch: 0.3 },
};

export function isoFor(size: string) {
  return ISO[size] || null;
}

export function externalDims(m: { size: string; len: number; wid: number; hgt: number }) {
  const iso = ISO[m.size];
  if (iso && m.size !== 'custom') return { ...iso.ext };
  return { len: r3(m.len + 0.12), wid: r3(m.wid + 0.12), hgt: r3(m.hgt + FLOOR_DEPTH + ROOF_DEPTH) };
}

/* ---------------- steel sections (S275) ---------------- */

export const RHS = [
  { name: 'RHS 100 × 50 × 4', kgm: 8.59, Z: 29.2, I: 146 },
  { name: 'RHS 120 × 60 × 5', kgm: 12.7, Z: 51.6, I: 310 },
  { name: 'RHS 150 × 100 × 5', kgm: 18.6, Z: 111, I: 832 },
  { name: 'RHS 200 × 100 × 6', kgm: 26.4, Z: 202, I: 2020 },
  { name: 'RHS 250 × 150 × 8', kgm: 47.7, Z: 485, I: 6060 },
  { name: 'UB 305 × 165 × 40', kgm: 40.3, Z: 561, I: 8500 },
  { name: 'UB 406 × 178 × 60', kgm: 60.1, Z: 1060, I: 21600 },
];
const FY = 275;
const E_STEEL = 210000;

export type BeamSizing = {
  spanM: number;
  lineLoadKnm: number;
  momentKnm: number;
  requiredZcm3: number;
  requiredIcm4: number;
  section: string;
  utilisation: number | null;
};

export function sizeBeam(L: number, w: number, wS = w / 1.45, { limit = 360 } = {}): BeamSizing {
  const M = (w * L * L) / 8;
  const Zreq = (M * 1e6) / (FY / 1.0) / 1e3;
  const Ireq = (5 * wS * Math.pow(L * 1000, 4)) / (384 * E_STEEL * ((L * 1000) / limit)) / 1e4;
  const pick = RHS.find((s) => s.Z >= Zreq && s.I >= Ireq);
  return {
    spanM: r2(L),
    lineLoadKnm: r2(w),
    momentKnm: r2(M),
    requiredZcm3: r1(Zreq),
    requiredIcm4: r0(Ireq),
    section: pick ? pick.name : 'Beyond the table: needs an engineer-designed beam',
    utilisation: pick ? r2(Math.max(Zreq / pick.Z, Ireq / pick.I)) : null,
  };
}

/* ---------------- loads ---------------- */

export const IMPOSED: Record<string, number> = {
  home: 1.5,
  bunkhouse: 1.5,
  office: 2.5,
  'site-office': 2.5,
  clinic: 2.5,
  salon: 2.5,
  classroom: 3.0,
  cafe: 3.0,
  shop: 4.0,
  kiosk: 4.0,
  gatehouse: 2.5,
  ablution: 2.0,
  storage: 5.0,
  default: 2.5,
  roofDeck: 3.0,
  roofMaintenance: 0.75,
};
const FITOUT_KNM2 = 0.6;
const ROOF_DECK_DEAD = 0.45;
const GAMMA_G = 1.35, GAMMA_Q = 1.5;

export const DEFAULT_BASIS = {
  windSpeed: 38,
  soilBearing: 100,
  exposure: 1.0,
};

export type StructureModuleInput = {
  id: string;
  name: string;
  size: string;
  len: number;
  wid: number;
  hgt: number;
  x: number;
  z: number;
  rot: number;
  level: number;
  items: PlacedItem[];
};

const wallLength = (m: StructureModuleInput, wall: WallId) => (wall === 'front' || wall === 'back' ? m.wid : m.len);

function solidRuns(span: number, openings: PlacedItem[]) {
  const cuts = openings
    .map((o) => [Math.max(0, (o.along ?? 0) - (o.w ?? 0) / 2), Math.min(span, (o.along ?? 0) + (o.w ?? 0) / 2)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const runs: number[] = [];
  let at = 0;
  for (const [a, b] of cuts) {
    if (a > at) runs.push(a - at);
    at = Math.max(at, b);
  }
  if (span > at) runs.push(span - at);
  return runs;
}

export type StructureWarning = { level: 'warn' | 'bad'; text: string };

export type ModuleStructureResult = {
  id: string;
  name: string;
  size: string;
  iso: { code?: string; ext: { len: number; wid: number; hgt: number }; tareKg: number; maxGrossKg?: number };
  walls: Record<string, { spanM: number; openings: number; removedM: number; removedPct: number; longestSolidM: number }>;
  lintels: ({ wall: WallId; opening: string } & BeamSizing)[];
  notes: string[];
  racking: {
    transverse: { demandKn: number; capacityKn: number; ratio: number };
    longitudinal: { demandKn: number; capacityKn: number; ratio: number };
  };
  stacking?: {
    unitsAbove: number;
    superimposedKg: number;
    perPostKg: number;
    ratedKg: number;
    utilisation: number;
    aligned: boolean;
    transferBeam?: BeamSizing;
  };
  roofDeck?: {
    imposedKnm2: number;
    joistSpacingM: number;
    joist: BeamSizing;
  };
  overturning?: {
    windPressureKnm2: number;
    lateralKn: number;
    upliftKn: number;
    weightKn: number;
    safety: number;
    anchorPerCornerKn: number;
  };
  footings?: {
    supports: number;
    serviceLoadPerPadKn: number;
    soilBearingKpa: number;
    padSideM: number;
    padDepthM: number;
  };
  status: 'ok' | 'close' | 'needs-engineer';
};

export function checkStructure(
  design: { modules: StructureModuleInput[]; roofs?: { kind: string; module: string }[]; use?: string },
  basisIn: Partial<typeof DEFAULT_BASIS> = {}
) {
  const basis = { ...DEFAULT_BASIS, ...basisIn };
  const q = (0.613 * basis.windSpeed ** 2 * basis.exposure) / 1000;
  const warnings: StructureWarning[] = [];
  const mods = design.modules || [];
  const liveFloor = IMPOSED[design.use || 'default'] ?? IMPOSED.default;
  const out: ModuleStructureResult[] = [];

  const footprint = (m: StructureModuleInput) => {
    const L = m.rot === 90 ? m.wid : m.len, W = m.rot === 90 ? m.len : m.wid;
    return { x0: m.x, x1: m.x + L, z0: m.z, z1: m.z + W };
  };
  const overlap = (a: { x0: number; x1: number; z0: number; z1: number }, b: { x0: number; x1: number; z0: number; z1: number }) =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

  const selfMass = (m: StructureModuleInput) => {
    const iso = ISO[m.size];
    const area = m.len * m.wid;
    const shell = iso ? iso.tare : area * 180 + 600;
    return { shellKg: shell, fitoutKg: (area * FITOUT_KNM2 * 1000) / G, liveKn: area * liveFloor };
  };

  for (const m of mods) {
    const iso = ISO[m.size];
    const ext = externalDims(m);
    const fp = footprint(m);
    const above = mods.filter((u) => u.level > m.level && overlap(footprint(u), fp) > 0.5);
    const roofDeck = (design.roofs || []).find((r) => r.kind === 'deck' && r.module === m.id);
    const openings = (m.items || []).filter((i) => i.kind === 'opening');
    const self = selfMass(m);
    const res: ModuleStructureResult = {
      id: m.id,
      name: m.name,
      size: m.size,
      iso: iso ? { code: iso.code, ext, tareKg: iso.tare, maxGrossKg: iso.maxGross } : { ext, tareKg: r0(self.shellKg) },
      walls: {},
      lintels: [],
      notes: [],
      racking: {
        transverse: { demandKn: 0, capacityKn: 1, ratio: 0 },
        longitudinal: { demandKn: 0, capacityKn: 1, ratio: 0 },
      },
      status: 'ok',
    };

    /* --- 1. openings and lintels --- */
    const upperLine = (() => {
      const half = m.wid / 2;
      let gk = 0.3 * half + 0.2;
      let qk = IMPOSED.roofMaintenance * half;
      if (roofDeck) {
        gk += ROOF_DECK_DEAD * half;
        qk = IMPOSED.roofDeck * half;
      }
      for (const u of above) {
        const us = selfMass(u);
        const perM = 1 / (2 * u.len);
        gk += (((us.shellKg + us.fitoutKg) * G) / 1000) * perM;
        qk += us.liveKn * perM;
      }
      return { gk, qk, uls: GAMMA_G * gk + GAMMA_Q * qk, sls: gk + qk };
    })();

    for (const wall of ['left', 'right', 'front', 'back'] as WallId[]) {
      const span = wallLength(m, wall);
      const on = openings.filter((o) => o.wall === wall);
      const removed = on.reduce((s, o) => s + Math.min(o.w ?? 0, span), 0);
      const runs = solidRuns(span, on);
      const fraction = span ? removed / span : 0;
      const w = {
        spanM: r2(span),
        openings: on.length,
        removedM: r2(removed),
        removedPct: r0(fraction * 100),
        longestSolidM: r2(runs.length ? Math.max(...runs) : 0),
      };
      res.walls[wall] = w;
      if (!on.length || !iso) continue;
      const side = wall === 'left' || wall === 'right';
      for (const o of on) {
        if (o.type === 'vent') continue;
        const ow = o.w ?? 0;
        const oalong = o.along ?? 0;
        const near = Math.min(oalong - ow / 2, span - (oalong + ow / 2));
        if (side && near < 0.29) {
          warnings.push({
            level: 'warn',
            text: `The ${o.type.replace(/-/g, ' ')} on the ${wall} wall of ${m.name} is within 300 mm of a corner post; keep cut-outs clear of the posts and castings.`,
          });
        }
        if (side && ow > 1.2) {
          const b = sizeBeam(ow + 0.2, upperLine.uls, upperLine.sls);
          res.lintels.push({ wall, opening: o.type, ...b });
        }
      }
      if (side && fraction > 0.5) {
        warnings.push({
          level: 'warn',
          text: `${w.removedPct}% of the ${wall} wall of ${m.name} is cut away. The corrugated wall no longer works as a deep beam: add steel posts at each cut edge and a continuous top beam, sized by an engineer.`,
        });
      } else if (side && removed > 0) {
        res.notes.push(`Frame every cut in the ${wall} wall with welded RHS 100 × 50 × 4 (posts, head and sill) tied into the top and bottom rails.`);
      }
      if (!side && wall === 'front' && on.length) {
        res.notes.push('The cargo doors come off where the front is glazed or fitted with a door: keep the door header and corner posts, and brace the end with the new frame.');
      }
    }

    /* --- 2. racking under wind --- */
    const endFactor = (wall: WallId) => {
      const W = res.walls[wall];
      if (!W || !W.openings) return wall === 'front' && iso ? 0.85 : 1;
      return Math.max(0.15, 1 - W.removedPct / 100) * (wall === 'front' ? 0.6 : 1);
    };
    const sideFactor = (wall: WallId) => {
      const W = res.walls[wall];
      if (!W || !W.openings) return 1;
      return Math.max(0.1, Math.min(1, (W.longestSolidM / Math.max(W.spanM, 0.1)) * 1.2));
    };
    const Cf = 1.3;
    const transDemand = GAMMA_Q * q * Cf * ext.len * ext.hgt * (1 + above.length);
    const longDemand = GAMMA_Q * q * Cf * ext.wid * ext.hgt * (1 + above.length);
    const transCap = iso ? (RATINGS.transverseRackingKn * (endFactor('front') + endFactor('back'))) / 2 : 40;
    const longCap = iso ? (RATINGS.longitudinalRackingKn * (sideFactor('left') + sideFactor('right'))) / 2 : 25;
    res.racking = {
      transverse: { demandKn: r1(transDemand), capacityKn: r1(transCap), ratio: r2(transDemand / transCap) },
      longitudinal: { demandKn: r1(longDemand), capacityKn: r1(longCap), ratio: r2(longDemand / longCap) },
    };
    if (res.racking.transverse.ratio > 1) {
      warnings.push({
        level: 'warn',
        text: `${m.name} could rack sideways in a ${basis.windSpeed} m/s wind with its end walls opened up; add a welded portal frame or cross-bracing at the open end.`,
      });
    }
    if (res.racking.longitudinal.ratio > 1) {
      warnings.push({
        level: 'warn',
        text: `${m.name}’s long walls are too cut up to resist wind along its length; add braced bays or a steel portal frame.`,
      });
    }

    /* --- 3. stacking --- */
    if (above.length) {
      let massKg = 0;
      for (const u of above) {
        const us = selfMass(u);
        massKg += us.shellKg + us.fitoutKg + (us.liveKn * 1000) / G;
      }
      if (roofDeck) massKg += ((ROOF_DECK_DEAD + IMPOSED.roofDeck) * m.len * m.wid * 1000) / G;
      const aligned = above.every(
        (u) => u.size === m.size && u.rot === m.rot && Math.abs(u.x - m.x) < 0.05 && Math.abs(u.z - m.z) < 0.05
      );
      res.stacking = {
        unitsAbove: above.length,
        superimposedKg: r0(massKg),
        perPostKg: r0(massKg / 4),
        ratedKg: RATINGS.stackingKg,
        utilisation: r3(massKg / RATINGS.stackingKg),
        aligned,
      };
      if (!aligned) {
        const b = sizeBeam(Math.min(m.len, 6), (GAMMA_G * 2.5 + GAMMA_Q * liveFloor) * 1.2, 3.5);
        res.stacking.transferBeam = b;
        warnings.push({
          level: 'warn',
          text: `The unit above ${m.name} does not land on its corner castings; carry it on a steel transfer beam (about ${b.section}) bearing on the corner posts.`,
        });
      } else {
        res.notes.push('Lock the stacked corners with twist-locks or welded bridge plates at all four castings.');
      }
    }

    /* --- 4. roof deck --- */
    if (roofDeck) {
      const joist = sizeBeam(
        m.wid + 0.1,
        (GAMMA_G * ROOF_DECK_DEAD + GAMMA_Q * IMPOSED.roofDeck) * 0.6,
        (ROOF_DECK_DEAD + IMPOSED.roofDeck) * 0.6,
        { limit: 300 }
      );
      res.roofDeck = { imposedKnm2: IMPOSED.roofDeck, joistSpacingM: 0.6, joist };
      res.notes.push(
        `Roof deck: the container roof sheet only takes ${RATINGS.roofPointKg} kg on a small area, so lay steel joists (${joist.section} at 600 mm) across the top side rails and fix the deck to them.`
      );
    }

    /* --- 5. uplift, overturning and anchoring (ground units) --- */
    if (m.level === 0) {
      const top = mods.filter((u) => u.level > 0 && overlap(footprint(u), fp) > 0.5);
      const stackMass = top.reduce((s, u) => s + (ISO[u.size]?.tare ?? selfMass(u).shellKg), 0);
      const Wk = ((self.shellKg + self.fitoutKg + stackMass) * G) / 1000;
      const H = ext.hgt * (1 + top.length);
      const lateral = q * Cf * ext.len * H;
      const uplift = q * 0.9 * ext.len * ext.wid * (top.length ? 0.6 : 1);
      const overturn = (lateral * H) / 2 + (uplift * ext.wid) / 2;
      const restore = (0.9 * Wk * ext.wid) / 2;
      const factor = restore / Math.max(overturn * GAMMA_Q, 0.01);
      const anchorKn = Math.max(0, (overturn * GAMMA_Q - restore) / ext.wid / 2);
      res.overturning = {
        windPressureKnm2: r2(q),
        lateralKn: r1(lateral),
        upliftKn: r1(uplift),
        weightKn: r1(Wk),
        safety: r2(factor),
        anchorPerCornerKn: r1(anchorKn),
      };
      if (factor < 1) {
        warnings.push({
          level: 'warn',
          text: `${m.name} is light for its height in a ${basis.windSpeed} m/s wind: anchor each windward corner (about ${r1(anchorKn)} kN per corner) with twist-lock plates cast into the footings.`,
        });
      } else {
        res.notes.push('Anchor the corner castings to the footings with cast-in plates or twist-lock bases; it also stops the unit walking.');
      }

      /* --- 6. footings --- */
      const floorKn = GAMMA_G * Wk + GAMMA_Q * (self.liveKn + top.reduce((s, u) => s + selfMass(u).liveKn, 0));
      const supports = ext.len > 7 ? 6 : 4;
      const perPad = floorKn / supports / 1.4;
      const area = (perPad * 1.1) / basis.soilBearing;
      const side = Math.max(0.6, Math.ceil(Math.sqrt(area) * 20) / 20);
      res.footings = {
        supports,
        serviceLoadPerPadKn: r1(perPad),
        soilBearingKpa: basis.soilBearing,
        padSideM: r2(side),
        padDepthM: 0.45,
      };
    }

    /* --- 7. floor --- */
    if (liveFloor > 4) {
      res.notes.push(
        `Floor: ${liveFloor} kN/m² imposed load suits the container floor (rated for a ${RATINGS.floorAxleKg} kg forklift axle); spread heavy point loads with a steel plate.`
      );
    }

    const ratios = [
      res.racking.transverse.ratio,
      res.racking.longitudinal.ratio,
      res.stacking?.utilisation ?? 0,
      ...res.lintels.map((l) => l.utilisation ?? 2),
    ];
    res.status =
      ratios.some((v) => v > 1) || res.lintels.some((l) => l.utilisation == null)
        ? 'needs-engineer'
        : ratios.some((v) => v > 0.8)
        ? 'close'
        : 'ok';
    out.push(res);
  }

  const worst = out.some((r) => r.status === 'needs-engineer')
    ? 'needs-engineer'
    : out.some((r) => r.status === 'close')
    ? 'close'
    : 'ok';
  return {
    basis: {
      ...basis,
      velocityPressureKnm2: r2(q),
      imposedFloorKnm2: liveFloor,
      steel: 'S275',
      partialFactors: { permanent: GAMMA_G, imposed: GAMMA_Q },
    },
    modules: out,
    summary: {
      status: worst,
      text:
        worst === 'ok'
          ? 'Preliminary checks pass with the framing, anchors and footings listed.'
          : worst === 'close'
          ? 'Preliminary checks pass, but some members are close to their limit.'
          : 'Some parts need an engineer-designed frame before building.',
    },
    warnings,
    disclaimer:
      'Preliminary sizing from ISO 1496-1 ratings and standard load rules. A structural engineer must check the final design against the local code (in Nigeria, the National Building Code) and the actual site.',
  };
}
