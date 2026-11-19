/**
 * Fit-out catalogue. Every part is a box in metres, local to the item:
 * x across the item's width, z through its depth, y up from the floor.
 * Items are placed against the inside walls of a unit, rotated in quarter turns.
 */

export type FPart = { x: number; y: number; z: number; w: number; h: number; d: number; c: string };

export type FDef = {
  id: string;
  name: string;
  cat: 'sleep' | 'live' | 'kitchen' | 'bath' | 'work' | 'storage';
  /** footprint width / depth / height, metres */
  w: number;
  d: number;
  h: number;
  /** interior clearance the piece needs in front of it, metres */
  clear: number;
  price: number;
  parts: (w: number, d: number, h: number) => FPart[];
};

const b = (x: number, y: number, z: number, w: number, h: number, d: number, c: string): FPart => ({ x, y, z, w, h, d, c });

const WOOD = '#8A6A4B';
const WOOD_D = '#6B4F36';
const OAK = '#B08A5E';
const STEEL = '#9AA1A7';
const CHROME = '#C3C9CE';
const WHITE_GLASS = '#E9EDEE';
const FABRIC = '#6A7480';
const FABRIC_D = '#565F69';
const LINEN = '#E2DED4';
const CHARCOAL = '#2A2D31';
const MATT = '#D9D4C8';

export const FURNITURE: FDef[] = [
  {
    id: 'bed-single',
    name: 'Single bed',
    cat: 'sleep',
    w: 0.95,
    d: 1.95,
    h: 0.95,
    clear: 0.6,
    price: 185000,
    parts: (w, d) => [
      b(0, 0.16, 0, w, 0.24, d, WOOD),
      b(0, 0.34, 0.05, w - 0.06, 0.16, d - 0.1, MATT),
      b(0, 0.46, -d / 2 + 0.26, w - 0.26, 0.1, 0.38, LINEN),
      b(0, 0.43, 0.3, w - 0.04, 0.1, d * 0.55, FABRIC),
      b(0, 0.55, -d / 2 + 0.04, w, 0.9, 0.07, WOOD_D),
    ],
  },
  {
    id: 'bed-double',
    name: 'Double bed',
    cat: 'sleep',
    w: 1.4,
    d: 1.95,
    h: 0.95,
    clear: 0.65,
    price: 245000,
    parts: (w, d) => [
      b(0, 0.16, 0, w, 0.24, d, WOOD),
      b(0, 0.34, 0.05, w - 0.06, 0.16, d - 0.1, MATT),
      b(-w / 4, 0.46, -d / 2 + 0.26, w / 2 - 0.14, 0.1, 0.38, LINEN),
      b(w / 4, 0.46, -d / 2 + 0.26, w / 2 - 0.14, 0.1, 0.38, LINEN),
      b(0, 0.43, 0.32, w - 0.04, 0.1, d * 0.52, FABRIC),
      b(0, 0.55, -d / 2 + 0.04, w, 0.9, 0.07, WOOD_D),
    ],
  },
  {
    id: 'bunk',
    name: 'Bunk bed',
    cat: 'sleep',
    w: 0.95,
    d: 1.95,
    h: 1.72,
    clear: 0.6,
    price: 320000,
    parts: (w, d, h) => [
      b(-w / 2 + 0.04, h / 2, -d / 2 + 0.04, 0.06, h, 0.06, STEEL),
      b(w / 2 - 0.04, h / 2, -d / 2 + 0.04, 0.06, h, 0.06, STEEL),
      b(-w / 2 + 0.04, h / 2, d / 2 - 0.04, 0.06, h, 0.06, STEEL),
      b(w / 2 - 0.04, h / 2, d / 2 - 0.04, 0.06, h, 0.06, STEEL),
      b(0, 0.38, 0, w - 0.04, 0.1, d - 0.06, MATT),
      b(0, 1.32, 0, w - 0.04, 0.1, d - 0.06, MATT),
      b(0, 0.46, 0.1, w - 0.22, 0.08, d * 0.6, FABRIC),
      b(0, 1.4, 0.1, w - 0.22, 0.08, d * 0.6, FABRIC),
      b(0, 0.86, -d / 2 + 0.02, w, 0.5, 0.04, WOOD),
    ],
  },
  {
    id: 'sofa',
    name: 'Two-seat sofa',
    cat: 'live',
    w: 1.85,
    d: 0.88,
    h: 0.82,
    clear: 0.7,
    price: 295000,
    parts: (w, d, h) => [
      b(0, 0.15, 0, w, 0.3, d, FABRIC_D),
      b(-w / 2 + 0.09, 0.46, 0, 0.18, 0.36, d, FABRIC),
      b(w / 2 - 0.09, 0.46, 0, 0.18, 0.36, d, FABRIC),
      b(0, 0.62, -d / 2 + 0.09, w - 0.36, 0.42, 0.18, FABRIC),
      b(-w / 4 + 0.02, 0.36, 0.06, w / 2 - 0.22, 0.14, d - 0.24, FABRIC),
      b(w / 4 - 0.02, 0.36, 0.06, w / 2 - 0.22, 0.14, d - 0.24, FABRIC),
      b(-w / 4, 0.24, 0.0, 0.06, 0.16, 0.06, CHARCOAL),
      b(w / 4, 0.24, 0.0, 0.06, 0.16, 0.06, CHARCOAL),
    ],
  },
  {
    id: 'armchair',
    name: 'Armchair',
    cat: 'live',
    w: 0.82,
    d: 0.82,
    h: 0.8,
    clear: 0.5,
    price: 135000,
    parts: (w, d) => [
      b(0, 0.14, 0, w - 0.1, 0.28, d - 0.06, FABRIC_D),
      b(-w / 2 + 0.06, 0.44, 0, 0.12, 0.4, d - 0.06, FABRIC),
      b(w / 2 - 0.06, 0.44, 0, 0.12, 0.4, d - 0.06, FABRIC),
      b(0, 0.6, -d / 2 + 0.08, w - 0.22, 0.38, 0.16, FABRIC),
      b(0, 0.33, 0.04, w - 0.26, 0.12, d - 0.26, FABRIC),
    ],
  },
  {
    id: 'dining',
    name: 'Table and two chairs',
    cat: 'live',
    w: 1.4,
    d: 1.2,
    h: 0.78,
    clear: 0.55,
    price: 265000,
    parts: (w, d) => [
      b(0, 0.73, -d / 2 + 0.38, w, 0.05, 0.78, OAK),
      b(-w / 2 + 0.08, 0.36, -d / 2 + 0.08, 0.06, 0.72, 0.06, WOOD_D),
      b(w / 2 - 0.08, 0.36, -d / 2 + 0.08, 0.06, 0.72, 0.06, WOOD_D),
      b(-w / 2 + 0.08, 0.36, -d / 2 + 0.68, 0.06, 0.72, 0.06, WOOD_D),
      b(w / 2 - 0.08, 0.36, -d / 2 + 0.68, 0.06, 0.72, 0.06, WOOD_D),
      // chairs, pulled out on the near side
      b(-w / 4, 0.44, d / 2 - 0.12, 0.44, 0.05, 0.44, WOOD),
      b(-w / 4, 0.66, d / 2 + 0.08, 0.44, 0.44, 0.05, WOOD),
      b(w / 4, 0.44, d / 2 - 0.12, 0.44, 0.05, 0.44, WOOD),
      b(w / 4, 0.66, d / 2 + 0.08, 0.44, 0.44, 0.05, WOOD),
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen run + sink',
    cat: 'kitchen',
    w: 2.0,
    d: 0.6,
    h: 0.9,
    clear: 0.9,
    price: 820000,
    parts: (w, d, h) => [
      b(0, h / 2 - 0.03, 0, w, h - 0.08, d - 0.04, MATT),
      b(0, h - 0.03, 0.01, w + 0.02, 0.05, d + 0.01, CHARCOAL),
      b(-w * 0.24, h - 0.005, 0, 0.5, 0.03, 0.38, STEEL),
      b(-w * 0.24, h + 0.12, -d / 2 + 0.06, 0.04, 0.26, 0.04, CHROME),
      b(w * 0.22, h + 0.005, 0, 0.54, 0.02, 0.44, '#1E2125'),
      b(0, 0.36, -d / 2 + 0.01, w - 0.04, 0.68, 0.02, '#CDC6B8'),
      b(-w / 4, h / 2 - 0.03, d / 2 - 0.02, 0.02, h - 0.14, 0.02, CHARCOAL),
      b(w / 4, h / 2 - 0.03, d / 2 - 0.02, 0.02, h - 0.14, 0.02, CHARCOAL),
    ],
  },
  {
    id: 'fridge',
    name: 'Fridge',
    cat: 'kitchen',
    w: 0.65,
    d: 0.68,
    h: 1.75,
    clear: 0.75,
    price: 310000,
    parts: (w, d, h) => [
      b(0, h / 2, 0, w, h, d, '#DDE0E1'),
      b(0, h * 0.62, d / 2 - 0.005, w - 0.03, 0.012, 0.012, '#8E959A'),
      b(0, h - 0.02, d / 2 - 0.005, w - 0.03, 0.008, 0.012, '#8E959A'),
      b(w / 2 - 0.07, h * 0.78, d / 2 + 0.01, 0.03, 0.34, 0.03, STEEL),
      b(-w / 2 + 0.07, h * 0.78, d / 2 + 0.01, 0.03, 0.34, 0.03, STEEL),
    ],
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    cat: 'storage',
    w: 1.2,
    d: 0.6,
    h: 2.05,
    clear: 0.7,
    price: 380000,
    parts: (w, d, h) => [
      b(0, h / 2, 0, w, h, d, '#CFC8BB'),
      b(0, h / 2, d / 2 + 0.005, 0.012, h - 0.06, 0.012, '#8C8578'),
      b(-w / 4, h / 2, d / 2 + 0.01, w / 2 - 0.04, h - 0.06, 0.008, '#D8D2C6'),
      b(w / 4, h / 2, d / 2 + 0.01, w / 2 - 0.04, h - 0.06, 0.008, '#D8D2C6'),
      b(-0.04, h * 0.55, d / 2 + 0.03, 0.02, 0.24, 0.02, CHARCOAL),
      b(0.04, h * 0.55, d / 2 + 0.03, 0.02, 0.24, 0.02, CHARCOAL),
    ],
  },
  {
    id: 'desk',
    name: 'Desk',
    cat: 'work',
    w: 1.2,
    d: 0.6,
    h: 0.75,
    clear: 0.7,
    price: 155000,
    parts: (w, d, h) => [
      b(0, h, 0, w, 0.05, d, OAK),
      b(-w / 2 + 0.06, h / 2, -d / 2 + 0.06, 0.05, h, 0.05, STEEL),
      b(w / 2 - 0.06, h / 2, -d / 2 + 0.06, 0.05, h, 0.05, STEEL),
      b(w / 2 - 0.22, (h - 0.05) / 2, 0, 0.4, h - 0.05, d - 0.06, '#D5CFC3'),
      b(w / 2 - 0.22, h * 0.72, d / 2 - 0.02, 0.3, 0.02, 0.02, CHARCOAL),
      b(0, h + 0.24, -d / 2 + 0.12, 0.5, 0.32, 0.02, CHARCOAL),
      b(0, h + 0.09, -d / 2 + 0.16, 0.12, 0.16, 0.08, '#3C4045'),
    ],
  },
  {
    id: 'shelving',
    name: 'Shelving',
    cat: 'storage',
    w: 1.0,
    d: 0.35,
    h: 1.8,
    clear: 0.55,
    price: 98000,
    parts: (w, d, h) => [
      b(-w / 2 + 0.02, h / 2, 0, 0.04, h, d, STEEL),
      b(w / 2 - 0.02, h / 2, 0, 0.04, h, d, STEEL),
      b(0, 0.08, 0, w, 0.04, d, STEEL),
      b(0, h * 0.34, 0, w, 0.035, d, STEEL),
      b(0, h * 0.62, 0, w, 0.035, d, STEEL),
      b(0, h - 0.06, 0, w, 0.035, d, STEEL),
      b(-w * 0.3, h * 0.34 + 0.12, 0, 0.16, 0.2, 0.12, '#7E4A3A'),
      b(-w * 0.08, h * 0.34 + 0.11, 0, 0.14, 0.18, 0.11, '#43596B'),
      b(w * 0.18, h * 0.34 + 0.13, 0, 0.2, 0.22, 0.1, '#8B8558'),
      b(w * 0.24, h * 0.62 + 0.11, 0, 0.18, 0.18, 0.1, '#6B5B7A'),
    ],
  },
  {
    id: 'toilet',
    name: 'Toilet',
    cat: 'bath',
    w: 0.42,
    d: 0.7,
    h: 0.78,
    clear: 0.55,
    price: 125000,
    parts: (w, d, h) => [
      b(0, 0.2, d / 2 - 0.24, 0.34, 0.4, 0.4, WHITE_GLASS),
      b(0, 0.42, d / 2 - 0.22, 0.38, 0.05, 0.44, WHITE_GLASS),
      b(0, 0.62, d / 2 - 0.06, w, 0.32, 0.2, WHITE_GLASS),
      b(0, 0.3, d / 2 - 0.14, 0.28, 0.2, 0.24, '#C9CFCF'),
    ],
  },
  {
    id: 'shower',
    name: 'Shower',
    cat: 'bath',
    w: 0.9,
    d: 0.9,
    h: 2.1,
    clear: 0.6,
    price: 285000,
    parts: (w, d, h) => [
      b(0, 0.05, 0, w, 0.1, d, '#D7DBDB'),
      b(0, h / 2 + 0.1, d / 2 - 0.02, w, h - 0.2, 0.02, 'rgba(200,222,230,0.45)'),
      b(w / 2 - 0.02, h / 2 + 0.1, 0, 0.02, h - 0.2, d, 'rgba(200,222,230,0.45)'),
      b(w / 2 - 0.1, h * 0.55, -d / 2 + 0.06, 0.1, 0.14, 0.1, CHROME),
      b(w / 2 - 0.1, h * 0.75, -d / 2 + 0.14, 0.05, 0.05, 0.24, CHROME),
    ],
  },
  {
    id: 'basin',
    name: 'Basin + mirror',
    cat: 'bath',
    w: 0.6,
    d: 0.44,
    h: 0.85,
    clear: 0.45,
    price: 98000,
    parts: (w, d) => [
      b(0, 0.36, 0, w, 0.72, d, '#D2CCBF'),
      b(0, 0.78, 0, w + 0.02, 0.08, d + 0.02, WHITE_GLASS),
      b(0, 0.84, -d / 2 + 0.06, 0.04, 0.16, 0.04, CHROME),
      b(0, 1.35, -d / 2 + 0.005, w - 0.06, 0.7, 0.02, '#BFC9CD'),
    ],
  },
  {
    id: 'washer',
    name: 'Washer',
    cat: 'bath',
    w: 0.6,
    d: 0.62,
    h: 0.85,
    clear: 0.6,
    price: 275000,
    parts: (w, d, h) => [
      b(0, h / 2, 0, w, h, d, '#E1E4E5'),
      b(0, h * 0.52, d / 2 + 0.005, 0.34, 0.34, 0.02, '#9BA3A8'),
      b(0, h * 0.86, d / 2 + 0.005, w - 0.1, 0.1, 0.02, '#3B4045'),
    ],
  },
  {
    id: 'media',
    name: 'TV + low unit',
    cat: 'live',
    w: 1.4,
    d: 0.4,
    h: 0.55,
    clear: 0.5,
    price: 165000,
    parts: (w, d) => [
      b(0, 0.22, 0, w, 0.44, d, '#4A4038'),
      b(-w / 4, 0.22, d / 2 + 0.005, 0.02, 0.36, 0.012, CHARCOAL),
      b(w / 4, 0.22, d / 2 + 0.005, 0.02, 0.36, 0.012, CHARCOAL),
      b(0, 1.02, -d / 2 + 0.05, 1.15, 0.66, 0.04, CHARCOAL),
      b(0, 1.02, -d / 2 + 0.06, 1.08, 0.6, 0.01, '#12161A'),
    ],
  },
  {
    id: 'plant',
    name: 'Plant',
    cat: 'live',
    w: 0.42,
    d: 0.42,
    h: 1.0,
    clear: 0.2,
    price: 45000,
    parts: (w, d, h) => [
      b(0, 0.16, 0, 0.32, 0.32, 0.32, '#8A7A6A'),
      b(0, h * 0.62, 0, 0.36, 0.62, 0.36, '#4F6B4A'),
      b(0.05, h * 0.92, -0.02, 0.22, 0.24, 0.22, '#5C7A54'),
    ],
  },
];

export const FURN = Object.fromEntries(FURNITURE.map((f) => [f.id, f])) as Record<string, FDef>;

export const CATS: { id: FDef['cat']; label: string }[] = [
  { id: 'sleep', label: 'Sleep' },
  { id: 'live', label: 'Living' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bath', label: 'Bath' },
  { id: 'work', label: 'Work' },
  { id: 'storage', label: 'Storage' },
];

/** footprint of an item in unit-local metres (0,0 = inside back-left corner) */
export function itemRect(it: { kind: string; x: number; z: number; rot: number }) {
  const f = FURN[it.kind];
  if (!f) return { u0: it.x, u1: it.x, w0: it.z, w1: it.z, h: 0 };
  const swap = it.rot % 2 === 1;
  const w = swap ? f.d : f.w;
  const d = swap ? f.w : f.d;
  return { u0: it.x - w / 2, u1: it.x + w / 2, w0: it.z - d / 2, w1: it.z + d / 2, h: f.h };
}
