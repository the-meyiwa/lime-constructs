export type Wall = 'front' | 'back' | 'left' | 'right';

export type Opening = {
  id: string;
  typeId?: string;
  kind: 'door' | 'window' | 'cutout';
  wall: Wall;
  along: number;
  w: number;
  h: number;
  sill: number;
  label: string;
  rate: number;
};

export type FitoutId = 'raw' | 'lined' | 'office' | 'living' | 'commercial';

export type Unit = {
  id: string;
  type: string;
  label?: string;
  x: number;
  z: number;
  level: number;
  rot: 0 | 1;
  color: string;
  fitout?: FitoutId;
  roofDeck?: boolean;
  stairs?: boolean;
  solar?: boolean;
  openings: Opening[];
};

export type Cam = { az: number; el: number; dist: number };

export type ViewMode = '3d' | 'plan';

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';

export type ProjectMeta = {
  name: string;
  client: string;
  site: string;
  currency: CurrencyCode;
  notes: string;
};

export type WarningItem = {
  id: string;
  severity: 'error' | 'warn';
  unitIds: string[];
  text: string;
};
