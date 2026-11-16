import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Viewport } from './components/Viewport';
import { BuildPanel } from './components/BuildPanel';
import { Inspector } from './components/Inspector';
import { QuoteSheet } from './components/QuoteSheet';
import { Icon } from './components/Icon';
import { Btn } from './components/ui';
import { PRESETS, TYPE, makeOpening, makeUnit } from './data';
import { buildQuote } from './quote';
import { footprint } from './geo';
import type { Cam, Unit, ViewMode, Wall } from './types';
import { c, r } from './theme';

const camFor = (mode: ViewMode): Cam =>
  mode === 'plan' ? { az: 0, el: 1.52, dist: 27 } : { az: 0.8, el: 0.58, dist: 21 };

const rectOf = (u: Unit) => {
  const p = footprint(u);
  return { x0: p[0][0], x1: p[1][0], z0: p[0][1], z1: p[2][1] };
};

function warnings(units: Unit[]) {
  const out: string[] = [];
  const rects = units.map(rectOf);

  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      if (units[i].level !== units[j].level) continue;
      const a = rects[i];
      const b = rects[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 0.05 && oz > 0.05) out.push('Two units overlap on level ' + (units[i].level + 1));
    }
  }

  for (let i = 0; i < units.length; i++) {
    if (units[i].level === 0) continue;
    const a = rects[i];
    const area = (a.x1 - a.x0) * (a.z1 - a.z0);
    let covered = 0;
    for (let j = 0; j < units.length; j++) {
      if (units[j].level !== units[i].level - 1) continue;
      const b = rects[j];
      const ox = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
      const oz = Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
      covered += ox * oz;
    }
    if (covered < area * 0.75) out.push('Level ' + (units[i].level + 1) + ' unit has little support beneath it');
  }

  return out;
}

export function Planner() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 980;

  const [units, setUnits] = useState<Unit[]>(PRESETS[1].units);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('3d');
  const [cam, setCam] = useState<Cam>(camFor('3d'));
  const narrow = width < 430;
  const [quote, setQuote] = useState(false);
  const [tab, setTab] = useState<'build' | 'detail'>('build');
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<Unit[][]>([]);
  const [future, setFuture] = useState<Unit[][]>([]);

  const commit = useCallback(
    (next: Unit[]) => {
      setHistory((h) => [...h.slice(-30), units]);
      setFuture([]);
      setUnits(next);
    },
    [units]
  );

  const patch = (id: string, p: Partial<Unit>) => commit(units.map((u) => (u.id === id ? { ...u, ...p } : u)));

  const addUnit = (typeId: string) => {
    const t = TYPE[typeId];
    const right = units.length ? Math.max(...units.map((u) => u.x + (u.rot ? t.wid : t.len))) : 0;
    const u = makeUnit(typeId, units.length ? right + 0.8 : 0, 0, { color: 'charcoal' });
    commit([...units, u]);
    setSelected(u.id);
  };

  const duplicate = () => {
    const u = units.find((x) => x.id === selected);
    if (!u) return;
    const copy = { ...u, id: makeUnit(u.type, 0, 0).id, x: u.x, z: u.z + 3.2 };
    commit([...units, copy]);
    setSelected(copy.id);
  };

  const removeSelected = () => {
    commit(units.filter((u) => u.id !== selected));
    setSelected(null);
  };

  const addOpening = (typeId: string, wall: Wall) => {
    const u = units.find((x) => x.id === selected);
    if (!u) return;
    const t = TYPE[u.type];
    const along = (wall === 'front' || wall === 'back' ? t.wid : t.len) / 2;
    const o = makeOpening(typeId, wall, along);
    patch(u.id, { openings: [...u.openings, o] });
  };

  const selectedUnit = units.find((u) => u.id === selected) || null;
  const warn = useMemo(() => warnings(units), [units]);
  const money = useMemo(() => buildQuote(units), [units]);

  const toastFor = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const setView = (m: ViewMode) => {
    setMode(m);
    setCam(camFor(m));
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
            {!narrow && <Text style={styles.tagline}>container planner</Text>}
          </View>
        </View>

        <View style={styles.headerRight}>
          {wide && (
            <View style={styles.stats}>
              <Text style={styles.stat}>{units.length} units</Text>
              <View style={styles.dot} />
              <Text style={styles.stat}>{money.area.toFixed(0)} m2</Text>
              <View style={styles.dot} />
              <Text style={styles.stat}>{'N' + Math.round(money.total / 1000) + 'k'}</Text>
            </View>
          )}

          <View style={styles.segment}>
            {(['3d', 'plan'] as const).map((m) => (
              <Pressable key={m} onPress={() => setView(m)} style={[styles.segBtn, mode === m && styles.segOn]}>
                <Icon name={m === '3d' ? 'cube' : 'plan'} size={14} color={mode === m ? c.bg : c.dim} />
                {!narrow && <Text style={[styles.segText, mode === m && { color: c.bg }]}>{m === '3d' ? '3D' : 'Plan'}</Text>}
              </Pressable>
            ))}
          </View>

          <Btn compact icon="reset" onPress={() => setCam(camFor(mode))} />
          <Btn compact icon="quote" active={quote} onPress={() => setQuote(true)} />
        </View>
      </View>

      <View style={[styles.body, wide && { flexDirection: 'row' }]}>
        {wide && (
          <View style={styles.leftRail}>
            <BuildPanel onAdd={addUnit} onPreset={(u) => { commit(u.map((x) => ({ ...x }))); setSelected(null); }} onClear={() => { commit([]); setSelected(null); }} />
          </View>
        )}

        <View style={styles.stage}>
          <Viewport units={units} selected={selected} onSelect={setSelected} mode={mode} cam={cam} setCam={setCam} />

          <View style={styles.overlayTop} pointerEvents="none">
            <View style={styles.chip}>
              <Icon name={mode === '3d' ? 'cube' : 'plan'} size={12} color={c.dim} />
              <Text style={styles.chipText}>{mode === '3d' ? 'orbit view' : 'plan view'}</Text>
            </View>
            {warn.length > 0 && (
              <View style={[styles.chip, { borderColor: 'rgba(228,160,160,0.35)' }]}>
                <Icon name="warn" size={12} color="#E4A0A0" />
                <Text style={[styles.chipText, { color: '#E4A0A0' }]}>{warn.length}</Text>
              </View>
            )}
          </View>

          <View style={styles.zoom} pointerEvents="box-none">
            <Pressable onPress={() => setCam({ ...cam, dist: Math.max(9, cam.dist - 3) })} style={styles.zoomBtn}>
              <Icon name="plus" size={15} color={c.dim} />
            </Pressable>
            <Pressable onPress={() => setCam({ ...cam, dist: Math.min(70, cam.dist + 3) })} style={styles.zoomBtn}>
              <Icon name="minus" size={15} color={c.dim} />
            </Pressable>
          </View>

          <Text style={styles.hint} pointerEvents="none">
            drag to orbit · pinch or scroll to zoom · tap a unit to select
          </Text>
        </View>

        {wide && (
          <View style={styles.rightRail}>
            <Inspector
              unit={selectedUnit}
              onChange={(p) => selected && patch(selected, p)}
              onDelete={removeSelected}
              onDuplicate={duplicate}
              onAddOpening={addOpening}
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
                  <Text style={[styles.tabText, tab === t && { color: c.text }]}>{t === 'build' ? 'Build' : 'Detail'}</Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <Text style={styles.tabMeta}>{selectedUnit ? TYPE[selectedUnit.type].short : 'no selection'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {tab === 'build' ? (
                <BuildPanel onAdd={addUnit} onPreset={(u) => { commit(u.map((x) => ({ ...x }))); setSelected(null); }} onClear={() => { commit([]); setSelected(null); }} />
              ) : (
                <Inspector
                  unit={selectedUnit}
                  onChange={(p) => selected && patch(selected, p)}
                  onDelete={removeSelected}
                  onDuplicate={duplicate}
                  onAddOpening={addOpening}
                  onRemoveOpening={(oid) =>
                    selectedUnit && patch(selectedUnit.id, { openings: selectedUnit.openings.filter((o) => o.id !== oid) })
                  }
                />
              )}
            </View>
          </View>
        )}
      </View>

      <QuoteSheet visible={quote} units={units} onClose={() => setQuote(false)} onToast={toastFor} />

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
  mark: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: c.text, alignItems: 'center', justifyContent: 'center' },
  markDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: c.lime },
  wordmark: { color: c.text, fontSize: 11.5, letterSpacing: 2.2, fontWeight: '700' },
  tagline: { color: c.mute, fontSize: 9.5, letterSpacing: 1.2, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 6 },
  stat: { color: c.dim, fontSize: 11 },
  dot: { width: 2, height: 2, borderRadius: 1, backgroundColor: c.line2 },
  segment: { flexDirection: 'row', backgroundColor: c.panel2, borderRadius: 9, borderWidth: 1, borderColor: c.line, padding: 2 },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 28, borderRadius: 7 },
  segOn: { backgroundColor: c.lime },
  segText: { color: c.dim, fontSize: 11, fontWeight: '600' },
  body: { flex: 1 },
  leftRail: { width: 268, borderRightWidth: 1, borderRightColor: c.line, backgroundColor: c.panel },
  rightRail: { width: 300, borderLeftWidth: 1, borderLeftColor: c.line, backgroundColor: c.panel },
  stage: { flex: 1, position: 'relative' },
  overlayTop: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: 'rgba(10,11,13,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipText: { color: c.dim, fontSize: 10.5, letterSpacing: 0.6 },
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
  bottom: { height: 290, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.panel },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  tabOn: { backgroundColor: c.panel2, borderWidth: 1, borderColor: c.line },
  tabText: { color: c.dim, fontSize: 12, fontWeight: '600' },
  tabMeta: { color: c.mute, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },
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
