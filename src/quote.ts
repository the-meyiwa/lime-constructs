import { EXTRAS, FLOOR, OPENING_TYPES, TYPE } from './data';
import { FURN } from './furniture';
import type { Unit } from './types';

export type Line = { label: string; detail: string; amount: number };

const ng = (n: number) =>
  'N' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export { ng };

export function unitArea(u: Unit) {
  const t = TYPE[u.type];
  return t.len * t.wid;
}

export function buildQuote(units: Unit[]) {
  const lines: Line[] = [];

  for (const u of units) {
    const t = TYPE[u.type];
    const tag = 'L' + (u.level + 1);
    lines.push({ label: t.name, detail: tag + ' · shell and fit-out', amount: t.price });
    for (const o of u.openings) {
      lines.push({ label: o.label, detail: t.short + ' ' + tag + ' · ' + o.wall + ' wall', amount: o.rate });
    }
    for (const it of u.items) {
      const f = FURN[it.kind];
      if (f) lines.push({ label: f.name, detail: t.short + ' ' + tag + ' · fit-out', amount: f.price });
    }
    lines.push({ label: 'Foundation pad', detail: t.short + ' ' + tag, amount: EXTRAS.foundation });
    lines.push({ label: 'Delivery and lift', detail: t.short + ' ' + tag, amount: EXTRAS.transport });
  }

  const base = lines.reduce((a, l) => a + l.amount, 0);
  const labour = Math.round(base * EXTRAS.labourPct);
  const subtotal = base + labour;
  const vat = Math.round(subtotal * EXTRAS.vatPct);

  return {
    lines,
    base,
    labour,
    subtotal,
    vat,
    total: subtotal + vat,
    area: units.reduce((a, u) => a + unitArea(u), 0),
    units: units.length,
    levels: units.length ? Math.max(...units.map((u) => u.level)) + 1 : 0,
    fitOut: units.reduce((a, u) => a + u.items.reduce((b, i) => b + (FURN[i.kind]?.price || 0), 0), 0),
    pieces: units.reduce((a, u) => a + u.items.length, 0),
  };
}

export function quoteText(units: Unit[]) {
  const q = buildQuote(units);
  const rows = q.lines.map((l) => l.label.padEnd(26) + ' ' + ng(l.amount));
  return [
    'LIME CONSTRUCTS',
    'Container build estimate',
    new Date().toDateString(),
    '',
    q.units + ' units · ' + q.levels + ' levels · ' + q.area.toFixed(1) + ' m2',
    q.pieces + ' pieces of fit-out',
    '',
    ...rows,
    '',
    'Labour (12%)'.padEnd(26) + ' ' + ng(q.labour),
    'Subtotal'.padEnd(26) + ' ' + ng(q.subtotal),
    'VAT (7.5%)'.padEnd(26) + ' ' + ng(q.vat),
    'TOTAL'.padEnd(26) + ' ' + ng(q.total),
    '',
    'Indicative only. Structural design and site work need an engineer.',
  ].join('\n');
}

export { OPENING_TYPES, FLOOR };
