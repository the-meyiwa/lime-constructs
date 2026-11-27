/* ============================================================
   Quote engine.

   Pure calculation: takes the geometry and specification from the
   planner and produces a priced bill of quantities. No DOM here, so
   the numbers can be reasoned about (and corrected) on their own.

   Convention used throughout, and stated in the UI so nobody has to
   guess: material carries the wastage allowance, labour does not.
   You pay for the offcut; you do not pay someone to fit it.
   ============================================================ */

import {
  SERVICES,
  LOGISTICS,
  defaultRateBook,
  elementsWith,
  type CustomMaterial,
  type RateBook,
  type UnitKey,
} from './container-catalog';
import { PART, UNIT_TYPE, extOf, layoutUnits, adjoiningPairs, type PlacedItem, type UnitModel } from './container-library';

const STUD_CENTRES = 0.6;   // metres

export type Quantities = {
  floorArea: number;
  perimeter: number;
  grossWallArea: number;
  openingArea: number;
  openingCount: number;
  glazingArea: number;
  interiorArea: number;
  exteriorArea: number;
  roofArea: number;
  envelopeArea: number;
  shellArea: number;
  paintArea: number;
  studLength: number;
  partitionArea: number;
  volume: number;
  supports: number;
  footprintArea: number;
  units: number;
  stacked: number;
  joins: number;
  transfers: number;
  overhang: number;
  fortyEquivalents: number;
};

function unitQuantities(state: UnitModel) {
  const { len, wid, hgt } = state;
  const items = state.items || [];

  const floorArea     = len * wid;
  const perimeter     = 2 * (len + wid);
  const grossWallArea = perimeter * hgt;

  const openings    = items.filter((i) => i.kind === 'opening');
  const openingArea = openings.reduce((s, o) => s + (o.w ?? 0) * (o.h ?? 0), 0);
  const glazingArea = openings.filter((o) => PART[o.type]?.glazed).reduce((s, o) => s + (o.w ?? 0) * (o.h ?? 0), 0);

  const netWallArea = Math.max(grossWallArea - openingArea, 0);

  const partitionArea = items
    .filter((i) => i.kind === 'fitting' && i.type === 'partition')
    .reduce((s, p) => s + Math.min(p.d ?? 2.35, wid) * Math.min(2.30, hgt) * 2, 0);

  const studLength = (perimeter / STUD_CENTRES + 4) * hgt + perimeter * 2;
  const ext = state.preset ? extOf(state) : { len: len + 0.16, wid: wid + 0.086 };

  return {
    floorArea,
    perimeter,
    grossWallArea,
    openingArea,
    openingCount: openings.length,
    glazingArea,

    interiorArea: netWallArea + partitionArea,
    exteriorArea: netWallArea,
    roofArea: floorArea,
    envelopeArea: netWallArea + floorArea,
    shellArea: grossWallArea + floorArea * 2,
    paintArea: netWallArea + partitionArea + floorArea,
    studLength,
    partitionArea,
    volume: floorArea * hgt,
    supports: len > 7 ? 6 : 4,
    footprintArea: ext.len * ext.wid,
  };
}

export function deriveQuantities(state: { units: UnitModel[] }): Quantities {
  const units = state.units || [];
  const layout = layoutUnits(units);
  const sum: Quantities = {
    floorArea: 0,
    perimeter: 0,
    grossWallArea: 0,
    openingArea: 0,
    openingCount: 0,
    glazingArea: 0,
    interiorArea: 0,
    exteriorArea: 0,
    roofArea: 0,
    envelopeArea: 0,
    shellArea: 0,
    paintArea: 0,
    studLength: 0,
    partitionArea: 0,
    volume: 0,
    supports: 0,
    footprintArea: 0,
    units: units.length,
    stacked: 0,
    joins: 0,
    transfers: 0,
    overhang: 0,
    fortyEquivalents: 0,
  };

  for (const u of units) {
    const q = unitQuantities(u);
    sum.floorArea += q.floorArea;
    sum.perimeter += q.perimeter;
    sum.grossWallArea += q.grossWallArea;
    sum.openingArea += q.openingArea;
    sum.openingCount += q.openingCount;
    sum.glazingArea += q.glazingArea;
    sum.interiorArea += q.interiorArea;
    sum.exteriorArea += q.exteriorArea;
    sum.roofArea += q.roofArea;
    sum.envelopeArea += q.envelopeArea;
    sum.shellArea += q.shellArea;
    sum.paintArea += q.paintArea;
    sum.studLength += q.studLength;
    sum.partitionArea += q.partitionArea;
    sum.volume += q.volume;
    sum.supports += q.supports;
    sum.footprintArea += q.footprintArea;

    const lv = u.level || 0;
    if (lv > 0) {
      sum.supports -= q.supports;
      sum.footprintArea -= q.footprintArea;
    }
    sum.roofArea -= Math.min(q.roofArea, layout.get(u.id)?.covered || 0);
  }

  sum.units = units.length;
  sum.stacked = units.filter((u) => (u.level || 0) > 0).length;
  sum.joins = adjoiningPairs(units).length;
  sum.transfers = units.filter((u) => (u.level || 0) > 0 && !layout.get(u.id)?.aligned).length;
  sum.overhang = units.reduce((s, u) => {
    const ov = layout.get(u.id)?.overhang || 0;
    return s + (ov >= 0.3 ? ov : 0);
  }, 0);
  sum.fortyEquivalents = units.reduce((s, u) => s + (extOf(u).len > 7 ? 1 : 0.5), 0);
  return sum;
}

export type QuoteLine = {
  id: string;
  group: string;
  name: string;
  unit: UnitKey;
  coverage: number | null;
  qty: number;
  wastage: number;
  chargeQty: number;
  rate: number;
  labour: number;
  materialCost: number;
  labourCost: number;
  total: number;
};

function priceLine({
  id,
  group,
  name,
  unit,
  coverage,
  qty,
  wastage,
  rate,
  labour,
}: {
  id: string;
  group: string;
  name: string;
  unit: UnitKey;
  coverage: number | null;
  qty: number;
  wastage: number;
  rate: number;
  labour: number;
}): QuoteLine {
  const safeQty     = Math.max(Number(qty) || 0, 0);
  const safeWastage = Math.max(Number(wastage) || 0, 0);

  let chargeQty = safeQty * (1 + safeWastage / 100);
  if (unit === 'sheet' || unit === 'each' || unit === 'trip') chargeQty = Math.ceil(chargeQty);

  const materialCost = chargeQty * (Number(rate) || 0);
  const labourCost   = safeQty  * (Number(labour) || 0);

  return {
    id,
    group,
    name,
    unit,
    coverage,
    qty: safeQty,
    wastage: safeWastage,
    chargeQty,
    rate: Number(rate) || 0,
    labour: Number(labour) || 0,
    materialCost,
    labourCost,
    total: materialCost + labourCost,
  };
}

function quantityFor(entry: { unit: UnitKey; coverage?: number | null }, area: number) {
  if (entry.unit === 'sheet' && entry.coverage) return area / entry.coverage;
  return area;
}

export type LineOverride = {
  name?: string;
  qty?: number;
  wastage?: number;
  rate?: number;
  labour?: number;
};

export type CustomLine = {
  id: string;
  name: string;
  unit: UnitKey;
  qty: number;
  wastage: number;
  rate: number;
  labour: number;
};

export type CommercialSettings = {
  overheadPct: number;
  profitPct: number;
  contingencyPct: number;
  vatPct: number;
  discount: number;
  validityDays?: number;
  depositPct?: number;
};

export type QuoteStateInput = {
  units: UnitModel[];
  site?: PlacedItem[];
  spec?: Record<string, string>;
  services?: Record<string, number>;
  logistics?: Record<string, number>;
  customMaterials?: CustomMaterial[];
  customLines?: CustomLine[];
  commercial?: Partial<CommercialSettings>;
};

export function buildQuote(
  state: QuoteStateInput,
  rateBook: Partial<RateBook> = {},
  opts: { overrides?: Record<string, LineOverride>; removed?: string[] } = {}
) {
  const q = deriveQuantities(state);
  const elements = elementsWith(state.customMaterials ?? []);
  const book: RateBook = { ...defaultRateBook(state.customMaterials ?? []), ...(rateBook as RateBook) };
  const spec = state.spec || {};
  const overrides = opts.overrides || {};
  const removed = new Set(opts.removed || []);

  const lines: QuoteLine[] = [];

  const push = (id: string, entry: RateBook[string] | undefined, qty: number, extra: { group?: string } = {}) => {
    if (!entry || removed.has(id)) return;
    const ov = overrides[id] || {};
    const finalQty  = ov.qty !== undefined ? ov.qty : qty;
    const finalRate = ov.rate !== undefined ? ov.rate : entry.rate;
    const finalLab  = ov.labour !== undefined ? ov.labour : entry.labour;
    if (finalQty <= 0) return;
    if (finalRate === 0 && finalLab === 0 && ov.rate === undefined && ov.labour === undefined) return;

    lines.push(
      priceLine({
        id,
        group: extra.group || entry.group || 'Other',
        name: ov.name ?? entry.name,
        unit: entry.unit,
        coverage: entry.coverage,
        qty: finalQty,
        wastage: ov.wastage !== undefined ? ov.wastage : entry.wastage,
        rate: finalRate,
        labour: finalLab,
      })
    );
  };

  const units = state.units || [];
  const allItems = units.flatMap((u) => u.items || []);
  const nothingBuilt = !units.length && !(state.site || []).length;
  if (nothingBuilt) {
    for (const c of state.customLines || []) {
      if (removed.has(c.id)) continue;
      lines.push(
        priceLine({
          id: c.id,
          group: 'Additional items',
          name: c.name,
          unit: c.unit,
          coverage: null,
          qty: c.qty,
          wastage: c.wastage,
          rate: c.rate,
          labour: c.labour,
        })
      );
    }
    return { quantities: q, lines, totals: totalsFor(lines, state.commercial) };
  }

  for (const el of elements) {
    const chosen = spec[el.id];
    if (!chosen || chosen === 'none') continue;
    if (el.id === 'shell') {
      const counts = new Map<string, number>();
      for (const u of units) {
        const base = UNIT_TYPE[u.preset]?.shell || 'fabricate';
        const opt =
          chosen === 'client'
            ? 'client'
            : base === 'fabricate'
            ? 'fabricate'
            : chosen.startsWith('new-')
            ? base.replace('buy-', 'new-')
            : base;
        const qty = opt === 'fabricate' ? u.len * u.wid : 1;
        counts.set(opt, (counts.get(opt) || 0) + qty);
      }
      for (const [opt, qty] of counts) {
        const key = `shell:${opt}`;
        push(key, book[key], qty, { group: el.name });
      }
      continue;
    }
    const key = `${el.id}:${chosen}`;
    const entry = book[key];
    if (!entry) continue;

    const option = el.options.find((o) => o.id === chosen);
    const driver = option?.driverOverride || el.driver;

    let baseQty: number;
    if (driver === 'each') baseQty = 1;
    else baseQty = quantityFor(entry, (q as Record<string, number>)[driver] ?? 0);

    push(key, entry, baseQty, { group: el.name });
  }

  /* --- parts placed in the model: openings, fittings, facade, roof, site --- */
  const placed = [...allItems, ...(state.site || []).map((i) => ({ ...i, kind: 'site' as const }))];
  const tally = new Map<string, number>();
  const add = (key: string, qty: number) => tally.set(key, (tally.get(key) || 0) + qty);
  let railing = 0;
  for (const it of placed) {
    const p = PART[it.type];
    const key = `${it.kind}:${it.type}`;
    if (!p || !book[key]) continue;
    const w = it.w ?? p.w ?? 1, d = it.d ?? p.d ?? 1, h = it.h ?? p.h ?? 1;
    let qty = 1;
    if (it.type === 'partition') qty = Math.min(it.d ?? 2.35, 2.35) * Math.min(2.30, h ?? 2.3) * 2;
    else if (p.unit === 'area') qty = p.isWall ? d * h : it.kind === 'opening' || it.kind === 'facade' ? w * h : w * d;
    else if (p.unit === 'length') qty = p.lengthOf === 'd' ? d : w;
    else if (p.unit === 'panel' && p.panel) qty = Math.max(1, Math.floor(w / p.panel.w)) * Math.max(1, Math.floor(d / p.panel.d));
    add(key, qty);
    if (p.railing) railing += Math.max(0, 2 * (w + d) - 1.0);
  }
  for (const [key, qty] of tally) push(key, book[key], qty, { group: book[key].group });
  const reinforced = allItems.filter((i) => i.kind === 'opening' && !PART[i.type]?.open).length;
  if (reinforced > 0) push('opening:reinforce', book['opening:reinforce'], reinforced, { group: 'Doors & windows' });

  /* --- how the units go together --- */
  push('works:stack', book['works:stack'], q.stacked);
  push('works:join', book['works:join'], q.joins);
  push('works:transfer', book['works:transfer'], q.transfers);
  push('works:cantilever', book['works:cantilever'], q.overhang * 2);
  push('works:railing', book['works:railing'], railing);

  /* --- services --- */
  for (const s of SERVICES) {
    const key = `service:${s.id}`;
    const entry = book[key];
    if (!entry) continue;
    const manual = state.services?.[s.id];
    let qty: number;
    if (manual !== undefined) qty = manual;
    else if (s.autoFrom) qty = (q as Record<string, number>)[s.autoFrom] ?? 0;
    else qty = s.auto ? s.auto(q.floorArea) : 0;
    push(key, entry, qty, { group: 'Services & installations' });
  }

  /* --- logistics --- */
  for (const l of LOGISTICS) {
    const key = `logistics:${l.id}`;
    const entry = book[key];
    if (!entry) continue;
    let qty = state.logistics?.[l.id] ?? l.qty;
    if (state.logistics?.[l.id] === undefined) {
      if (l.id === 'haulage') qty = Math.ceil(q.fortyEquivalents || 1);
      if (l.id === 'offload') qty = q.stacked ? 2 : 1;
    }
    push(key, entry, qty, { group: 'Logistics' });
  }

  /* --- user-added lines --- */
  for (const c of state.customLines || []) {
    if (removed.has(c.id)) continue;
    const ov = overrides[c.id] || {};
    lines.push(
      priceLine({
        id: c.id,
        group: 'Additional items',
        name: ov.name ?? c.name,
        unit: c.unit,
        coverage: null,
        qty: ov.qty ?? c.qty,
        wastage: ov.wastage ?? c.wastage,
        rate: ov.rate ?? c.rate,
        labour: ov.labour ?? c.labour,
      })
    );
  }

  return { quantities: q, lines, totals: totalsFor(lines, state.commercial) };
}

export function totalsFor(lines: QuoteLine[], commercial: Partial<CommercialSettings> = {}) {
  const material = lines.reduce((s, l) => s + l.materialCost, 0);
  const labour   = lines.reduce((s, l) => s + l.labourCost, 0);
  const prime    = material + labour;

  const overheadPct    = Number(commercial.overheadPct) || 0;
  const profitPct      = Number(commercial.profitPct) || 0;
  const contingencyPct = Number(commercial.contingencyPct) || 0;
  const vatPct         = Number(commercial.vatPct) || 0;
  const discount       = Number(commercial.discount) || 0;

  const overhead    = (prime * overheadPct) / 100;
  const contingency = (prime * contingencyPct) / 100;
  const profit      = ((prime + overhead + contingency) * profitPct) / 100;

  const beforeDiscount = prime + overhead + contingency + profit;
  const netTotal = Math.max(beforeDiscount - discount, 0);
  const vat = (netTotal * vatPct) / 100;

  return {
    material,
    labour,
    prime,
    overhead,
    contingency,
    profit,
    discount,
    netTotal,
    vat,
    grandTotal: netTotal + vat,
  };
}

export function groupLines(lines: QuoteLine[]) {
  const groups = new Map<string, QuoteLine[]>();
  for (const l of lines) {
    if (!groups.has(l.group)) groups.set(l.group, []);
    groups.get(l.group)!.push(l);
  }
  return [...groups.entries()].map(([name, items]) => ({
    name,
    items,
    subtotal: items.reduce((s, i) => s + i.total, 0),
  }));
}

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'ZAR';

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: 'NGN', symbol: '₦', label: 'NGN — Nigerian Naira (₦)' },
  { code: 'USD', symbol: '$', label: 'USD — US Dollar ($)' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound (£)' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro (€)' },
  { code: 'GHS', symbol: '₵', label: 'GHS — Ghanaian Cedi (₵)' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR — South African Rand (R)' },
];

export function money(amount: number, currency: string = 'NGN'): string {
  const found = CURRENCIES.find((c) => c.code === currency);
  const sym = found ? found.symbol : '₦';
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return sym + safe.toLocaleString('en-US');
}

export function num(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
