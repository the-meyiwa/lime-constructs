import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Viewport } from './components/Viewport';
import { BuildPanel } from './components/BuildPanel';
import { Inspector } from './components/Inspector';
import { QuoteSheet } from './components/QuoteSheet';
import { Icon } from './components/Icon';
import { Btn } from './components/ui';
import { CORNER_POST_MARGIN, OPENING, PRESETS, TYPE, makeOpening, makeUnit } from './data';
import { buildQuote, formatCompact } from './quote';
import { footprint, unitBox, unsupportedCorners, wallLen } from './geo';
import { displaceUnits } from './displacement';
import type { Cam, Opening, ProjectMeta, Unit, ViewMode, Wall, WarningItem } from './types';
import { c } from './theme';

const camFor = (mode: ViewMode): Cam =>
  mode === 'plan' ? { az: 0, el: 1.52, dist: 27 } : { az: 0.8, el: 0.58, dist: 21 };

const rectOf = (u: Unit) => {
  const p = footprint(u);
  return { x0: p[0][0], x1: p[1][0], z0: p[0][1], z1: p[2][1] };
};

function evaluateWarnings(units: Unit[]): WarningItem[] {
  const out: WarningItem[] = [];
  const rects = units.map(rectOf);

  // 1. Overlapping units on the same level
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      if (units[i].level !== units[j].level) continue;
      const a = rects[i];
      const b = rects[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 0.04 && oz > 0.04) {
        const nameA = units[i].label || TYPE[units[i].type]?.short || 'Unit';
        const nameB = units[j].label || TYPE[units[j].type]?.short || 'Unit';
        out.push({
          id: 'overlap_' + units[i].id + '_' + units[j].id,
          severity: 'error',
          unitIds: [units[i].id, units[j].id],
          text: `${nameA} and ${nameB} overlap by ${(ox * oz).toFixed(1)} m² on L${units[i].level + 1}`,
        });
      }
    }
  }

  // 2. Upper-level support & cantilever checks
  const hasUpperUnits = units.some((u) => u.level > 0);
  const hasStairs = units.some((u) => u.stairs);
  if (hasUpperUnits && !hasStairs) {
    const upperIds = units.filter((u) => u.level > 0).map((u) => u.id);
    out.push({
      id: 'no_stairs',
      severity: 'warn',
      unitIds: upperIds,
      text: 'Upper level has no external staircase assigned (enable External Steel Stair in Detail)',
    });
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const name = u.label || TYPE[u.type]?.short || 'Unit';
    const box = unitBox(u);

    if (u.level > 0) {
      const a = rects[i];
      const area = (a.x1 - a.x0) * (a.z1 - a.z0);
      let covered = 0;
      for (let j = 0; j < units.length; j++) {
        if (units[j].level !== u.level - 1) continue;
        const b = rects[j];
        const ox = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
        const oz = Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
        covered += ox * oz;
      }
      const cols = unsupportedCorners(u, units);
      if (covered < area * 0.45) {
        out.push({
          id: 'floating_' + u.id,
          severity: 'error',
          unitIds: [u.id],
          text: `${name} (L${u.level + 1}) has <45% lower support (${cols.length} steel columns auto-added to BoQ)`,
        });
      } else if (cols.length > 0) {
        out.push({
          id: 'cantilever_' + u.id,
          severity: 'warn',
          unitIds: [u.id],
          text: `${name} (L${u.level + 1}) cantilevers ${cols.length} corner(s) — ${cols.length} SHS steel columns added to BoQ`,
        });
      }
    }

    // 3. Opening collision, corner post clearance, and excessive wall removal checks
    for (const w of ['front', 'back', 'left', 'right'] as const) {
      const wLen = wallLen(w, box);
      const wallOps = u.openings.filter((o) => o.wall === w);
      let cutWidth = 0;

      for (let a = 0; a < wallOps.length; a++) {
        const oa = wallOps[a];
        cutWidth += oa.w;
        const leftEdge = oa.along - oa.w / 2;
        const rightEdge = oa.along + oa.w / 2;
        if (leftEdge < CORNER_POST_MARGIN - 0.02 || rightEdge > wLen - CORNER_POST_MARGIN + 0.02) {
          out.push({
            id: 'corner_post_' + oa.id,
            severity: 'error',
            unitIds: [u.id],
            text: `${name}: ${oa.label} on ${w} wall encroaches on ISO structural corner post (<0.22m)`,
          });
        }
        for (let b = a + 1; b < wallOps.length; b++) {
          const ob = wallOps[b];
          const horizOverlap = Math.min(oa.along + oa.w / 2, ob.along + ob.w / 2) - Math.max(oa.along - oa.w / 2, ob.along - ob.w / 2);
          const vertOverlap = Math.min(oa.sill + oa.h, ob.sill + ob.h) - Math.max(oa.sill, ob.sill);
          if (horizOverlap > 0.02 && vertOverlap > 0.02) {
            out.push({
              id: 'op_overlap_' + oa.id + '_' + ob.id,
              severity: 'error',
              unitIds: [u.id],
              text: `${name}: ${oa.label} and ${ob.label} overlap on ${w} wall — slide position in Detail`,
            });
          }
        }
      }

      if (cutWidth > wLen * 0.68) {
        out.push({
          id: 'wall_cut_' + u.id + '_' + w,
          severity: 'warn',
          unitIds: [u.id],
          text: `${name}: ${Math.round((cutWidth / wLen) * 100)}% of ${w} corrugated wall removed — portal frame steel required`,
        });
      }
    }
  }

  return out;
}

const STORAGE_KEY = 'lime_constructs_project_v2';

export function Planner() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const narrow = width < 450;

  const [units, setUnits] = useState<Unit[]>(PRESETS[1].units);
  const [meta, setMeta] = useState<ProjectMeta>({
    name: 'Container Build Concept',
    client: '',
    site: 'Lagos, NG',
    currency: 'NGN',
    notes: '',
  });
  const [selected, setSelected] = useState<string | null>(PRESETS[1].units[0]?.id || null);
  const [mode, setMode] = useState<ViewMode>('3d');
  const [cam, setCam] = useState<Cam>(camFor('3d'));
  const [quote, setQuote] = useState(false);
  const [tab, setTab] = useState<'build' | 'detail'>('build');
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<Unit[][]>([]);
  const [future, setFuture] = useState<Unit[][]>([]);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [imperial, setImperial] = useState<boolean>(false);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [showWarnings, setShowWarnings] = useState<boolean>(false);
  const [moveMode, setMoveMode] = useState<boolean>(false);
  const unitsRef = React.useRef(units);
  unitsRef.current = units;
  const dragSnapshotRef = React.useRef<Unit[] | null>(null);

  // Load saved project on web startup
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.units) && parsed.units.length > 0) {
            setUnits(parsed.units);
            setSelected(parsed.units[0].id);
          }
          if (parsed.meta) setMeta((m) => ({ ...m, ...parsed.meta }));
        }
      } catch {}
    }
  }, []);

  // Auto-save on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ units, meta }));
      } catch {}
    }
  }, [units, meta]);

  const commit = useCallback((nextOrFn: Unit[] | ((prev: Unit[]) => Unit[])) => {
    setUnits((prev) => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      setHistory((h) => [...h.slice(-30), prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [unitsRef.current, ...f]);
      setUnits(prev);
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h, unitsRef.current]);
      setUnits(next);
      return f.slice(1);
    });
  }, []);

  // Web keyboard shortcuts for Undo / Redo / Delete
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const patch = useCallback(
    (id: string, p: Partial<Unit>) => {
      commit((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));
    },
    [commit]
  );

  const handleDragStart = useCallback(() => {
    dragSnapshotRef.current = unitsRef.current;
  }, []);

  const handleMoveUnit = useCallback((id: string, x: number, z: number) => {
    setUnits((prev) => displaceUnits(id, x, z, prev));
  }, []);

  const handleDragEnd = useCallback(() => {
    const snap = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (snap && snap !== unitsRef.current) {
      setHistory((h) => [...h.slice(-30), snap]);
      setFuture([]);
    }
  }, []);

  const addUnit = (typeId: string) => {
    // Fixed bug: calculate existing bounding box using each existing unit's own dimensions, and snap flush side-by-side!
    const anchor = units.find((u) => u.id === selected) || units[units.length - 1];
    let nextX = 0;
    let nextZ = 0;
    let nextLevel = 0;
    if (anchor) {
      const ab = unitBox(anchor);
      nextX = anchor.x;
      nextZ = Number((anchor.z + ab.W).toFixed(2));
      nextLevel = anchor.level;
    }
    const u = makeUnit(typeId, nextX, nextZ, {
      color: anchor?.color || 'charcoal',
      level: nextLevel,
      label: TYPE[typeId]?.short + ' #' + (units.length + 1),
    });
    commit([...units, u]);
    setSelected(u.id);
    if (!wide) setTab('detail');
  };

  const duplicate = () => {
    const u = units.find((x) => x.id === selected);
    if (!u) return;
    const b = unitBox(u);
    const copy: Unit = {
      ...u,
      id: makeUnit(u.type, 0, 0).id,
      label: (u.label || TYPE[u.type].short) + ' copy',
      x: u.x,
      z: Number((u.z + b.W).toFixed(2)),
      openings: u.openings.map((o) => ({ ...o, id: makeOpening(o.typeId || 'window', o.wall, o.along).id })),
    };
    commit([...units, copy]);
    setSelected(copy.id);
  };

  const removeSelected = () => {
    const remaining = units.filter((u) => u.id !== selected);
    commit(remaining);
    setSelected(remaining[0]?.id || null);
  };

  const addOpening = (typeId: string, wall: Wall) => {
    const u = units.find((x) => x.id === selected);
    if (!u) return;
    const box = unitBox(u);
    const wLen = wallLen(wall, box);
    const ot = OPENING[typeId];
    const min = ot.w / 2 + CORNER_POST_MARGIN;
    const max = wLen - ot.w / 2 - CORNER_POST_MARGIN;

    // Smart placement: find a free spot on the wall so multiple windows/doors don't stack on top of each other!
    const existing = u.openings.filter((o) => o.wall === wall);
    const candidates = [wLen / 2, wLen * 0.28, wLen * 0.72, min + 0.2, max - 0.2];
    let chosen = Number((wLen / 2).toFixed(2));
    for (const cPos of candidates) {
      const clamped = Math.max(min, Math.min(max, cPos));
      const collides = existing.some(
        (ex) =>
          Math.min(clamped + ot.w / 2, ex.along + ex.w / 2) - Math.max(clamped - ot.w / 2, ex.along - ex.w / 2) > 0.05 &&
          Math.min(ot.sill + ot.h, ex.sill + ex.h) - Math.max(ot.sill, ex.sill) > 0.05
      );
      if (!collides) {
        chosen = Number(clamped.toFixed(2));
        break;
      }
    }

    const o = makeOpening(typeId, wall, chosen);
    patch(u.id, { openings: [...u.openings, o] });
  };

  const updateOpening = (opId: string, opPatch: Partial<Opening>) => {
    if (!selected) return;
    commit((prev) =>
      prev.map((u) =>
        u.id === selected
          ? {
              ...u,
              openings: u.openings.map((o) => (o.id === opId ? { ...o, ...opPatch } : o)),
            }
          : u
      )
    );
  };

  const selectedUnit = units.find((u) => u.id === selected) || null;
  const warnItems = useMemo(() => evaluateWarnings(units), [units]);
  const warningUnitIds = useMemo(() => Array.from(new Set(warnItems.flatMap((w) => w.unitIds))), [warnItems]);
  const money = useMemo(() => buildQuote(units), [units]);
  const maxLevel = useMemo(() => (units.length ? Math.max(...units.map((u) => u.level)) : 0), [units]);

  const toastFor = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const setViewMode = (m: ViewMode) => {
    setMode(m);
    setCam(camFor(m));
  };

  const cycleLevelFilter = () => {
    if (maxLevel === 0) {
      setLevelFilter(null);
      return;
    }
    if (levelFilter === null) setLevelFilter(0);
    else if (levelFilter < maxLevel) setLevelFilter(levelFilter + 1);
    else setLevelFilter(null);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <View style={styles.markDot} />
          </View>
          <View>
            <Text style={styles.wordmark}>LIME CONSTRUCTS</Text>
            {!narrow && <Text style={styles.tagline}>architectural container planner</Text>}
          </View>
        </View>

        <View style={styles.headerRight}>
          {wide && (
            <Pressable onPress={() => setQuote(true)} style={styles.stats}>
              <Text style={styles.stat}>{units.length} units</Text>
              <View style={styles.dot} />
              <Text style={styles.stat}>{money.area.toFixed(0)} m²</Text>
              <View style={styles.dot} />
              <Text style={[styles.stat, { color: c.lime, fontWeight: '700' }]}>
                {formatCompact(money.total, meta.currency)}
              </Text>
            </Pressable>
          )}

          <Btn compact icon="undo" disabled={!history.length} onPress={undo} />
          <Btn compact icon="redo" disabled={!future.length} onPress={redo} />

          <View style={styles.segment}>
            {(['3d', 'plan'] as const).map((m) => (
              <Pressable key={m} onPress={() => setViewMode(m)} style={[styles.segBtn, mode === m && styles.segOn]}>
                <Icon name={m === '3d' ? 'cube' : 'plan'} size={14} color={mode === m ? c.bg : c.dim} />
                {!narrow && <Text style={[styles.segText, mode === m && { color: c.bg }]}>{m === '3d' ? '3D' : 'Plan'}</Text>}
              </Pressable>
            ))}
          </View>

          <Btn compact icon="reset" onPress={() => setCam(camFor(mode))} />
          <Btn
            compact
            icon="quote"
            label={!narrow ? formatCompact(money.total, meta.currency) : undefined}
            active={quote}
            onPress={() => setQuote(true)}
          />
        </View>
      </View>

      <View style={[styles.body, wide && { flexDirection: 'row' }]}>
        {wide && (
          <View style={styles.leftRail}>
            <BuildPanel
              units={units}
              selected={selected}
              currency={meta.currency}
              onSelect={setSelected}
              onAdd={addUnit}
              onPreset={(u) => {
                const cloned = u.map((x) => ({
                  ...x,
                  id: makeUnit(x.type, 0, 0).id,
                  openings: x.openings.map((o) => ({ ...o, id: makeOpening(o.typeId || 'window', o.wall, o.along).id })),
                }));
                commit(cloned);
                setSelected(cloned[0]?.id || null);
                setLevelFilter(null);
              }}
              onClear={() => {
                commit([]);
                setSelected(null);
              }}
            />
          </View>
        )}

        <View style={styles.stage}>
          <Viewport
            units={units}
            selected={selected}
            warningUnitIds={warningUnitIds}
            onSelect={(id) => {
              setSelected(id);
              if (id && !wide) setTab('detail');
            }}
            onDragStart={handleDragStart}
            onMoveUnit={handleMoveUnit}
            onDragEnd={handleDragEnd}
            moveMode={moveMode}
            mode={mode}
            cam={cam}
            setCam={setCam}
            showDimensions={showDimensions}
            imperial={imperial}
            levelFilter={levelFilter}
          />

          <View style={styles.overlayTop} pointerEvents="box-none">
            <Pressable
              onPress={() => setMoveMode(!moveMode)}
              style={[
                styles.chip,
                moveMode && { borderColor: c.lime, backgroundColor: 'rgba(201,242,77,0.16)' },
              ]}
            >
              <Icon name="move" size={12} color={moveMode ? c.lime : c.dim} />
              <Text style={[styles.chipText, moveMode && { color: c.lime, fontWeight: '700' }]}>
                {moveMode ? 'move: ON' : 'move'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDimensions(!showDimensions)}
              style={[styles.chip, showDimensions && { borderColor: 'rgba(201,242,77,0.45)' }]}
            >
              <Icon name="ruler" size={12} color={showDimensions ? c.lime : c.dim} />
              <Text style={[styles.chipText, showDimensions && { color: c.lime }]}>dims</Text>
            </Pressable>

            {showDimensions && (
              <Pressable onPress={() => setImperial(!imperial)} style={styles.chip}>
                <Text style={styles.chipText}>{imperial ? 'ft' : 'm'}</Text>
              </Pressable>
            )}

            {maxLevel > 0 && (
              <Pressable
                onPress={cycleLevelFilter}
                style={[styles.chip, levelFilter !== null && { borderColor: c.lime }]}
              >
                <Icon name="layers" size={12} color={levelFilter !== null ? c.lime : c.dim} />
                <Text style={[styles.chipText, levelFilter !== null && { color: c.lime }]}>
                  {levelFilter === null ? 'all levels' : 'L' + (levelFilter + 1) + ' only'}
                </Text>
              </Pressable>
            )}

            {warnItems.length > 0 && (
              <Pressable
                onPress={() => setShowWarnings(!showWarnings)}
                style={[styles.chip, { borderColor: 'rgba(228,160,160,0.55)', backgroundColor: 'rgba(40,14,14,0.85)' }]}
              >
                <Icon name="warn" size={12} color="#E4A0A0" />
                <Text style={[styles.chipText, { color: '#E4A0A0', fontWeight: '700' }]}>
                  {warnItems.length} {warnItems.length === 1 ? 'issue' : 'issues'}
                </Text>
              </Pressable>
            )}
          </View>

          {showWarnings && warnItems.length > 0 && (
            <View style={styles.warningDrawer}>
              <View style={styles.warningHeader}>
                <Text style={styles.warningTitle}>Structural & Spatial Checks ({warnItems.length})</Text>
                <Pressable onPress={() => setShowWarnings(false)} hitSlop={8}>
                  <Icon name="close" size={14} color={c.dim} />
                </Pressable>
              </View>
              {warnItems.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => {
                    if (w.unitIds[0]) {
                      setSelected(w.unitIds[0]);
                      if (!wide) setTab('detail');
                    }
                  }}
                  style={styles.warningItem}
                >
                  <View
                    style={[
                      styles.warningDot,
                      { backgroundColor: w.severity === 'error' ? '#E4A0A0' : '#FFD60A' },
                    ]}
                  />
                  <Text style={styles.warningText}>{w.text}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.zoom} pointerEvents="box-none">
            <Btn
              compact
              holdRepeat
              icon="plus"
              style={styles.zoomBtn}
              onPress={() => setCam((prev) => ({ ...prev, dist: Math.max(7, prev.dist - 2.2) }))}
            />
            <Btn
              compact
              holdRepeat
              icon="minus"
              style={styles.zoomBtn}
              onPress={() => setCam((prev) => ({ ...prev, dist: Math.min(75, prev.dist + 2.2) }))}
            />
          </View>

          <Text style={styles.hint} pointerEvents="none">
            {moveMode
              ? 'drag any unit to move · drag background to orbit · pinch to zoom'
              : 'touch & hold unit to drag · drag empty space to orbit · pinch to zoom'}
          </Text>
        </View>

        {wide && (
          <View style={styles.rightRail}>
            <Inspector
              unit={selectedUnit}
              allUnits={units}
              currency={meta.currency}
              onChange={(p) => selected && patch(selected, p)}
              onDelete={removeSelected}
              onDuplicate={duplicate}
              onAddOpening={addOpening}
              onUpdateOpening={updateOpening}
              onRemoveOpening={(oid) =>
                selectedUnit && patch(selectedUnit.id, { openings: selectedUnit.openings.filter((o) => o.id !== oid) })
              }
            />
          </View>
        )}

        {!wide && (
          <View style={styles.bottom}>
            <View style={styles.tabs}>
              {(['build', 'detail'] as const).map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
                  <Text style={[styles.tabText, tab === t && { color: c.text }]}>
                    {t === 'build' ? `Build (${units.length})` : 'Detail'}
                  </Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <Text style={styles.tabMeta}>
                {selectedUnit ? (selectedUnit.label || TYPE[selectedUnit.type].short) + ' · L' + (selectedUnit.level + 1) : 'no selection'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {tab === 'build' ? (
                <BuildPanel
                  units={units}
                  selected={selected}
                  currency={meta.currency}
                  onSelect={(id) => {
                    setSelected(id);
                    setTab('detail');
                  }}
                  onAdd={addUnit}
                  onPreset={(u) => {
                    const cloned = u.map((x) => ({
                      ...x,
                      id: makeUnit(x.type, 0, 0).id,
                      openings: x.openings.map((o) => ({ ...o, id: makeOpening(o.typeId || 'window', o.wall, o.along).id })),
                    }));
                    commit(cloned);
                    setSelected(cloned[0]?.id || null);
                    setLevelFilter(null);
                  }}
                  onClear={() => {
                    commit([]);
                    setSelected(null);
                  }}
                />
              ) : (
                <Inspector
                  unit={selectedUnit}
                  allUnits={units}
                  currency={meta.currency}
                  onChange={(p) => selected && patch(selected, p)}
                  onDelete={removeSelected}
                  onDuplicate={duplicate}
                  onAddOpening={addOpening}
                  onUpdateOpening={updateOpening}
                  onRemoveOpening={(oid) =>
                    selectedUnit && patch(selectedUnit.id, { openings: selectedUnit.openings.filter((o) => o.id !== oid) })
                  }
                />
              )}
            </View>
          </View>
        )}
      </View>

      <QuoteSheet
        visible={quote}
        units={units}
        meta={meta}
        onChangeMeta={(p) => setMeta((m) => ({ ...m, ...p }))}
        onImportUnits={(nextUnits, nextMeta) => {
          commit(nextUnits);
          setSelected(nextUnits[0]?.id || null);
          if (nextMeta) setMeta((m) => ({ ...m, ...nextMeta }));
        }}
        onClose={() => setQuote(false)}
        onToast={toastFor}
      />

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: c.lime },
  wordmark: { color: c.text, fontSize: 11.5, letterSpacing: 2.2, fontWeight: '700' },
  tagline: { color: c.mute, fontSize: 9.5, letterSpacing: 1.2, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stat: { color: c.dim, fontSize: 11 },
  dot: { width: 2, height: 2, borderRadius: 1, backgroundColor: c.line2 },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.panel2,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: c.line,
    padding: 2,
  },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 28, borderRadius: 7 },
  segOn: { backgroundColor: c.lime },
  segText: { color: c.dim, fontSize: 11, fontWeight: '600' },
  body: { flex: 1 },
  leftRail: { width: 276, borderRightWidth: 1, borderRightColor: c.line, backgroundColor: c.panel },
  rightRail: { width: 320, borderLeftWidth: 1, borderLeftColor: c.line, backgroundColor: c.panel },
  stage: { flex: 1, position: 'relative' },
  overlayTop: { position: 'absolute', top: 12, left: 12, right: 56, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: 'rgba(10,11,13,0.82)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: { color: c.dim, fontSize: 10.5, letterSpacing: 0.5 },
  warningDrawer: {
    position: 'absolute',
    top: 46,
    left: 12,
    maxWidth: 380,
    backgroundColor: 'rgba(14,15,17,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(228,160,160,0.45)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  warningHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  warningTitle: { color: '#E4A0A0', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  warningItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  warningText: { flex: 1, color: c.text, fontSize: 11.5, lineHeight: 16 },
  zoom: { position: 'absolute', right: 12, top: 12, gap: 6 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: 'rgba(10,11,13,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10.5,
  },
  bottom: { height: 310, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.panel },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  tabOn: { backgroundColor: c.panel2, borderWidth: 1, borderColor: c.line },
  tabText: { color: c.dim, fontSize: 12, fontWeight: '600' },
  tabMeta: { color: c.lime, fontSize: 10.5, letterSpacing: 0.8, fontWeight: '600' },
  toast: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    backgroundColor: c.raised,
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  toastText: { color: c.text, fontSize: 12 },
});
