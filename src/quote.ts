import { CURRENCIES, EXTRAS, FITOUT, FLOOR, OPENING_TYPES, TYPE } from './data';
import { unsupportedCorners } from './geo';
import type { CurrencyCode, ProjectMeta, Unit } from './types';

export type Line = {
  category: 'shell' | 'fitout' | 'openings' | 'structural' | 'systems';
  label: string;
  detail: string;
  amount: number;
};

export const formatMoney = (n: number, currency: CurrencyCode = 'NGN') => {
  const c = CURRENCIES[currency] || CURRENCIES.NGN;
  const val = Math.round(n * c.rate);
  return c.symbol + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatCompact = (n: number, currency: CurrencyCode = 'NGN') => {
  const c = CURRENCIES[currency] || CURRENCIES.NGN;
  const val = n * c.rate;
  if (val >= 1_000_000) return c.symbol + (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return c.symbol + Math.round(val / 1_000) + 'k';
  return c.symbol + Math.round(val);
};

export const ng = (n: number) => formatMoney(n, 'NGN');

export function unitArea(u: Unit) {
  const t = TYPE[u.type] || TYPE['20ft'];
  return t.len * t.wid;
}

export function buildQuote(units: Unit[]) {
  const lines: Line[] = [];

  for (const u of units) {
    const t = TYPE[u.type] || TYPE['20ft'];
    const tag = (u.label ? u.label + ' (' + t.short + ')' : t.short) + ' · L' + (u.level + 1);
    const area = unitArea(u);

    // 1. Base Container / Cabin Shell
    lines.push({
      category: 'shell',
      label: t.name + ' shell',
      detail: tag + ' · Corten structural shell & exterior finish',
      amount: t.price,
    });

    // 2. Interior Fit-Out & MEP Spec
    const fit = FITOUT[u.fitout || 'raw'] || FITOUT.raw;
    if (fit.id !== 'raw') {
      const fitCost = Math.round(area * fit.ratePerM2 + fit.mepFlat);
      lines.push({
        category: 'fitout',
        label: fit.name + ' fit-out & MEP',
        detail: tag + ' · ' + area.toFixed(1) + ' m² thermal lining, flooring & electrical/plumbing',
        amount: fitCost,
      });
    }

    // 3. Openings + Structural Lintel Steel for wide spans
    for (const o of u.openings) {
      lines.push({
        category: 'openings',
        label: o.label,
        detail: tag + ' · ' + o.wall + ' wall (' + o.w.toFixed(2) + '×' + o.h.toFixed(2) + ' m @ ' + o.along.toFixed(2) + ' m)',
        amount: o.rate,
      });
      if (o.w >= 1.8) {
        const lintel = Math.round(o.w * EXTRAS.headerSteelPerM);
        lines.push({
          category: 'structural',
          label: 'RHS steel lintel & frame',
          detail: tag + ' · reinforcement header for ' + o.w.toFixed(1) + ' m ' + o.label.toLowerCase(),
          amount: lintel,
        });
      }
    }

    // 4. Foundations (ground level) vs Twist-Lock Stacking + Cantilever Steel Columns (upper levels)
    if (u.level === 0) {
      const padCount = t.len > 9 ? 6 : 4;
      lines.push({
        category: 'structural',
        label: padCount + '× RC foundation pads',
        detail: tag + ' · reinforced concrete pad footings & anchor plates',
        amount: padCount * EXTRAS.foundationPerPad,
      });
      lines.push({
        category: 'structural',
        label: 'Haulage & HIAB offload',
        detail: tag + ' · ground-level site placement',
        amount: EXTRAS.transportGround,
      });
    } else {
      lines.push({
        category: 'structural',
        label: 'Crane lift & twist-lock set',
        detail: tag + ' · inter-box corner casting locks & mobile crane rig',
        amount: EXTRAS.craneUpper + EXTRAS.twistLockSet,
      });
      const cols = unsupportedCorners(u, units);
      if (cols.length > 0) {
        lines.push({
          category: 'structural',
          label: cols.length + '× Steel support columns',
          detail: tag + ' · SHS structural steel posts & footings for cantilevered corners',
          amount: cols.length * EXTRAS.supportColumn,
        });
      }
    }

    // 5. Optional Systems & Extras (Roof Deck, External Staircase, Solar Package)
    if (u.roofDeck) {
      lines.push({
        category: 'systems',
        label: 'Roof terrace deck & balustrade',
        detail: tag + ' · ' + area.toFixed(1) + ' m² composite decking + perimeter rail',
        amount: Math.round(area * EXTRAS.roofDeckPerM2),
      });
    }
    if (u.stairs) {
      lines.push({
        category: 'systems',
        label: 'External galvanized steel stair',
        detail: tag + ' · fabricated tread flight & landing balustrade',
        amount: EXTRAS.externalStair,
      });
    }
    if (u.solar) {
      lines.push({
        category: 'systems',
        label: '3.5 kVA Solar & LiFePO4 pack',
        detail: tag + ' · 4× 450W roof array, hybrid inverter & battery bank',
        amount: EXTRAS.solarPackage,
      });
    }
  }

  const base = lines.reduce((a, l) => a + l.amount, 0);
  const labour = Math.round(base * EXTRAS.labourPct);
  const subtotal = base + labour;
  const vat = Math.round(subtotal * EXTRAS.vatPct);
  const total = subtotal + vat;
  const area = units.reduce((a, u) => a + unitArea(u), 0);

  const byCategory = {
    shell: lines.filter((l) => l.category === 'shell').reduce((a, l) => a + l.amount, 0),
    fitout: lines.filter((l) => l.category === 'fitout').reduce((a, l) => a + l.amount, 0),
    openings: lines.filter((l) => l.category === 'openings').reduce((a, l) => a + l.amount, 0),
    structural: lines.filter((l) => l.category === 'structural').reduce((a, l) => a + l.amount, 0),
    systems: lines.filter((l) => l.category === 'systems').reduce((a, l) => a + l.amount, 0),
  };

  return {
    lines,
    byCategory,
    base,
    labour,
    subtotal,
    vat,
    total,
    costPerM2: area > 0 ? Math.round(total / area) : 0,
    area,
    units: units.length,
    levels: units.length ? Math.max(...units.map((u) => u.level)) + 1 : 0,
  };
}

export function quoteText(units: Unit[], meta?: ProjectMeta) {
  const q = buildQuote(units);
  const cur: CurrencyCode = meta?.currency || 'NGN';
  const fmt = (n: number) => formatMoney(n, cur);
  const rows = q.lines.map((l) => (l.label + ' [' + l.detail.split(' · ')[0] + ']').padEnd(42) + ' ' + fmt(l.amount));

  const header = [
    'LIME CONSTRUCTS — ARCHITECTURAL CONTAINER BOQ',
    meta?.name ? 'Project: ' + meta.name : 'Container Build Estimate',
    meta?.client ? 'Client:  ' + meta.client : null,
    meta?.site ? 'Site:    ' + meta.site : null,
    'Date:    ' + new Date().toDateString(),
  ].filter(Boolean);

  return [
    ...header,
    '------------------------------------------------------------',
    q.units + ' units · ' + q.levels + ' levels · ' + q.area.toFixed(1) + ' m² (' + fmt(q.costPerM2) + '/m²)',
    '',
    'UNIT SCHEDULE',
    ...units.map((u, idx) => {
      const t = TYPE[u.type] || TYPE['20ft'];
      const fit = FITOUT[u.fitout || 'raw'] || FITOUT.raw;
      const extras = [u.roofDeck && 'Roof Deck', u.stairs && 'Ext. Stair', u.solar && 'Solar Pack'].filter(Boolean).join(', ');
      return (
        '  ' +
        (idx + 1) +
        '. ' +
        (u.label || t.name) +
        ' (' +
        t.short +
        ', L' +
        (u.level + 1) +
        ') — ' +
        fit.name +
        ', ' +
        u.openings.length +
        ' openings' +
        (extras ? ' [' + extras + ']' : '')
      );
    }),
    '',
    'ITEMIZED BILL OF QUANTITIES',
    ...rows,
    '------------------------------------------------------------',
    'Materials & Fabrication'.padEnd(42) + ' ' + fmt(q.base),
    'Site Assembly & Labour (12%)'.padEnd(42) + ' ' + fmt(q.labour),
    'Subtotal'.padEnd(42) + ' ' + fmt(q.subtotal),
    'VAT (7.5%)'.padEnd(42) + ' ' + fmt(q.vat),
    'TOTAL ESTIMATE'.padEnd(42) + ' ' + fmt(q.total),
    '',
    meta?.notes ? 'Notes: ' + meta.notes : 'Indicative estimate. Corner castings & lintel spans require site engineer sign-off.',
  ].join('\n');
}

export { OPENING_TYPES, FLOOR };
