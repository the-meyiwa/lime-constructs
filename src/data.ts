import type { CurrencyCode, FitoutId, Opening, Unit } from './types';

export const FLOOR = 2.75;
export const CORNER_POST_MARGIN = 0.22; // ISO corner casting & post clearance in meters

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

export type ShellColor = {
  id: string;
  name: string;
  g: number;
  hex: string;
  rgb: [number, number, number];
};

export const SHELLS: ShellColor[] = [
  { id: 'corten', name: 'Corten Rust', g: 0.45, hex: '#A85234', rgb: [168, 82, 52] },
  { id: 'charcoal', name: 'Anthracite', g: 0.32, hex: '#3A3E44', rgb: [58, 62, 68] },
  { id: 'navy', name: 'Ocean Navy', g: 0.36, hex: '#244466', rgb: [36, 68, 102] },
  { id: 'olive', name: 'Army Olive', g: 0.38, hex: '#415040', rgb: [65, 80, 64] },
  { id: 'sand', name: 'Dune Sand', g: 0.65, hex: '#B89E7A', rgb: [184, 158, 122] },
  { id: 'white', name: 'Arctic White', g: 0.92, hex: '#E8EBF0', rgb: [232, 235, 240] },
];

export const shellColor = (id: string): [number, number, number] => {
  const found = SHELLS.find((s) => s.id === id);
  if (found) return found.rgb;
  if (id === 'black') return [42, 44, 48];
  if (id === 'slate') return [95, 102, 112];
  return SHELLS[0].rgb;
};

export const shellG = (id: string) => (SHELLS.find((s) => s.id === id) || SHELLS[0]).g;

export type FitoutSpec = {
  id: FitoutId;
  name: string;
  short: string;
  desc: string;
  ratePerM2: number;
  mepFlat: number;
};

export const FITOUT_SPECS: FitoutSpec[] = [
  {
    id: 'raw',
    name: 'Raw Shell',
    short: 'Raw',
    desc: 'Weatherproof Corten steel shell, marine ply floor, rust treatment & exterior coat.',
    ratePerM2: 0,
    mepFlat: 0,
  },
  {
    id: 'lined',
    name: 'Insulated & Lined',
    short: 'Lined',
    desc: '50mm closed-cell spray foam, timber sub-frame, gypsum wallboard & vinyl plank floor.',
    ratePerM2: 85000,
    mepFlat: 320000,
  },
  {
    id: 'office',
    name: 'Workspace / Studio',
    short: 'Studio',
    desc: 'Insulated shell, acoustic ceiling, LED track lighting, 8x power outlets, A/C split prep.',
    ratePerM2: 125000,
    mepFlat: 680000,
  },
  {
    id: 'living',
    name: 'Living / Suite (Wet MEP)',
    short: 'Suite',
    desc: 'Full thermal insulation, bathroom & kitchenette plumbing rough-in, water heater, DB board.',
    ratePerM2: 165000,
    mepFlat: 1450000,
  },
  {
    id: 'commercial',
    name: 'Retail / Cafe Spec',
    short: 'Cafe',
    desc: 'Heavy-duty commercial floor, 3-phase DB, wash-down walls, extraction & counter MEP.',
    ratePerM2: 155000,
    mepFlat: 1350000,
  },
];

export const FITOUT = Object.fromEntries(FITOUT_SPECS.map((f) => [f.id, f])) as Record<FitoutId, FitoutSpec>;

export type OpeningType = {
  id: string;
  kind: 'door' | 'window' | 'cutout';
  label: string;
  w: number;
  h: number;
  sill: number;
  rate: number;
};

export const OPENING_TYPES: OpeningType[] = [
  { id: 'door', kind: 'door', label: 'Flush door', w: 0.95, h: 2.1, sill: 0, rate: 185000 },
  { id: 'glass-door', kind: 'door', label: 'Glazed door', w: 0.95, h: 2.15, sill: 0, rate: 260000 },
  { id: 'slider', kind: 'door', label: 'Sliding door', w: 2.4, h: 2.15, sill: 0, rate: 780000 },
  { id: 'bifold', kind: 'door', label: 'Bi-fold wall', w: 3.6, h: 2.2, sill: 0, rate: 1650000 },
  { id: 'window', kind: 'window', label: 'Casement window', w: 1.2, h: 1.0, sill: 1.0, rate: 95000 },
  { id: 'wide-window', kind: 'window', label: 'Picture window', w: 2.0, h: 1.4, sill: 0.7, rate: 420000 },
  { id: 'clerestory', kind: 'window', label: 'Clerestory', w: 2.4, h: 0.4, sill: 2.05, rate: 180000 },
  { id: 'cutout', kind: 'cutout', label: 'Open span cutout', w: 3.2, h: 2.25, sill: 0, rate: 490000 },
];

export const OPENING = Object.fromEntries(OPENING_TYPES.map((o) => [o.id, o])) as Record<string, OpeningType>;

export const EXTRAS = {
  foundationPerPad: 115000, // 4 reinforced concrete corner pads per ground unit = 460k (6 pads for 40ft+ = 690k)
  supportColumn: 245000, // Structural steel SHS column + footing for cantilevered upper corners
  twistLockSet: 140000, // Inter-box twist locks & bridge clamps per stacked unit
  transportGround: 280000, // Flatbed haulage + HIAB offload
  craneUpper: 420000, // Haulage + mobile crane lift for upper levels
  headerSteelPerM: 95000, // RHS steel lintel reinforcement for openings wider than 1.8m
  roofDeckPerM2: 78000, // Timber/composite roof terrace decking + balustrade
  externalStair: 920000, // Fabricated galvanized steel external staircase
  solarPackage: 1850000, // 3.5kVA hybrid inverter, 4x 450W panels & LiFePO4 battery
  labourPct: 0.12,
  vatPct: 0.075,
};

export const CURRENCIES: Record<CurrencyCode, { symbol: string; code: CurrencyCode; rate: number; name: string }> = {
  NGN: { symbol: '₦', code: 'NGN', rate: 1, name: 'Naira' },
  USD: { symbol: '$', code: 'USD', rate: 1 / 1600, name: 'US Dollar' },
  GBP: { symbol: '£', code: 'GBP', rate: 1 / 2050, name: 'British Pound' },
  EUR: { symbol: '€', code: 'EUR', rate: 1 / 1720, name: 'Euro' },
};

let seq = 100;
export const uid = (p = 'u') => p + '_' + Date.now().toString(36).slice(-4) + '_' + seq++;

export function makeUnit(type: string, x: number, z: number, extra: Partial<Unit> = {}): Unit {
  return {
    id: uid('unit'),
    type,
    x,
    z,
    level: 0,
    rot: 0,
    color: 'charcoal',
    fitout: 'lined',
    roofDeck: false,
    stairs: false,
    solar: false,
    openings: [],
    ...extra,
  };
}

export function makeOpening(typeId: string, wall: Opening['wall'], along: number): Opening {
  const t = OPENING[typeId] || OPENING_TYPES[0];
  return {
    id: uid('op'),
    typeId: t.id,
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
    name: '20 ft Garden Studio',
    meta: '1 unit · 15 m² · Studio fit-out',
    note: 'Slider in the long wall, casement window for cross-breeze, glazed end entry.',
    units: [
      makeUnit('20ft', 0, 0, {
        label: 'Main Studio',
        color: 'sand',
        fitout: 'office',
        openings: [
          makeOpening('slider', 'left', 3.03),
          makeOpening('window', 'right', 2.0),
          makeOpening('glass-door', 'front', 1.22),
        ],
      }),
    ],
  },
  {
    id: 'loft',
    name: '40 HC Residence',
    meta: '1 unit · 30 m² · Suite fit-out',
    note: 'Bi-fold living room wall, picture window & high clerestory for daylighting.',
    units: [
      makeUnit('40hc', 0, 0, {
        label: 'Residence 40HC',
        color: 'slate',
        fitout: 'living',
        solar: true,
        openings: [
          makeOpening('bifold', 'left', 4.5),
          makeOpening('wide-window', 'right', 3.0),
          makeOpening('clerestory', 'left', 9.8),
          makeOpening('glass-door', 'front', 1.22),
        ],
      }),
    ],
  },
  {
    id: 'double',
    name: 'Two-Storey Duplex',
    meta: '2 units · 60 m² · Stacked + Stairs',
    note: 'Upper 40 ft locks directly onto lower corner castings with external steel stair.',
    units: [
      makeUnit('40ft', 0, 0, {
        label: 'Ground Living',
        color: 'slate',
        fitout: 'living',
        openings: [makeOpening('slider', 'left', 4.5), makeOpening('window', 'right', 8.5)],
      }),
      makeUnit('40ft', 0, 0, {
        label: 'Upper Studio',
        level: 1,
        color: 'white',
        fitout: 'office',
        stairs: true,
        openings: [makeOpening('slider', 'left', 8.0), makeOpening('wide-window', 'right', 3.5)],
      }),
    ],
  },
  {
    id: 'courtyard',
    name: 'L-Courtyard & Deck',
    meta: '2 units · 45 m² · Flush L-Plan',
    note: '40 ft wing and 20 ft studio snapped at a 90° corner framing a courtyard.',
    units: [
      makeUnit('40ft', 0, 0, {
        label: 'Main Wing',
        color: 'charcoal',
        fitout: 'living',
        roofDeck: true,
        openings: [makeOpening('slider', 'left', 4.2), makeOpening('window', 'right', 8.0)],
      }),
      makeUnit('20ft', 9.75, 2.44, {
        label: 'Guest Wing',
        rot: 1,
        level: 0,
        color: 'charcoal',
        fitout: 'office',
        openings: [makeOpening('wide-window', 'left', 3.03), makeOpening('glass-door', 'front', 1.22)],
      }),
    ],
  },
  {
    id: 'doublewide',
    name: 'Double-Wide Showroom',
    meta: '2 units · 60 m² · Joined Span',
    note: 'Two 40 HC units placed flush side-by-side with open-span internal wall cutouts.',
    units: [
      makeUnit('40hc', 0, 0, {
        label: 'North Bay',
        color: 'black',
        fitout: 'commercial',
        openings: [
          makeOpening('bifold', 'left', 6.1),
          makeOpening('cutout', 'right', 6.1),
          makeOpening('glass-door', 'front', 1.22),
        ],
      }),
      makeUnit('40hc', 0, 2.44, {
        label: 'South Bay',
        color: 'black',
        fitout: 'commercial',
        openings: [
          makeOpening('cutout', 'left', 6.1),
          makeOpening('wide-window', 'right', 4.0),
          makeOpening('wide-window', 'right', 8.2),
        ],
      }),
    ],
  },
];
