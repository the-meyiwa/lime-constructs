export type Wall = 'front' | 'back' | 'left' | 'right';

export type Opening = {
  id: string;
  kind: 'door' | 'window';
  wall: Wall;
  along: number;
  w: number;
  h: number;
  sill: number;
  label: string;
  rate: number;
};

export type Item = {
  id: string;
  kind: string;
  /** metres from the unit's inside back-left corner, along its length */
  x: number;
  /** metres across the unit's inside width */
  z: number;
  /** quarter turns clockwise */
  rot: 0 | 1 | 2 | 3;
};

export type Unit = {
  id: string;
  type: string;
  x: number;
  z: number;
  level: number;
  rot: 0 | 1;
  color: string;
  openings: Opening[];
  items: Item[];
};

export type Cam = { az: number; el: number; dist: number };

export type ViewMode = '3d' | 'plan';

export type Sel = { unit: string | null; item: string | null };
