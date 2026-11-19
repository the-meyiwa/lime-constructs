import type { Opening, Unit } from './types';
import { FURN } from './furniture';

/** storey height: a stacked container clears the one below */
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

export type Shell = {
  id: string;
  name: string;
  hex: string;
  /** cabin default: sandwich panel, not corten */
  cabin?: boolean;
};

export const SHELLS: Shell[] = [
  { id: 'charcoal', name: 'Charcoal', hex: '#3B3E44' },
  { id: 'black', name: 'Black', hex: '#26282B' },
  { id: 'slate', name: 'Slate', hex: '#5C6772' },
  { id: 'corten', name: 'Corten', hex: '#8F5A39' },
  { id: 'oxide', name: 'Oxide red', hex: '#7E3A2D' },
  { id: 'olive', name: 'Olive', hex: '#57614A' },
  { id: 'sage', name: 'Sage', hex: '#8B9C8A' },
  { id: 'ocean', name: 'Ocean', hex: '#2F5468' },
  { id: 'mustard', name: 'Mustard', hex: '#B08434' },
  { id: 'sand', name: 'Sand', hex: '#B3A084' },
  { id: 'cream', name: 'Cream', hex: '#D8D1C1', cabin: true },
  { id: 'white', name: 'White', hex: '#E7E8E4', cabin: true },
];

export const shellOf = (id: string): Shell => SHELLS.find((s) => s.id === id) || SHELLS[0];

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
  return { id: uid('unit'), type, x, z, level: 0, rot: 0, color: 'charcoal', openings: [], items: [], ...extra };
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

const item = (kind: string, x: number, z: number, rot: 0 | 1 | 2 | 3): any => ({ id: uid('it'), kind, x, z, rot });

/** place against a side wall: z works out from the piece's own depth */
export const fit = (kind: string, u: number, side: 'left' | 'right', wid: number, rot: 0 | 1 | 2 | 3 = 0) => {
  const f = FURN[kind];
  const d = rot % 2 ? f.w : f.d;
  const z = side === 'left' ? d / 2 + 0.06 : wid - d / 2 - 0.06;
  return item(kind, u, z, rot) as any;
};

export const PRESETS: { id: string; name: string; meta: string; note: string; units: Unit[] }[] = [
  {
    id: 'studio',
    name: '20 ft studio',
    meta: '1 unit · 14 m2',
    note: 'Slider in the long wall, bed and kitchen along the blind side.',
    units: [
      makeUnit('20ft', 0, 0, {
        color: 'sage',
        openings: [
          makeOpening('slider', 'left', 1.6),
          makeOpening('window', 'right', 5.0),
          makeOpening('glass-door', 'front', 2.4),
        ],
        items: [fit('kitchen', 1.6, 'right', 2.44), fit('bed-double', 4.0, 'right', 2.44), fit('fridge', 5.2, 'left', 2.44)],
      }),
    ],
  },
  {
    id: 'loft',
    name: '40 HC loft',
    meta: '1 unit · 28 m2',
    note: 'Picture window plus clerestory, living at one end, sleep at the other.',
    units: [
      makeUnit('40hc', 0, 0, {
        color: 'oxide',
        openings: [
          makeOpening('bifold', 'left', 5.0),
          makeOpening('wide-window', 'right', 3.0),
          makeOpening('clerestory', 'left', 10.4),
          makeOpening('glass-door', 'front', 1.2),
        ],
        items: [
          fit('sofa', 2.0, 'right', 2.44),
          fit('media', 1.6, 'left', 2.44),
          fit('dining', 7.6, 'left', 2.44),
          fit('kitchen', 8.0, 'right', 2.44),
          fit('fridge', 9.4, 'right', 2.44),
          fit('wardrobe', 9.0, 'left', 2.44),
          fit('bed-double', 10.4, 'left', 2.44),
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
        items: [fit('sofa', 3.0, 'right', 2.44), fit('dining', 7.0, 'right', 2.44)],
      }),
      makeUnit('40ft', 0, 0, {
        level: 1,
        color: 'white',
        openings: [makeOpening('slider', 'left', 5.5), makeOpening('wide-window', 'right', 4.0)],
        items: [fit('bed-double', 3.0, 'right', 2.44), fit('wardrobe', 5.0, 'right', 2.44), fit('desk', 8.0, 'left', 2.44)],
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
        items: [fit('sofa', 2.6, 'right', 2.44), fit('kitchen', 7.0, 'left', 2.44), fit('dining', 9.8, 'right', 2.44)],
      }),
      makeUnit('20ft', 7.4, 2.6, {
        rot: 1,
        level: 0,
        color: 'charcoal',
        openings: [makeOpening('wide-window', 'left', 3.0), makeOpening('window', 'front', 1.1)],
        items: [fit('bed-double', 4.6, 'right', 2.44), fit('shower', 1.3, 'left', 2.44), fit('basin', 3.0, 'right', 2.44)],
      }),
    ],
  },
];
