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

export type Unit = {
  id: string;
  type: string;
  x: number;
  z: number;
  level: number;
  rot: 0 | 1;
  color: string;
  openings: Opening[];
};

export type Cam = { az: number; el: number; dist: number };

export type ViewMode = '3d' | 'plan';
