import type { Opening, Unit } from './types';

export const FLOOR = 2.75;

export type UnitType = {
  id: string;
  name: string;
  short: string;
  group: 'container' | 'cabin';
  len: number;
  wid: number;
  hgt: number;
  price: number;
};

export const UNIT_TYPES: UnitType[] = [
  { id: '10ft', name: '10 ft container', short: '10 ft', group: 'container', len: 2.99, wid: 2.44, hgt: 2.59, price: 3400000 },
  { id: '20ft', name: '20 ft container', short: '20 ft', group: 'container', len: 6.06, wid: 2.44, hgt: 2.59, price: 4600000 },
  { id: '40ft', name: '40 ft container', short: '40 ft', group: 'container', len: 12.19, wid: 2.44, hgt: 2.59, price: 7200000 },
  { id: '40hc', name: '40 ft high cube', short: '40 HC', group: 'container', len: 12.19, wid: 2.44, hgt: 2.9, price: 7900000 },
  { id: '45hc', name: '45 ft high cube', short: '45 HC', group: 'container', len: 13.72, wid: 2.44, hgt: 2.9, price: 8900000 },
  { id: 'pc12', name: '12 x 8 ft cabin', short: '12 ft cab', group: 'cabin', len: 3.66, wid: 2.44, hgt: 2.5, price: 2600000 },
  { id: 'pc20', name: '20 x 8 ft cabin', short: '20 ft cab', group: 'cabin', len: 6.1, wid: 2.44, hgt: 2.5, price: 3900000 },
  { id: 'pc32', name: '32 x 10 ft cabin', short: '32 ft cab', group: 'cabin', len: 9.75, wid: 3.05, hgt: 2.6, price: 5400000 },
];

export const TYPE = Object.fromEntries(UNIT_TYPES.map((t) => [t.id, t])) as Record<string, UnitType>;

export const SHELLS: { id: string; name: string; g: number }[] = [
  { id: 'black', name: 'Black', g: 0.22 },
  { id: 'charcoal', name: 'Charcoal', g: 0.36 },
  { id: 'slate', name: 'Slate', g: 0.5 },
  { id: 'sand', name: 'Sand', g: 0.7 },
  { id: 'white', name: 'White', g: 0.95 },
];

export const shellG = (id: string) => (SHELLS.find((s) => s.id === id) || SHELLS[1]).g;

export type OpeningType = {
  id: string;
  kind: 'door' | 'window';
  label: string;
  w: number;
  h: number;
  sill: number;
  rate: number;
};

export const OPENING_TYPES: OpeningType[] = [
  { id: 'door', kind: 'door', label: 'Door', w: 0.95, h: 2.1, sill: 0, rate: 185000 },
  { id: 'glass-door', kind: 'door', label: 'Glazed door', w: 0.95, h: 2.15, sill: 0, rate: 260000 },
  { id: 'slider', kind: 'door', label: 'Sliding door', w: 2.4, h: 2.15, sill: 0, rate: 780000 },
  { id: 'bifold', kind: 'door', label: 'Bi-fold wall', w: 3.6, h: 2.2, sill: 0, rate: 1650000 },
  { id: 'window', kind: 'window', label: 'Window', w: 1.2, h: 1.0, sill: 1.0, rate: 95000 },
  { id: 'wide-window', kind: 'window', label: 'Picture window', w: 2.0, h: 1.4, sill: 0.7, rate: 420000 },
  { id: 'clerestory', kind: 'window', label: 'Clerestory', w: 2.4, h: 0.4, sill: 2.05, rate: 180000 },
];

export const OPENING = Object.fromEntries(OPENING_TYPES.map((o) => [o.id, o])) as Record<string, OpeningType>;

export const EXTRAS = {
  foundation: 420000,
  transport: 280000,
  labourPct: 0.12,
  vatPct: 0.075,
};

let seq = 100;
export const uid = (p = 'u') => p + '_' + seq++;

export function makeUnit(type: string, x: number, z: number, extra: Partial<Unit> = {}): Unit {
  return { id: uid('unit'), type, x, z, level: 0, rot: 0, color: 'charcoal', openings: [], ...extra };
}

export function makeOpening(typeId: string, wall: Opening['wall'], along: number): Opening {
  const t = OPENING[typeId];
  return {
    id: uid('op'),
    kind: t.kind,
    wall,
    along,
    w: t.w,
    h: t.h,
    sill: t.sill,
    label: t.label,
    rate: t.rate,
  };
}

export const PRESETS: { id: string; name: string; meta: string; note: string; units: Unit[] }[] = [
  {
    id: 'studio',
    name: '20 ft studio',
    meta: '1 unit · 14 m2',
    note: 'Slider in the long wall, deck off the door end.',
    units: [
      makeUnit('20ft', 0, 0, {
        color: 'sand',
        openings: [
          makeOpening('slider', 'left', 3.2),
          makeOpening('window', 'right', 2.0),
          makeOpening('glass-door', 'front', 1.2),
        ],
      }),
    ],
  },
  {
    id: 'loft',
    name: '40 HC loft',
    meta: '1 unit · 28 m2',
    note: 'Picture window plus clerestory for cross light.',
    units: [
      makeUnit('40hc', 0, 0, {
        color: 'slate',
        openings: [
          makeOpening('bifold', 'left', 6.0),
          makeOpening('wide-window', 'right', 3.0),
          makeOpening('clerestory', 'left', 10.2),
          makeOpening('glass-door', 'front', 1.2),
        ],
      }),
    ],
  },
  {
    id: 'double',
    name: 'Stacked pair',
    meta: '2 units · 61 m2',
    note: 'Upper unit lands on the corner castings of the lower one.',
    units: [
      makeUnit('40ft', 0, 0, {
        color: 'slate',
        openings: [makeOpening('slider', 'left', 5.0), makeOpening('window', 'right', 4.0)],
      }),
      makeUnit('40ft', 0, 0, {
        level: 1,
        color: 'white',
        openings: [makeOpening('slider', 'left', 8.0), makeOpening('wide-window', 'right', 3.0)],
      }),
    ],
  },
  {
    id: 'courtyard',
    name: 'L courtyard',
    meta: '2 units · 42 m2',
    note: 'A 40 and a 20 turning a corner, sheltered deck between.',
    units: [
      makeUnit('40ft', 0, 0, {
        color: 'charcoal',
        openings: [makeOpening('slider', 'left', 4.0), makeOpening('window', 'right', 6.0)],
      }),
      makeUnit('20ft', 7.4, 1.8, {
        rot: 1,
        level: 0,
        color: 'charcoal',
        openings: [makeOpening('wide-window', 'left', 3.0), makeOpening('window', 'front', 1.1)],
      }),
    ],
  },
];
