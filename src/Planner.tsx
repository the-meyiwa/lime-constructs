/* ============================================================
   Container Builder — Lime Constructs (React Native & Web)

   One app window: a parts library on the left, the 3D site in the
   middle, an inspector on the right and a status bar with the live
   price. Build with any number of containers and cabins, side by side
   or stacked, then specify, price and print the quotation.

   Interaction: click/tap to select, drag a selected part or unit to
   move it (units snap to each other's edges), right-click or long-press
   anywhere for actions, Delete / R / Ctrl+D / arrows on the keyboard.
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Viewport, placementAt, type HitResult } from './components/Viewport';
import { BuildPanel, type PlaceTarget } from './components/BuildPanel';
import { Inspector, fmtArea, fmtLen } from './components/Inspector';
import { SpecPanel } from './components/SpecPanel';
import { QuoteSheet, type CompanyMeta } from './components/QuoteSheet';
import { RatesPanel } from './components/RatesPanel';
import { PresetsModal } from './components/PresetsModal';
import { ContextMenu, type ContextMenuConfig, type ContextMenuItem } from './components/ContextMenu';
import { Icon } from './components/Icon';
import {
  PART,
  PRESETS,
  UNIT_TYPE,
  WALLS,
  extOf,
  layoutUnits,
  planSize,
  unitRect,
  type PlacedItem,
  type PresetDef,
  type UnitModel,
  type WallId,
} from './container-library';
import {
  COMMERCIAL_DEFAULTS,
  defaultRateBook,
  type CustomMaterial,
  type RateBook,
} from './container-catalog';
import {
  buildQuote,
  money,
  type CommercialSettings,
  type CurrencyCode,
  type CustomLine,
  type LineOverride,
} from './container-quote';
import { BASE_Y, worldToUnitLocal, type Cam, type SelRef } from './geo';
import { c } from './theme';

const LS_RATES = 'toolbox.container.rates';
const LS_COMPANY = 'toolbox.container.company';
const LS_MATERIALS = 'toolbox.container.materials';
const LS_PROJECT = 'toolbox.container.project';

const DEFAULT_SPEC: Record<string, string> = {
  shell: 'buy-20',
  prep: 'full',
  exterior: 'paint',
  insulation: 'pu25',
  framing: 'steel40',
  interior: 'ply9',
  ceiling: 'pvc',
  floor: 'vinyl',
  subfloor: 'marine18',
  paint: 'emulsion',
  glazing: 'standard',
  roofing: 'coating',
  foundation: 'pads',
};

const today = () => new Date().toISOString().slice(0, 10);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const CAM_VIEWS: Record<'iso' | 'top' | 'front' | 'left', Cam> = {
  iso: { az: 0.78, el: 0.52, dist: 21 },
  top: { az: 0, el: 1.52, dist: 27 },
  front: { az: 1.57, el: 0.08, dist: 21 },
  left: { az: 3.14, el: 0.08, dist: 21 },
};

const quickParts = {
  wall: ['personnel-door', 'window', 'sliding-door', 'picture-window', 'clerestory'],
  floor: ['partition', 'kitchen', 'sofa', 'double-bed', 'shower'],
  roof: ['roof-deck', 'solar', 'skylight'],
  site: ['deck', 'pergola', 'ext-stair'],
};

const wallSpan = (u: UnitModel, wall: WallId) => (wall === 'front' || wall === 'back' ? u.wid : u.len);
const unitName = (u: UnitModel) => u.name || `${UNIT_TYPE[u.preset]?.name || 'Unit'}`;
const levelName = (L: number) => (L === 0 ? 'Ground' : `Level ${L}`);

function freeAlong(u: UnitModel, wall: WallId, w: number): number | null {
  const span = wallSpan(u, wall);
  const taken = u.items
    .filter((i) => (i.kind === 'opening' || i.kind === 'facade') && i.wall === wall)
    .map((i) => [(i.along ?? 0) - (i.w ?? 0) / 2 - 0.15, (i.along ?? 0) + (i.w ?? 0) / 2 + 0.15]);
  const edge =
    (wall === 'left' || wall === 'right') && u.preset !== 'custom' && !UNIT_TYPE[u.preset]?.shell?.startsWith('fab')
      ? 0.3
      : 0.12;
  for (let t = 0; t <= 1; t += 0.05) {
    for (const a of [span / 2 + (t * span) / 2, span / 2 - (t * span) / 2]) {
      const lo = a - w / 2;
      const hi = a + w / 2;
      if (lo < edge || hi > span - edge) continue;
      if (!taken.some(([x, y]) => hi > x && lo < y)) return r3(a);
    }
  }
  return null;
}

function normalizePlacedItem(raw: Partial<PlacedItem>, u: UnitModel, key: number): PlacedItem {
  const type = raw.type || 'window';
  const p = PART[type];
  const kind = raw.kind || p?.kind || 'opening';
  const it: PlacedItem = { ...raw, type, kind, key };
  if (!p) return it;
  if (it.kind === 'opening' || it.kind === 'facade') {
    it.wall = WALLS.some((w) => w.id === it.wall) ? it.wall : 'left';
    const span = wallSpan(u, it.wall!);
    it.w = clamp(it.w ?? p.w, 0.1, span - 0.1);
    it.h = clamp(it.h ?? p.h ?? 1, 0.05, it.kind === 'facade' ? u.hgt + 0.4 : u.hgt - 0.02);
    it.sill = clamp(
      it.sill ?? p.sill ?? 0,
      it.kind === 'facade' ? -0.2 : 0,
      Math.max(0, u.hgt - (it.kind === 'facade' ? 0.1 : it.h))
    );
    it.along = clamp(it.along ?? span / 2, it.w / 2, span - it.w / 2);
    if (p.proj && it.proj == null) it.proj = p.proj;
  } else if (it.kind === 'fitting') {
    it.w = it.w ?? p.w;
    it.d = it.d ?? p.d ?? 1;
    it.h = it.h ?? p.h ?? 1;
    it.rot = (((Number(it.rot) || 0) % 4) + 4) % 4;
    if (p.deck && it.deck == null) it.deck = p.deck;
    if (p.stair && it.type !== 'spiral-in' && raw.h == null) it.h = Math.min(it.h, u.hgt - 0.05);
    const { dx, dz } = planSize(it);
    it.x = clamp(it.x ?? u.len / 2, Math.min(dx / 2, u.len / 2), Math.max(u.len - dx / 2, u.len / 2));
    it.z = clamp(it.z ?? u.wid / 2, Math.min(dz / 2, u.wid / 2), Math.max(u.wid - dz / 2, u.wid / 2));
  } else if (it.kind === 'roof') {
    const e = extOf(u);
    it.w = Math.min(it.w ?? p.w, p.cover ? e.len + 0.6 : e.len);
    it.d = Math.min(it.d ?? p.d ?? 1, p.cover ? e.wid + 0.6 : e.wid);
    if (p.h && it.h == null) it.h = p.h;
    it.x = clamp(it.x ?? u.len / 2, -0.5, u.len + 0.5);
    it.z = clamp(it.z ?? u.wid / 2, -0.5, u.wid + 0.5);
  }
  return it;
}

function normalizeSiteItem(raw: Partial<PlacedItem>, key: number): PlacedItem {
  const type = raw.type || 'deck';
  const p = PART[type];
  return {
    ...raw,
    type,
    kind: 'site',
    key,
    w: raw.w ?? p?.w ?? 1,
    d: raw.d ?? p?.d ?? 1,
    h: raw.h ?? p?.h ?? 0.26,
    rot: (((Number(raw.rot) || 0) % 4) + 4) % 4,
    x: raw.x ?? 0,
    z: raw.z ?? 0,
    elev: raw.elev ?? 0,
  };
}

function buildPresetData(p: PresetDef, startUnit = 1, startKey = 1) {
  let nextUnit = startUnit;
  let nextKey = startKey;
  const units: UnitModel[] = [];
  for (const pu of p.units) {
    const t = UNIT_TYPE[pu.preset] || UNIT_TYPE['20ft'];
    const u: UnitModel = {
      id: `u${nextUnit++}`,
      name: pu.name || '',
      preset: t.id,
      len: t.len,
      wid: t.wid,
      hgt: t.hgt,
      cx: pu.cx,
      cz: pu.cz,
      rot: pu.rot || 0,
      level: pu.level || 0,
      color: pu.color || 'green',
      items: [],
    };
    u.items = (pu.items || []).map((it) => normalizePlacedItem(it, u, nextKey++));
    units.push(u);
  }
  const site = (p.site || []).map((it) => normalizeSiteItem(it, nextKey++));
  return { name: p.name, units, site, nextUnit, nextKey };
}

function loadWebStorageJson<T>(key: string, fallback: T): T {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed !== null && parsed !== undefined) return parsed as T;
      }
    } catch {}
  }
  return fallback;
}

type Snapshot = {
  name: string;
  units: UnitModel[];
  site: PlacedItem[];
};

export function Planner() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isNarrow = width < 820;

  const initialData = useMemo(() => {
    const savedProj = loadWebStorageJson<any>(LS_PROJECT, null);
    if (savedProj && Array.isArray(savedProj.units) && savedProj.units.length > 0) {
      return {
        name: savedProj.name || 'Untitled build',
        units: savedProj.units as UnitModel[],
        site: (Array.isArray(savedProj.site) ? savedProj.site : []) as PlacedItem[],
        nextKey: Number(savedProj.nextKey) || 200,
        nextUnit: Number(savedProj.nextUnit) || 50,
        unit: (savedProj.unit === 'm' ? 'm' : 'ft') as 'ft' | 'm',
        currency: (savedProj.currency || 'NGN') as CurrencyCode,
        spec: { ...DEFAULT_SPEC, ...(savedProj.spec || {}) } as Record<string, string>,
        services: (savedProj.services || {}) as Record<string, number>,
        logistics: (savedProj.logistics || {}) as Record<string, number>,
        overrides: (savedProj.overrides || {}) as Record<string, LineOverride>,
        removed: (Array.isArray(savedProj.removed) ? savedProj.removed : []) as string[],
        customLines: (Array.isArray(savedProj.customLines) ? savedProj.customLines : []) as CustomLine[],
        commercial: { ...COMMERCIAL_DEFAULTS, discount: 0, ...(savedProj.commercial || {}) } as CommercialSettings,
        showRoof: typeof savedProj.showRoof === 'boolean' ? savedProj.showRoof : true,
      };
    }
    const built = buildPresetData(PRESETS[0], 1, 1);
    return {
      name: built.name,
      units: built.units,
      site: built.site,
      nextKey: built.nextKey,
      nextUnit: built.nextUnit,
      unit: 'ft' as 'ft' | 'm',
      currency: 'NGN' as CurrencyCode,
      spec: { ...DEFAULT_SPEC },
      services: {} as Record<string, number>,
      logistics: {} as Record<string, number>,
      overrides: {} as Record<string, LineOverride>,
      removed: [] as string[],
      customLines: [] as CustomLine[],
      commercial: { ...COMMERCIAL_DEFAULTS, discount: 0 } as CommercialSettings,
      showRoof: true,
    };
  }, []);

  const nextKeyRef = useRef(initialData.nextKey);
  const nextUnitRef = useRef(initialData.nextUnit);

  const prepItem = useCallback((raw: Partial<PlacedItem>, u: UnitModel): PlacedItem => {
    return normalizePlacedItem(raw, u, nextKeyRef.current++);
  }, []);

  const prepSite = useCallback((raw: Partial<PlacedItem>): PlacedItem => {
    return normalizeSiteItem(raw, nextKeyRef.current++);
  }, []);

  const mkUnit = useCallback((preset: string, cx = 0, cz = 0, o: Partial<UnitModel> = {}): UnitModel => {
    const t = UNIT_TYPE[preset] || UNIT_TYPE['20ft'];
    return {
      id: `u${nextUnitRef.current++}`,
      name: '',
      preset: t.id,
      len: t.len,
      wid: t.wid,
      hgt: t.hgt,
      cx,
      cz,
      rot: 0,
      level: 0,
      color: 'green',
      items: [],
      ...o,
    };
  }, []);

  const buildPresetState = useCallback(
    (p: PresetDef) => {
      const built = buildPresetData(p, nextUnitRef.current, nextKeyRef.current);
      nextUnitRef.current = built.nextUnit;
      nextKeyRef.current = built.nextKey;
      return { name: built.name, units: built.units, site: built.site };
    },
    []
  );

  const [name, setName] = useState(initialData.name);
  const [units, setUnits] = useState<UnitModel[]>(initialData.units);
  const [site, setSite] = useState<PlacedItem[]>(initialData.site);
  const [sel, setSel] = useState<SelRef>(null);
  const [unitSystem, setUnitSystem] = useState<'ft' | 'm'>(initialData.unit);
  const [currency, setCurrency] = useState<CurrencyCode>(initialData.currency);
  const [showRoof, setShowRoof] = useState<boolean>(initialData.showRoof);
  const [level, setLevel] = useState<'all' | number>('all');
  const [viewName, setViewName] = useState<'iso' | 'top' | 'front' | 'left'>('iso');
  const [cam, setCam] = useState<Cam>(CAM_VIEWS.iso);
  const [fitTick, setFitTick] = useState(1);

  const [spec, setSpec] = useState<Record<string, string>>(initialData.spec);
  const [services, setServices] = useState<Record<string, number>>(initialData.services);
  const [logistics, setLogistics] = useState<Record<string, number>>(initialData.logistics);
  const [overrides, setOverrides] = useState<Record<string, LineOverride>>(initialData.overrides);
  const [removed, setRemoved] = useState<string[]>(initialData.removed);
  const [customLines, setCustomLines] = useState<CustomLine[]>(initialData.customLines);
  const [customMaterials, setCustomMaterials] = useState<CustomMaterial[]>(() =>
    loadWebStorageJson<CustomMaterial[]>(LS_MATERIALS, [])
  );
  const [rates, setRates] = useState<Partial<RateBook>>(() =>
    loadWebStorageJson<Partial<RateBook>>(LS_RATES, {})
  );
  const [commercial, setCommercial] = useState<CommercialSettings>(initialData.commercial);
  const [company, setCompany] = useState<CompanyMeta>(() => ({
    name: '',
    address: '',
    phone: '',
    email: '',
    regNo: '',
    client: '',
    clientAddress: '',
    quoteNo: `Q-${new Date().getFullYear()}-001`,
    date: today(),
    scope: '',
    terms:
      'Prices valid for 30 days. 70% deposit on order, balance on delivery.\nLead time 3–4 weeks from receipt of deposit.\nPrices subject to change if material costs move before order confirmation.',
    ...loadWebStorageJson<Partial<CompanyMeta>>(LS_COMPANY, {}),
  }));

  const [tab, setTab] = useState<'design' | 'spec' | 'quote' | 'rates'>('design');
  const [sideState, setSideState] = useState<'open' | 'closed'>(() => (isNarrow ? 'closed' : 'open'));
  const [inspState, setInspState] = useState<'open' | 'closed' | 'peek'>(() => (isNarrow ? 'closed' : 'open'));
  const [placeAt, setPlaceAt] = useState<PlaceTarget>(null);
  const [clipboard, setClipboard] = useState<PlacedItem | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuConfig | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragStatus, setDragStatus] = useState<string | null>(null);
  const [howOpenTick, setHowOpenTick] = useState(0);

  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const dragStartSnapRef = useRef<Snapshot | null>(null);
  const stateRef = useRef({ name, units, site });

  useEffect(() => {
    stateRef.current = { name, units, site };
  }, [name, units, site]);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Save project on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          LS_PROJECT,
          JSON.stringify({
            name,
            units,
            site,
            nextKey: nextKeyRef.current,
            nextUnit: nextUnitRef.current,
            unit: unitSystem,
            currency,
            spec,
            services,
            logistics,
            overrides,
            removed,
            customLines,
            commercial,
            showRoof,
          })
        );
      } catch {}
    }
  }, [name, units, site, unitSystem, currency, spec, services, logistics, overrides, removed, customLines, commercial, showRoof]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LS_RATES, JSON.stringify(rates));
        window.localStorage.setItem(LS_COMPANY, JSON.stringify(company));
        window.localStorage.setItem(LS_MATERIALS, JSON.stringify(customMaterials));
      } catch {}
    }
  }, [rates, company, customMaterials]);

  const checkpoint = useCallback(() => {
    undoStackRef.current.push(clone(stateRef.current));
    if (undoStackRef.current.length > 60) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (!undoStackRef.current.length) {
      showToast('Nothing to undo');
      return;
    }
    redoStackRef.current.push(clone(stateRef.current));
    const prev = undoStackRef.current.pop()!;
    setName(prev.name);
    setUnits(prev.units);
    setSite(prev.site);
  }, [showToast]);

  const redo = useCallback(() => {
    if (!redoStackRef.current.length) {
      showToast('Nothing to redo');
      return;
    }
    undoStackRef.current.push(clone(stateRef.current));
    const next = redoStackRef.current.pop()!;
    setName(next.name);
    setUnits(next.units);
    setSite(next.site);
  }, [showToast]);

  const layout = useMemo(() => layoutUnits(units), [units]);
  const topLevel = useMemo(() => Math.max(0, ...units.map((u) => u.level || 0)), [units]);

  const quoteResult = useMemo(
    () =>
      buildQuote(
        { units, site, spec, services, logistics, customMaterials, customLines, commercial },
        rates,
        { overrides, removed }
      ),
    [units, site, spec, services, logistics, customMaterials, customLines, commercial, rates, overrides, removed]
  );

  const selectRef = useCallback(
    (ref: SelRef) => {
      setSel(ref);
      if (ref && isNarrow) {
        setInspState((prev) => (prev === 'closed' ? 'peek' : prev));
      } else if (!ref && isNarrow) {
        setInspState('closed');
      }
    },
    [isNarrow]
  );

  const targetUnit = useCallback(() => {
    if (sel?.t === 'unit' || sel?.t === 'item') {
      return units.find((u) => u.id === sel.id) || units[units.length - 1];
    }
    return units[units.length - 1];
  }, [sel, units]);

  const addUnit = useCallback(
    (preset: string, at: { x?: number; z?: number; level?: number } | null = null) => {
      checkpoint();
      const target = targetUnit();
      let cx = at?.x;
      let cz = at?.z;
      const lv = at?.level ?? 0;
      const u = mkUnit(preset, 0, 0, { color: target?.color || 'green' });
      if (cx == null || cz == null) {
        const ground = units.filter((x) => (x.level || 0) === 0);
        if (ground.length) {
          const r = ground.map(unitRect).reduce((a, b) => ({
            z1: Math.max(a.z1, b.z1),
            x0: Math.min(a.x0, b.x0),
            x1: Math.max(a.x1, b.x1),
            z0: Math.min(a.z0, b.z0),
          }));
          const e = extOf(u);
          cx = r.x0 + e.len / 2;
          cz = r.z1 + e.wid / 2;
        } else {
          cx = 0;
          cz = 0;
        }
      }
      u.cx = r3(cx);
      u.cz = r3(cz);
      u.level = lv;
      setUnits((prev) => [...prev, u]);
      selectRef({ t: 'unit', id: u.id });
      showToast(`${unitName(u)} added${lv ? ` on ${levelName(lv).toLowerCase()}` : ''}`);
      if (isNarrow) setSideState('closed');
    },
    [checkpoint, targetUnit, mkUnit, units, selectRef, showToast, isNarrow]
  );

  const addPart = useCallback(
    (type: string, at: PlaceTarget = placeAt) => {
      const p = PART[type];
      if (!p) return;
      checkpoint();
      if (p.kind === 'site' || (p.siteOk && at?.kind === 'site')) {
        const u = targetUnit();
        let x = at?.x;
        let z = at?.z;
        if (x == null || z == null) {
          if (u) {
            const r = unitRect(u);
            x = u.cx;
            z = r.z0 - (p.d || 1) / 2 - 0.4;
          } else {
            x = 0;
            z = 0;
          }
        }
        const it = prepSite({
          type,
          x: r3(x),
          z: r3(z),
          rot: 0,
          ...(p.stair && u ? { h: r3(BASE_Y + (layout.get(u.id)?.elev || 0) + extOf(u).hgt) } : {}),
        });
        setSite((prev) => [...prev, it]);
        selectRef({ t: 'site', key: it.key });
      } else {
        const u = (at?.unitId ? units.find((x) => x.id === at.unitId) : null) || targetUnit();
        if (!u) {
          undoStackRef.current.pop();
          showToast('Add a container first.');
          return;
        }
        let raw: Partial<PlacedItem> = { kind: p.kind, type };
        if (p.kind === 'opening' || p.kind === 'facade') {
          let wall: WallId | undefined = at?.wall;
          if (!wall) {
            wall =
              /door|garage|roller|fold/.test(type) && !u.items.some((i) => i.kind === 'opening' && i.wall === 'front')
                ? 'front'
                : 'left';
          }
          const w = Math.min(p.w, wallSpan(u, wall) - 0.2);
          let along: number | null = at?.along ?? freeAlong(u, wall, w);
          if (along == null) {
            for (const alt of ['right', 'left', 'back', 'front'] as WallId[]) {
              const a = freeAlong(u, alt, Math.min(p.w, wallSpan(u, alt) - 0.2));
              if (a != null) {
                wall = alt;
                along = a;
                break;
              }
            }
          }
          raw = { ...raw, wall, along: along ?? wallSpan(u, wall) / 2 };
        } else if (p.kind === 'fitting') {
          raw = {
            ...raw,
            x: at?.x ?? u.len / 2,
            z: at?.z ?? u.wid / 2,
            rot: p.isWall ? 0 : p.w > u.wid - 0.3 ? 1 : 0,
          };
          if (p.isWall && p.d) raw.d = Math.min(p.d, u.wid);
          if (p.id === 'mezzanine') {
            raw.x = at?.x ?? 1.25;
            raw.d = u.wid;
            raw.deck = clamp(u.hgt - 0.9, 1.4, 2.2);
          }
        } else if (p.kind === 'roof') {
          raw = { ...raw, x: at?.x ?? u.len / 2, z: at?.z ?? u.wid / 2 };
          if (p.cover) {
            raw.x = u.len / 2;
            raw.z = u.wid / 2;
          }
          if (['roof-deck', 'green-roof', 'solar'].includes(type) && at?.x == null) {
            raw.w = Math.min(p.w, extOf(u).len - 0.2);
          }
        }
        const it = prepItem(raw, u);
        setUnits((prev) => prev.map((x) => (x.id === u.id ? { ...x, items: [...x.items, it] } : x)));
        selectRef({ t: 'item', id: u.id, key: it.key });
        if (p.kind === 'roof' && !showRoof) {
          setShowRoof(true);
          showToast('Roof shown so you can see it');
        }
        if (p.kind === 'fitting' && showRoof && !(layout.get(u.id) && layout.get(u.id)!.covered > 0.5)) {
          setShowRoof(false);
          showToast('Roof hidden to show the inside');
        }
      }
      setPlaceAt(null);
      if (isNarrow) setSideState('closed');
    },
    [placeAt, checkpoint, targetUnit, prepSite, layout, selectRef, units, showToast, prepItem, showRoof, isNarrow]
  );

  const stackOn = useCallback(
    (u: UnitModel) => {
      checkpoint();
      const n = mkUnit(u.preset, u.cx, u.cz, {
        rot: u.rot,
        level: (u.level || 0) + 1,
        color: u.color,
      });
      setUnits((prev) => [...prev, n]);
      selectRef({ t: 'unit', id: n.id });
      setShowRoof(true);
      showToast('Stacked corner to corner');
    },
    [checkpoint, mkUnit, selectRef, showToast]
  );

  const duplicateUnit = useCallback(
    (u: UnitModel) => {
      checkpoint();
      const e = extOf(u);
      const turned = (u.rot || 0) % 2;
      const n: UnitModel = {
        ...clone(u),
        id: `u${nextUnitRef.current++}`,
        name: '',
        cx: r3(turned ? u.cx + e.wid : u.cx),
        cz: r3(turned ? u.cz : u.cz + e.wid),
        items: u.items.map((it) => ({ ...clone(it), key: nextKeyRef.current++ })),
      };
      setUnits((prev) => [...prev, n]);
      selectRef({ t: 'unit', id: n.id });
    },
    [checkpoint, selectRef]
  );

  const duplicateSel = useCallback(() => {
    if (!sel) return;
    if (sel.t === 'unit') {
      const u = units.find((x) => x.id === sel.id);
      if (u) duplicateUnit(u);
      return;
    }
    if (sel.t === 'site') {
      const s = site.find((x) => x.key === sel.key);
      if (!s) return;
      checkpoint();
      const it: PlacedItem = {
        ...clone(s),
        key: nextKeyRef.current++,
        x: r3((s.x ?? 0) + 0.5),
        z: r3((s.z ?? 0) + 0.5),
      };
      setSite((prev) => [...prev, it]);
      selectRef({ t: 'site', key: it.key });
      return;
    }
    if (sel.t === 'item') {
      const u = units.find((x) => x.id === sel.id);
      const orig = u?.items.find((x) => x.key === sel.key);
      if (!u || !orig) return;
      checkpoint();
      const it: PlacedItem = { ...clone(orig), key: nextKeyRef.current++ };
      if (it.kind === 'opening' || it.kind === 'facade') {
        const w = it.w ?? PART[it.type]?.w ?? 1;
        const a = freeAlong(u, it.wall || 'left', w);
        const span = wallSpan(u, it.wall || 'left');
        it.along = a != null ? a : clamp((it.along ?? span / 2) + w + 0.3, w / 2, span - w / 2);
      } else {
        it.x = clamp(r3((it.x ?? u.len / 2) + 0.4), 0, u.len);
        it.z = clamp(r3(it.z ?? u.wid / 2), 0, u.wid);
      }
      setUnits((prev) => prev.map((x) => (x.id === u.id ? { ...x, items: [...x.items, it] } : x)));
      selectRef({ t: 'item', id: u.id, key: it.key });
    }
  }, [sel, units, site, duplicateUnit, checkpoint, selectRef]);

  const removeSel = useCallback(() => {
    if (!sel) return;
    checkpoint();
    if (sel.t === 'unit') {
      const u = units.find((x) => x.id === sel.id);
      if (!u) return;
      const above = units.filter((x) => (layout.get(x.id)?.below || []).includes(u.id));
      setUnits((prev) => prev.filter((x) => x.id !== u.id));
      if (above.length) {
        showToast(
          `${above.length} unit${above.length > 1 ? 's' : ''} above now ${
            above.length > 1 ? 'have' : 'has'
          } nothing under ${above.length > 1 ? 'them' : 'it'}`
        );
      }
    } else if (sel.t === 'site') {
      setSite((prev) => prev.filter((i) => i.key !== sel.key));
    } else if (sel.t === 'item') {
      setUnits((prev) =>
        prev.map((u) => (u.id === sel.id ? { ...u, items: u.items.filter((i) => i.key !== sel.key) } : u))
      );
    }
    selectRef(null);
  }, [sel, checkpoint, units, layout, showToast, selectRef]);

  const rotateSel = useCallback(
    (dir = 1) => {
      if (!sel) return;
      checkpoint();
      if (sel.t === 'unit') {
        setUnits((prev) =>
          prev.map((u) => (u.id === sel.id ? { ...u, rot: (((u.rot || 0) + dir) % 4 + 4) % 4 } : u))
        );
        return;
      }
      if (sel.t === 'site') {
        setSite((prev) =>
          prev.map((it) => (it.key === sel.key ? { ...it, rot: (((it.rot || 0) + dir) % 4 + 4) % 4 } : it))
        );
        return;
      }
      if (sel.t === 'item') {
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id !== sel.id) return u;
            return {
              ...u,
              items: u.items.map((it) => {
                if (it.key !== sel.key) return it;
                if (it.kind === 'opening' || it.kind === 'facade') {
                  const order: WallId[] = ['front', 'right', 'back', 'left'];
                  const nextWall = order[(order.indexOf(it.wall || 'left') + (dir > 0 ? 1 : 3)) % 4];
                  const nextW = Math.min(it.w ?? PART[it.type]?.w ?? 1, wallSpan(u, nextWall) - 0.2);
                  const nextAlong = freeAlong(u, nextWall, nextW) ?? wallSpan(u, nextWall) / 2;
                  return { ...it, wall: nextWall, w: nextW, along: nextAlong };
                }
                if (it.kind === 'roof') {
                  const e = extOf(u);
                  return {
                    ...it,
                    w: Math.min(it.d ?? 1, e.len + 0.6),
                    d: Math.min(it.w ?? 1, e.wid + 0.6),
                  };
                }
                const nextRot = (((it.rot || 0) + dir) % 4 + 4) % 4;
                const { dx, dz } = planSize({ ...it, rot: nextRot });
                return {
                  ...it,
                  rot: nextRot,
                  x: clamp(it.x ?? u.len / 2, dx / 2, Math.max(dx / 2, u.len - dx / 2)),
                  z: clamp(it.z ?? u.wid / 2, dz / 2, Math.max(dz / 2, u.wid - dz / 2)),
                };
              }),
            };
          })
        );
      }
    },
    [sel, checkpoint]
  );

  const nudgeSel = useCallback(
    (dx: number, dz: number) => {
      if (!sel) return;
      if (sel.t === 'unit') {
        setUnits((prev) =>
          prev.map((u) => (u.id === sel.id ? { ...u, cx: r3(u.cx + dx), cz: r3(u.cz + dz) } : u))
        );
      } else if (sel.t === 'site') {
        setSite((prev) =>
          prev.map((it) =>
            it.key === sel.key ? { ...it, x: r3((it.x ?? 0) + dx), z: r3((it.z ?? 0) + dz) } : it
          )
        );
      } else if (sel.t === 'item') {
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id !== sel.id) return u;
            return {
              ...u,
              items: u.items.map((it) => {
                if (it.key !== sel.key) return it;
                if (it.kind === 'opening' || it.kind === 'facade') {
                  const span = wallSpan(u, it.wall || 'left');
                  const w = it.w ?? PART[it.type]?.w ?? 1;
                  return {
                    ...it,
                    along: clamp(r3((it.along ?? span / 2) + (dx || dz)), w / 2, span - w / 2),
                  };
                }
                const r = ((u.rot || 0) % 4 + 4) % 4;
                const [lx, lz] = (
                  [
                    [dx, dz],
                    [dz, -dx],
                    [-dx, -dz],
                    [-dz, dx],
                  ] as [number, number][]
                )[r];
                return {
                  ...it,
                  x: r3((it.x ?? u.len / 2) + lx),
                  z: r3((it.z ?? u.wid / 2) + lz),
                };
              }),
            };
          })
        );
      }
    },
    [sel]
  );

  const copySel = useCallback(() => {
    if (!sel || sel.t === 'unit') return;
    if (sel.t === 'site') {
      const it = site.find((x) => x.key === sel.key);
      if (it) {
        setClipboard(clone(it));
        showToast(`${PART[it.type]?.name || 'Part'} copied`);
      }
    } else if (sel.t === 'item') {
      const u = units.find((x) => x.id === sel.id);
      const it = u?.items.find((x) => x.key === sel.key);
      if (it) {
        setClipboard(clone(it));
        showToast(`${PART[it.type]?.name || 'Part'} copied`);
      }
    }
  }, [sel, site, units, showToast]);

  const pasteClipboard = useCallback(
    (u?: UnitModel | null, at?: PlaceTarget) => {
      if (!clipboard) return;
      if (clipboard.kind === 'site') {
        checkpoint();
        const it: PlacedItem = {
          ...clone(clipboard),
          key: nextKeyRef.current++,
          x: r3(at?.x ?? (clipboard.x ?? 0) + 0.5),
          z: r3(at?.z ?? (clipboard.z ?? 0) + 0.5),
        };
        setSite((prev) => [...prev, it]);
        selectRef({ t: 'site', key: it.key });
        return;
      }
      const target = u || targetUnit();
      if (!target) return;
      checkpoint();
      const it = prepItem(
        {
          ...clone(clipboard),
          ...(at?.kind === 'floor' && clipboard.kind === 'fitting' ? { x: at.x, z: at.z } : {}),
          ...(at?.kind === 'wall' && (clipboard.kind === 'opening' || clipboard.kind === 'facade')
            ? { wall: at.wall, along: at.along }
            : {}),
        },
        target
      );
      if ((it.kind === 'opening' || it.kind === 'facade') && !at) {
        it.along = freeAlong(target, it.wall || 'left', it.w ?? 1) ?? it.along;
      }
      setUnits((prev) => prev.map((x) => (x.id === target.id ? { ...x, items: [...x.items, it] } : x)));
      selectRef({ t: 'item', id: target.id, key: it.key });
    },
    [clipboard, checkpoint, selectRef, targetUnit, prepItem]
  );

  const toggleRoof = useCallback(() => {
    setShowRoof((prev) => {
      const next = !prev;
      showToast(next ? 'Roofs shown' : 'Roofs hidden — look inside');
      return next;
    });
  }, [showToast]);

  const frameAll = useCallback(() => {
    setViewName('iso');
    setCam(CAM_VIEWS.iso);
    setFitTick((t) => t + 1);
  }, []);

  const setView = useCallback((v: 'iso' | 'top' | 'front' | 'left') => {
    setViewName(v);
    setCam(CAM_VIEWS[v]);
    if (v === 'iso') setFitTick((t) => t + 1);
  }, []);

  const loadPreset = useCallback(
    (p: PresetDef) => {
      checkpoint();
      const next = buildPresetState(p);
      setName(next.name);
      setUnits(next.units);
      setSite(next.site);
      setSel(null);
      setShowRoof(true);
      setLevel('all');
      setOverrides({});
      setRemoved([]);
      setFitTick((t) => t + 1);
      showToast(`${p.name} loaded`);
    },
    [checkpoint, buildPresetState, showToast]
  );

  // Keyboard shortcuts on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (presetsOpen) {
          setPresetsOpen(false);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (placeAt) {
          setPlaceAt(null);
          return;
        }
        if (sel) {
          selectRef(null);
          return;
        }
      }
      if (typing) return;
      if (tab !== 'design' && !mod) return;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (mod && k === 'y') {
        e.preventDefault();
        return redo();
      }
      if (tab !== 'design') return;
      if (mod && k === 'd') {
        e.preventDefault();
        return duplicateSel();
      }
      if (mod && k === 'c') {
        e.preventDefault();
        return copySel();
      }
      if (mod && k === 'v') {
        e.preventDefault();
        const u = sel?.t === 'unit' || sel?.t === 'item' ? units.find((x) => x.id === sel.id) : null;
        return pasteClipboard(u);
      }
      if (mod) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel) {
          e.preventDefault();
          removeSel();
        }
        return;
      }
      if (k === 'r') return rotateSel(e.shiftKey ? -1 : 1);
      if (k === 'f') return frameAll();
      if (['1', '2', '3', '4'].includes(e.key)) {
        const v = (['iso', 'top', 'front', 'left'] as const)[Number(e.key) - 1];
        setView(v);
        return;
      }
      const step = e.shiftKey ? 0.25 : 0.05;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (arrows[e.key] && sel) {
        e.preventDefault();
        if (!e.repeat) checkpoint();
        nudgeSel(...arrows[e.key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    presetsOpen,
    contextMenu,
    placeAt,
    sel,
    tab,
    undo,
    redo,
    duplicateSel,
    copySel,
    pasteClipboard,
    units,
    removeSel,
    rotateSel,
    frameAll,
    setView,
    checkpoint,
    nudgeSel,
    selectRef,
  ]);

  // Context menu builder on 3D canvas
  const handleCanvasContextMenu = useCallback(
    (screenX: number, screenY: number, hit: HitResult) => {
      if (hit.ref) selectRef(hit.ref);
      const items: ContextMenuItem[] = [];
      const placeHere = (at: PlaceTarget, list: string[], label: string) => {
        items.push({ heading: label });
        for (const t of list) {
          if (PART[t]) {
            items.push({ label: PART[t].name, icon: 'plus', action: () => addPart(t, at) });
          }
        }
        items.push({
          label: 'More parts here…',
          icon: 'place',
          action: () => {
            setPlaceAt(at);
            setSideState('open');
          },
        });
      };

      if (hit.ref?.t === 'item' || hit.ref?.t === 'site') {
        const hitRef = hit.ref;
        const isSite = hitRef.t === 'site';
        const u = !isSite ? units.find((x) => x.id === hitRef.id) : undefined;
        const it = isSite
          ? site.find((x) => x.key === hitRef.key)
          : u?.items.find((x) => x.key === hitRef.key);
        if (!it) return;
        const p = PART[it.type];
        items.push({
          label: 'Properties',
          icon: 'info',
          shortcut: '↵',
          action: () => setInspState('open'),
        });
        items.push({ label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl D', action: duplicateSel });
        if ((it.kind === 'opening' || it.kind === 'facade') && u) {
          items.push({ heading: 'Move to wall' });
          for (const w of WALLS) {
            if (w.id !== it.wall) {
              items.push({
                label: w.name,
                action: () => {
                  checkpoint();
                  const nextW = Math.min(it.w ?? p?.w ?? 1, wallSpan(u, w.id) - 0.2);
                  const nextAlong = freeAlong(u, w.id, nextW) ?? wallSpan(u, w.id) / 2;
                  setUnits((prev) =>
                    prev.map((x) =>
                      x.id === u.id
                        ? {
                            ...x,
                            items: x.items.map((item) =>
                              item.key === it.key ? { ...item, wall: w.id, w: nextW, along: nextAlong } : item
                            ),
                          }
                        : x
                    )
                  );
                },
              });
            }
          }
          items.push({
            label: 'Centre on this wall',
            action: () => {
              checkpoint();
              const centered = wallSpan(u, it.wall || 'left') / 2;
              setUnits((prev) =>
                prev.map((x) =>
                  x.id === u.id
                    ? {
                        ...x,
                        items: x.items.map((item) => (item.key === it.key ? { ...item, along: centered } : item)),
                      }
                    : x
                )
              );
            },
          });
        } else {
          items.push({ label: 'Turn 90°', icon: 'rotate', shortcut: 'R', action: () => rotateSel(1) });
        }
        if (p?.how) {
          items.push({
            label: 'How it’s built',
            icon: 'info',
            action: () => {
              setInspState('open');
              setHowOpenTick((t) => t + 1);
            },
          });
        }
        items.push({ label: 'Copy', shortcut: 'Ctrl C', action: copySel });
        items.push({ separator: true });
        items.push({ label: 'Delete', icon: 'trash', shortcut: 'Del', destructive: true, action: removeSel });
        setContextMenu({ x: screenX, y: screenY, title: p?.name || 'Part', items });
        return;
      }

      if (hit.ref?.t === 'unit') {
        const u = units.find((x) => x.id === (hit.ref as { id: string }).id);
        if (!u) return;
        const at = placementAt(hit, null, units);
        if (at?.kind === 'floor' && at.wall) {
          const elev = layout.get(u.id)?.elev || 0;
          const lp = worldToUnitLocal(hit.point, u, elev);
          const along = r3(
            at.wall === 'left'
              ? lp[0] + u.len / 2
              : at.wall === 'right'
              ? u.len / 2 - lp[0]
              : at.wall === 'front'
              ? lp[2] + u.wid / 2
              : u.wid / 2 - lp[2]
          );
          const wName = WALLS.find((w) => w.id === at.wall)?.name.toLowerCase() || 'wall';
          placeHere({ kind: 'wall', unitId: u.id, wall: at.wall, along }, quickParts.wall, `Add to the ${wName}`);
        } else if (at?.kind === 'roof') {
          placeHere(at, quickParts.roof, 'Add to the roof');
        } else if (at) {
          placeHere(at, quickParts.floor, 'Add here');
        }
        items.push({ separator: true });
        items.push({ heading: unitName(u) });
        items.push({ label: 'Stack a unit on top', icon: 'stack', action: () => stackOn(u) });
        items.push({ label: 'Duplicate alongside', icon: 'copy', shortcut: 'Ctrl D', action: () => duplicateUnit(u) });
        items.push({
          label: 'Turn 90°',
          icon: 'rotate',
          shortcut: 'R',
          action: () => {
            selectRef({ t: 'unit', id: u.id });
            rotateSel(1);
          },
        });
        items.push({ label: showRoof ? 'Hide roofs' : 'Show roofs', icon: 'roof', action: toggleRoof });
        if (clipboard && clipboard.kind !== 'site') {
          items.push({ label: 'Paste into this unit', shortcut: 'Ctrl V', action: () => pasteClipboard(u, at) });
        }
        items.push({ separator: true });
        items.push({
          label: 'Remove unit',
          icon: 'trash',
          destructive: true,
          action: () => {
            selectRef({ t: 'unit', id: u.id });
            removeSel();
          },
        });
        setContextMenu({
          x: screenX,
          y: screenY,
          title: `${unitName(u)} · ${levelName(u.level || 0)}`,
          items,
        });
        return;
      }

      // Site / ground hit
      const at: PlaceTarget = { kind: 'site', x: r3(hit.point[0]), z: r3(hit.point[2]) };
      items.push({ heading: 'Add a unit here' });
      for (const id of ['20ft', '40ft', '40hc', 'pc20'] as const) {
        items.push({
          label: UNIT_TYPE[id].name,
          icon: 'box',
          action: () => addUnit(id, { x: at.x, z: at.z }),
        });
      }
      placeHere(at, quickParts.site, 'Add to the site');
      items.push({ separator: true });
      if (clipboard?.kind === 'site') {
        items.push({ label: 'Paste here', shortcut: 'Ctrl V', action: () => pasteClipboard(null, at) });
      }
      items.push({ label: 'Start from a design…', icon: 'grid', action: () => setPresetsOpen(true) });
      items.push({ label: 'Fit view', icon: 'fit', shortcut: 'F', action: frameAll });
      items.push({ label: showRoof ? 'Hide roofs' : 'Show roofs', icon: 'roof', action: toggleRoof });
      setContextMenu({ x: screenX, y: screenY, title: 'Site', items });
    },
    [
      selectRef,
      addPart,
      units,
      site,
      duplicateSel,
      checkpoint,
      rotateSel,
      copySel,
      removeSel,
      layout,
      stackOn,
      duplicateUnit,
      showRoof,
      toggleRoof,
      clipboard,
      pasteClipboard,
      addUnit,
      frameAll,
    ]
  );

  const openMoreMenu = () => {
    setContextMenu({
      x: width - 260,
      y: 56,
      title: 'Build',
      items: [
        { label: 'Start from a design…', icon: 'grid', action: () => setPresetsOpen(true) },
        {
          label: 'New empty build',
          icon: 'plus',
          action: () => {
            checkpoint();
            setUnits([]);
            setSite([]);
            setName('Untitled build');
            setSel(null);
            frameAll();
            showToast('New empty build');
          },
        },
        { separator: true },
        {
          label: unitSystem === 'ft' ? 'Measure in metres' : 'Measure in feet',
          action: () => setUnitSystem((u) => (u === 'ft' ? 'm' : 'ft')),
        },
        { label: showRoof ? 'Hide roofs' : 'Show roofs', icon: 'roof', action: toggleRoof },
        { label: 'Fit view', icon: 'fit', shortcut: 'F', action: frameAll },
        { separator: true },
        {
          heading:
            'Keys: click select · drag selected to move · R turn · Del delete · Ctrl D duplicate · arrows nudge · 1–4 views · F fit',
        },
      ],
    });
  };

  // Inspector callbacks
  const handleUpdateUnit = useCallback(
    (id: string, patch: Partial<UnitModel>) => {
      checkpoint();
      if (patch.level !== undefined) setShowRoof(true);
      setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    },
    [checkpoint]
  );

  const handleChangeUnitPreset = useCallback(
    (id: string, preset: string) => {
      const t = UNIT_TYPE[preset];
      if (!t) return;
      checkpoint();
      setUnits((prev) =>
        prev.map((u) => {
          if (u.id !== id) return u;
          const updated: UnitModel = { ...u, preset: t.id, len: t.len, wid: t.wid, hgt: t.hgt };
          updated.items = updated.items.map((it) => prepItem({ ...it }, updated));
          return updated;
        })
      );
    },
    [checkpoint, prepItem]
  );

  const handleUpdateItem = useCallback(
    (ref: SelRef, patch: Partial<PlacedItem>) => {
      if (!ref) return;
      checkpoint();
      if (ref.t === 'site') {
        setSite((prev) => prev.map((it) => (it.key === ref.key ? { ...it, ...patch } : it)));
      } else if (ref.t === 'item') {
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id !== ref.id) return u;
            return {
              ...u,
              items: u.items.map((it) => {
                if (it.key !== ref.key) return it;
                const next = { ...it, ...patch };
                if (next.kind === 'opening' || next.kind === 'facade') {
                  const span = wallSpan(u, next.wall || 'left');
                  next.w = clamp(next.w ?? 1, 0.1, span - 0.1);
                  next.h = clamp(next.h ?? 1, 0.05, next.kind === 'facade' ? u.hgt + 0.4 : u.hgt - 0.02);
                  if (next.kind === 'opening') {
                    next.sill = clamp(next.sill ?? 0, 0, Math.max(0, u.hgt - next.h));
                  }
                  next.along = clamp(next.along ?? span / 2, next.w / 2, span - next.w / 2);
                }
                if (next.kind === 'fitting' && next.deck != null) {
                  next.deck = clamp(next.deck, 1.0, u.hgt - 0.3);
                }
                return next;
              }),
            };
          })
        );
      }
    },
    [checkpoint]
  );

  const handleChangeItemWall = useCallback(
    (unitId: string, itemKey: number, wall: WallId) => {
      checkpoint();
      setUnits((prev) =>
        prev.map((u) => {
          if (u.id !== unitId) return u;
          return {
            ...u,
            items: u.items.map((it) => {
              if (it.key !== itemKey) return it;
              const nextW = Math.min(it.w ?? PART[it.type]?.w ?? 1, wallSpan(u, wall) - 0.2);
              const nextAlong = freeAlong(u, wall, nextW) ?? wallSpan(u, wall) / 2;
              return { ...it, wall, w: nextW, along: nextAlong };
            }),
          };
        })
      );
    },
    [checkpoint]
  );

  // Status bar text
  const statusSelText = useMemo(() => {
    if (dragStatus) return dragStatus;
    if (!sel) return placeAt ? 'Choose a part to place' : 'Nothing selected — right-click or long-press for actions';
    if (sel.t === 'unit') {
      const u = units.find((x) => x.id === sel.id);
      if (!u) return 'Nothing selected';
      return `${unitName(u)} · ${levelName(u.level || 0)} · ${u.items.length} parts`;
    }
    if (sel.t === 'site') {
      const it = site.find((x) => x.key === sel.key);
      return `${PART[it?.type || '']?.name || 'Part'} · site`;
    }
    if (sel.t === 'item') {
      const u = units.find((x) => x.id === sel.id);
      const it = u?.items.find((x) => x.key === sel.key);
      if (!u || !it) return 'Nothing selected';
      const p = PART[it.type];
      if (it.kind === 'opening' || it.kind === 'facade') {
        const wName = WALLS.find((w) => w.id === it.wall)?.name || '';
        return `${p?.name} · ${wName} · ${fmtLen(it.along ?? 0, unitSystem)} along`;
      }
      return `${p?.name} · ${unitName(u)}`;
    }
    return '';
  }, [dragStatus, sel, placeAt, units, site, unitSystem]);

  const levelCount = useMemo(() => new Set(units.map((u) => u.level || 0)).size, [units]);
  const statusStatsText = `${units.length} unit${units.length === 1 ? '' : 's'} · ${levelCount} level${
    levelCount === 1 ? '' : 's'
  } · ${fmtArea(quoteResult.quantities.floorArea || 0, unitSystem)}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.mainLayout}>
        {/* Left Sidebar (Desktop/Tablet inline) */}
        {!isNarrow && sideState === 'open' && (
          <View style={styles.sideDesktop}>
            <BuildPanel
              units={units}
              placeAt={placeAt}
              onCancelPlace={() => setPlaceAt(null)}
              onAddUnit={(preset) => addUnit(preset)}
              onAddPart={(partId) => addPart(partId)}
              onOpenPresets={() => setPresetsOpen(true)}
            />
          </View>
        )}

        {/* Main Section */}
        <View style={styles.mainPane}>
          {/* Top Bar */}
          <View style={[styles.bar, isNarrow && styles.barNarrow]}>
            <View style={styles.barTopRow}>
              <Pressable
                onPress={() => setSideState((s) => (s === 'open' ? 'closed' : 'open'))}
                style={styles.iconBtn}
              >
                <Icon name="side" size={16} color={sideState === 'open' ? c.lime : c.dim} />
              </Pressable>

              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.titleInput}
                placeholder="Build name"
                placeholderTextColor={c.mute}
              />

              {!isNarrow && (
                <View style={styles.tabs}>
                  {(
                    [
                      ['design', 'Design'],
                      ['spec', 'Specification'],
                      ['quote', 'Quote'],
                      ['rates', 'Rates'],
                    ] as const
                  ).map(([id, label]) => (
                    <Pressable
                      key={id}
                      onPress={() => setTab(id)}
                      style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
                    >
                      <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.barRight}>
                {tab === 'design' && (
                  <>
                    <Pressable onPress={undo} style={styles.iconBtn}>
                      <Icon name="undo" size={16} color={c.dim} />
                    </Pressable>
                    <Pressable onPress={redo} style={styles.iconBtn}>
                      <Icon name="redo" size={16} color={c.dim} />
                    </Pressable>
                    {!isNarrow && (
                      <Pressable
                        onPress={() => setInspState((s) => (s === 'closed' ? 'open' : 'closed'))}
                        style={styles.iconBtn}
                      >
                        <Icon name="insp" size={16} color={inspState !== 'closed' ? c.lime : c.dim} />
                      </Pressable>
                    )}
                  </>
                )}
                <Pressable onPress={openMoreMenu} style={styles.iconBtn}>
                  <Icon name="more" size={16} color={c.dim} />
                </Pressable>
              </View>
            </View>

            {isNarrow && (
              <View style={styles.tabsNarrow}>
                {(
                  [
                    ['design', 'Design'],
                    ['spec', 'Specification'],
                    ['quote', 'Quote'],
                    ['rates', 'Rates'],
                  ] as const
                ).map(([id, label]) => (
                  <Pressable
                    key={id}
                    onPress={() => setTab(id)}
                    style={[styles.tabBtn, { flex: 1, alignItems: 'center' }, tab === id && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            {tab === 'design' && (
              <View style={styles.designBody}>
                {/* 3D Stage */}
                <View style={styles.stage}>
                  <Viewport
                    units={units}
                    site={site}
                    showRoof={showRoof}
                    level={level}
                    spec={spec}
                    sel={sel}
                    cam={cam}
                    setCam={setCam}
                    fitTick={fitTick}
                    onSelect={selectRef}
                    onDragStart={() => {
                      dragStartSnapRef.current = clone(stateRef.current);
                    }}
                    onDragMove={(_ref, updater) => {
                      const res = updater(stateRef.current.units, stateRef.current.site);
                      setUnits(res.units);
                      setSite(res.site);
                      if (res.status) setDragStatus(res.status);
                    }}
                    onDragEnd={(moved) => {
                      setDragStatus(null);
                      if (moved && dragStartSnapRef.current) {
                        undoStackRef.current.push(dragStartSnapRef.current);
                        redoStackRef.current = [];
                      }
                      dragStartSnapRef.current = null;
                    }}
                    onContextMenu={handleCanvasContextMenu}
                    onDropPart={(partId, hit) => {
                      const at = placementAt(hit, PART[partId] || null, units);
                      addPart(partId, at);
                    }}
                  />

                  {/* Bottom-left Floating Pills: Levels + Roof */}
                  <View
                    style={[
                      styles.floatLeft,
                      isNarrow && inspState === 'peek' && { bottom: 132 },
                    ]}
                    pointerEvents="box-none"
                  >
                    {topLevel > 0 && (
                      <View style={styles.seg}>
                        {(
                          [
                            ['all', 'All'],
                            ...Array.from({ length: topLevel + 1 }, (_, i) => [i, i === 0 ? 'G' : `L${i}`] as const),
                          ] as const
                        ).map(([v, label]) => {
                          const active = String(level) === String(v);
                          return (
                            <Pressable
                              key={String(v)}
                              onPress={() => setLevel(v === 'all' ? 'all' : Number(v))}
                              style={[styles.segBtn, active && styles.segBtnActive]}
                            >
                              <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    <Pressable
                      onPress={toggleRoof}
                      style={[styles.pill, showRoof && styles.pillActive]}
                    >
                      <Icon name="roof" size={14} color={showRoof ? c.text : c.mute} />
                      {!isNarrow && (
                        <Text style={[styles.pillText, showRoof && { color: c.text }]}>Roof</Text>
                      )}
                    </Pressable>
                  </View>

                  {/* Bottom-right Floating Pills: Views + Fit */}
                  <View
                    style={[
                      styles.floatRight,
                      isNarrow && inspState === 'peek' && { bottom: 132 },
                    ]}
                    pointerEvents="box-none"
                  >
                    <View style={styles.seg}>
                      {(
                        [
                          ['iso', '3D', 'cube3'],
                          ['top', 'Plan', 'plan'],
                          ...(!isNarrow
                            ? ([
                                ['front', 'Front', null],
                                ['left', 'Side', null],
                              ] as const)
                            : []),
                        ] as const
                      ).map(([v, label, icName]) => {
                        const active = viewName === v;
                        return (
                          <Pressable
                            key={v}
                            onPress={() => setView(v as 'iso' | 'top' | 'front' | 'left')}
                            style={[styles.segBtn, active && styles.segBtnActive]}
                          >
                            {icName ? (
                              <Icon name={icName} size={14} color={active ? c.bg : c.dim} />
                            ) : null}
                            {(!isNarrow || !icName) && (
                              <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>
                                {label}
                              </Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    <Pressable onPress={frameAll} style={styles.pillIcon}>
                      <Icon name="fit" size={14} color={c.dim} />
                    </Pressable>
                  </View>

                  {/* Toast */}
                  {toast ? (
                    <View style={styles.toast} pointerEvents="none">
                      <Text style={styles.toastText}>{toast}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Right Inspector (Desktop inline) */}
                {!isNarrow && inspState !== 'closed' && (
                  <View style={styles.inspDesktop}>
                    <Inspector
                      name={name}
                      units={units}
                      site={site}
                      sel={sel}
                      unitSystem={unitSystem}
                      currency={currency}
                      grandTotal={quoteResult.totals.grandTotal}
                      quantities={quoteResult.quantities}
                      rates={rates}
                      overrides={overrides}
                      customMaterials={customMaterials}
                      howOpenTick={howOpenTick}
                      onSelect={selectRef}
                      onUpdateUnit={handleUpdateUnit}
                      onChangeUnitPreset={handleChangeUnitPreset}
                      onUpdateItem={handleUpdateItem}
                      onChangeItemWall={handleChangeItemWall}
                      onRotate={() => rotateSel(1)}
                      onDuplicate={duplicateSel}
                      onDelete={removeSel}
                      onStackUnit={stackOn}
                    />
                  </View>
                )}

                {/* Mobile Bottom Sheet Inspector */}
                {isNarrow && inspState !== 'closed' && (
                  <View
                    style={[
                      styles.inspSheet,
                      inspState === 'peek' ? styles.inspSheetPeek : styles.inspSheetOpen,
                    ]}
                  >
                    <Pressable
                      onPress={() => setInspState((s) => (s === 'open' ? 'peek' : 'open'))}
                      style={styles.grabBar}
                    >
                      <View style={styles.grabHandle} />
                    </Pressable>
                    <Inspector
                      name={name}
                      units={units}
                      site={site}
                      sel={sel}
                      unitSystem={unitSystem}
                      currency={currency}
                      grandTotal={quoteResult.totals.grandTotal}
                      quantities={quoteResult.quantities}
                      rates={rates}
                      overrides={overrides}
                      customMaterials={customMaterials}
                      howOpenTick={howOpenTick}
                      onSelect={selectRef}
                      onUpdateUnit={handleUpdateUnit}
                      onChangeUnitPreset={handleChangeUnitPreset}
                      onUpdateItem={handleUpdateItem}
                      onChangeItemWall={handleChangeItemWall}
                      onRotate={() => rotateSel(1)}
                      onDuplicate={duplicateSel}
                      onDelete={removeSel}
                      onStackUnit={stackOn}
                    />
                  </View>
                )}
              </View>
            )}

            {tab === 'spec' && (
              <SpecPanel
                spec={spec}
                services={services}
                logistics={logistics}
                customMaterials={customMaterials}
                quantities={quoteResult.quantities}
                unitSystem={unitSystem}
                onChangeSpec={(elId, optId) => setSpec((prev) => ({ ...prev, [elId]: optId }))}
                onChangeService={(sId, qty) => setServices((prev) => ({ ...prev, [sId]: qty }))}
                onChangeLogistics={(lId, qty) => setLogistics((prev) => ({ ...prev, [lId]: qty }))}
              />
            )}

            {tab === 'quote' && (
              <QuoteSheet
                buildName={name}
                units={units}
                unitSystem={unitSystem}
                currency={currency}
                company={company}
                commercial={commercial}
                lines={quoteResult.lines}
                totals={quoteResult.totals}
                quantities={quoteResult.quantities}
                onChangeCurrency={setCurrency}
                onChangeCompany={(patch) => setCompany((prev) => ({ ...prev, ...patch }))}
                onChangeCommercial={(patch) => setCommercial((prev) => ({ ...prev, ...patch }))}
                onOverrideLine={(lineId, patch) =>
                  setOverrides((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }))
                }
                onRemoveLine={(lineId) => setRemoved((prev) => [...prev, lineId])}
                onAddCustomLine={() =>
                  setCustomLines((prev) => [
                    ...prev,
                    {
                      id: `custom:${Date.now()}`,
                      name: 'New item',
                      unit: 'each',
                      qty: 1,
                      wastage: 0,
                      rate: 0,
                      labour: 0,
                    },
                  ])
                }
                onToast={showToast}
              />
            )}

            {tab === 'rates' && (
              <RatesPanel
                currency={currency}
                rates={rates}
                customMaterials={customMaterials}
                onUpdateRate={(key, field, val) => {
                  const book = defaultRateBook(customMaterials);
                  setRates((prev) => ({
                    ...prev,
                    [key]: { ...book[key], ...prev[key], [field]: val },
                  }));
                }}
                onResetRates={() => setRates({})}
                onImportRates={(nextRates, nextMaterials) => {
                  setRates(nextRates);
                  if (nextMaterials) setCustomMaterials(nextMaterials);
                }}
                onAddMaterial={(mat) => setCustomMaterials((prev) => [...prev, mat])}
                onRemoveMaterial={(id) => {
                  setCustomMaterials((prev) => prev.filter((m) => m.id !== id));
                  setSpec((prev) => {
                    const next = { ...prev };
                    for (const [k, v] of Object.entries(next)) {
                      if (v === id) next[k] = 'none';
                    }
                    return next;
                  });
                }}
                onToast={showToast}
              />
            )}
          </View>

          {/* Status Bar */}
          <View style={styles.statusBar}>
            {!isNarrow && (
              <Text style={styles.statusSel} numberOfLines={1}>
                {statusSelText}
              </Text>
            )}
            {isNarrow && tab === 'design' && (
              <Pressable
                onPress={() => setInspState((s) => (s === 'open' ? 'closed' : 'open'))}
                style={styles.mobileInspChip}
              >
                <Icon name="insp" size={13} color={c.text} />
                <Text style={styles.mobileInspChipText}>Inspector</Text>
              </Pressable>
            )}
            <Text style={[styles.statusStats, isNarrow && { flex: 1 }]} numberOfLines={1}>
              {statusStatsText}
            </Text>
            <Pressable onPress={() => setTab('quote')} style={styles.statusTotal}>
              <Text style={styles.statusTotalText}>{money(quoteResult.totals.grandTotal, currency)}</Text>
            </Pressable>
          </View>
        </View>

        {/* Mobile Left Slide-Over Drawer for Parts Library */}
        {isNarrow && sideState === 'open' && (
          <>
            <Pressable
              style={styles.scrim}
              onPress={() => setSideState('closed')}
            />
            <View style={styles.sideDrawerMobile}>
              <BuildPanel
                units={units}
                placeAt={placeAt}
                onCancelPlace={() => setPlaceAt(null)}
                onAddUnit={(preset) => addUnit(preset)}
                onAddPart={(partId) => addPart(partId)}
                onOpenPresets={() => setPresetsOpen(true)}
              />
            </View>
          </>
        )}
      </View>

      {/* Modals */}
      <PresetsModal
        visible={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        onSelectPreset={loadPreset}
      />

      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  sideDesktop: {
    width: 272,
    borderRightWidth: 1,
    borderRightColor: c.line,
    backgroundColor: c.panel,
  },
  sideDrawerMobile: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    maxWidth: '86%',
    zIndex: 25,
    backgroundColor: c.panel,
    borderRightWidth: 1,
    borderRightColor: c.line2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 14,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  mainPane: {
    flex: 1,
    minWidth: 0,
  },
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    backgroundColor: c.panel,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  barNarrow: {
    gap: 8,
  },
  barTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInput: {
    flex: 1,
    minWidth: 80,
    maxWidth: 300,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    color: c.text,
    fontSize: 15.5,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    marginLeft: 'auto',
    backgroundColor: c.panel2,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: c.line,
  },
  tabsNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    backgroundColor: c.panel2,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: c.line,
  },
  tabBtn: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 7,
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: c.raised,
  },
  tabText: {
    color: c.dim,
    fontSize: 12.5,
    fontWeight: '500',
  },
  tabTextActive: {
    color: c.text,
    fontWeight: '600',
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  designBody: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  stage: {
    flex: 1,
    position: 'relative',
  },
  inspDesktop: {
    width: 316,
    borderLeftWidth: 1,
    borderLeftColor: c.line,
    backgroundColor: c.panel,
  },
  inspSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
    backgroundColor: c.panel,
    borderTopWidth: 1,
    borderTopColor: c.line2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  inspSheetPeek: {
    height: 120,
  },
  inspSheetOpen: {
    height: '62%',
  },
  grabBar: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line2,
  },
  floatLeft: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatRight: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    backgroundColor: 'rgba(14,15,17,0.9)',
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: 9,
  },
  segBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  segBtnActive: {
    backgroundColor: c.lime,
  },
  segBtnText: {
    color: c.dim,
    fontSize: 12,
    fontWeight: '600',
  },
  segBtnTextActive: {
    color: c.bg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(14,15,17,0.9)',
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: 9,
  },
  pillActive: {
    borderColor: c.lime,
  },
  pillText: {
    color: c.mute,
    fontSize: 12,
    fontWeight: '500',
  },
  pillIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,15,17,0.9)',
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: 9,
  },
  toast: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: c.text,
  },
  toastText: {
    color: c.bg,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusBar: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.panel,
  },
  statusSel: {
    flex: 1,
    color: c.mute,
    fontSize: 12,
  },
  statusStats: {
    color: c.mute,
    fontSize: 12,
  },
  statusTotal: {
    height: 26,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: c.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTotalText: {
    color: c.bg,
    fontSize: 12.5,
    fontWeight: '700',
  },
  mobileInspChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line2,
  },
  mobileInspChipText: {
    color: c.text,
    fontSize: 11.5,
    fontWeight: '500',
  },
});
