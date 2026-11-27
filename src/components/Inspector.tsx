import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from './Icon';
import {
  PART,
  SHELL_COLORS,
  UNIT_TYPE,
  UNIT_TYPES,
  WALLS,
  extOf,
  layoutUnits,
  partNotes,
  unitRect,
  type PlacedItem,
  type UnitModel,
  type WallId,
} from '../container-library';
import { defaultRateBook, type CustomMaterial, type RateBook } from '../container-catalog';
import { checkStructure, type StructureWarning } from '../container-structure';
import { money, type LineOverride, type Quantities } from '../container-quote';
import { cssHex, hexOfColorId, type SelRef } from '../geo';
import { c, r } from '../theme';

const M_PER_FT = 0.3048;

export function fmtLen(metres: number, unit: 'ft' | 'm') {
  if (unit === 'm') return `${metres.toFixed(2)} m`;
  const totalIn = (metres / M_PER_FT) * 12;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1} ft` : inch ? `${ft} ft ${inch} in` : `${ft} ft`;
}

export const fmtArea = (m2: number, u: 'ft' | 'm') =>
  u === 'm' ? `${m2.toFixed(1)} m²` : `${(m2 * 10.7639).toFixed(0)} sq ft`;

const levelName = (L: number) => (L === 0 ? 'Ground' : `Level ${L}`);
const unitName = (u: UnitModel) => u.name || UNIT_TYPE[u.preset]?.name || 'Unit';

function NumField({
  label,
  valueM,
  unit,
  hint,
  onChangeM,
}: {
  label: string;
  valueM: number;
  unit: 'ft' | 'm';
  hint?: string;
  onChangeM: (m: number) => void;
}) {
  const toDisp = (m: number) => (unit === 'm' ? +m.toFixed(3) : +(m / M_PER_FT).toFixed(2));
  const fromDisp = (v: number) => (unit === 'm' ? v : v * M_PER_FT);
  const formatted = String(toDisp(valueM));
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatted);

  const commitText = () => {
    setFocused(false);
    const v = parseFloat(draft);
    if (Number.isFinite(v)) {
      const m = Math.round(fromDisp(v) * 1000) / 1000;
      onChangeM(m);
    } else {
      setDraft(formatted);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numWrap}>
        <TextInput
          value={focused ? draft : formatted}
          onFocus={() => {
            setDraft(formatted);
            setFocused(true);
          }}
          onChangeText={setDraft}
          onBlur={commitText}
          onSubmitEditing={commitText}
          keyboardType="numeric"
          style={styles.numInput}
        />
        <Text style={styles.numUnit}>{unit}</Text>
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Inspector({
  name,
  units,
  site,
  sel,
  unitSystem,
  currency,
  grandTotal,
  quantities,
  rates,
  overrides,
  customMaterials,
  howOpenTick,
  onSelect,
  onUpdateUnit,
  onChangeUnitPreset,
  onUpdateItem,
  onChangeItemWall,
  onRotate,
  onDuplicate,
  onDelete,
  onStackUnit,
}: {
  name: string;
  units: UnitModel[];
  site: PlacedItem[];
  sel: SelRef;
  unitSystem: 'ft' | 'm';
  currency: string;
  grandTotal: number;
  quantities: Quantities;
  rates: Partial<RateBook>;
  overrides: Record<string, LineOverride>;
  customMaterials: CustomMaterial[];
  howOpenTick?: number;
  onSelect: (ref: SelRef) => void;
  onUpdateUnit: (id: string, patch: Partial<UnitModel>) => void;
  onChangeUnitPreset: (id: string, preset: string) => void;
  onUpdateItem: (ref: SelRef, patch: Partial<PlacedItem>) => void;
  onChangeItemWall: (unitId: string, itemKey: number, wall: WallId) => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStackUnit: (u: UnitModel) => void;
}) {
  const [howState, setHowState] = useState<{ open: boolean; tick: number }>({ open: false, tick: 0 });
  const [sizeModalUnitId, setSizeModalUnitId] = useState<string | null>(null);
  const currentTick = howOpenTick || 0;
  const howOpen = currentTick > howState.tick ? true : howState.open;

  const layout = layoutUnits(units);

  const structureFor = () => {
    const modules = units.map((u) => {
      const turned = (u.rot || 0) % 2;
      const L = turned ? u.wid : u.len;
      const W = turned ? u.len : u.wid;
      return {
        id: u.id,
        name: unitName(u),
        size: u.preset,
        len: u.len,
        wid: u.wid,
        hgt: u.hgt,
        x: u.cx - L / 2,
        z: u.cz - W / 2,
        rot: turned ? 90 : 0,
        level: u.level || 0,
        items: u.items.filter((i) => i.kind === 'opening'),
      };
    });
    try {
      return checkStructure({ modules, roofs: [], use: 'home' }, {});
    } catch {
      return null;
    }
  };

  const layoutWarnings = (): StructureWarning[] => {
    const out: StructureWarning[] = [];
    const cols = site.filter((s) => s.type === 'column');
    for (let i = 0; i < units.length; i++) {
      for (let k = i + 1; k < units.length; k++) {
        const a = units[i];
        const b = units[k];
        if ((a.level || 0) !== (b.level || 0)) continue;
        const ra = unitRect(a);
        const rb = unitRect(b);
        const ov =
          Math.max(0, Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0)) *
          Math.max(0, Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0));
        if (ov > 0.2) {
          out.push({
            level: 'bad',
            text: `${unitName(a)} and ${unitName(b)} overlap on ${levelName(a.level || 0).toLowerCase()}.`,
          });
        }
      }
    }
    for (const u of units) {
      const info = layout.get(u.id);
      if (!info) continue;
      if (!info.supported) {
        out.push({
          level: 'bad',
          text: `${unitName(u)} on ${levelName(u.level).toLowerCase()} has nothing under it: move it onto a unit or prop it on steel posts.`,
        });
      }
      const e = extOf(u);
      const len = e.len;
      const r = unitRect(u);
      const propped = cols.some(
        (col) =>
          (col.x ?? 0) > r.x0 - 0.3 &&
          (col.x ?? 0) < r.x1 + 0.3 &&
          (col.z ?? 0) > r.z0 - 0.3 &&
          (col.z ?? 0) < r.z1 + 0.3
      );
      if (info.overhang > 0.3 && !propped && info.overhang > (len - info.overhang) / 1.5) {
        out.push({
          level: 'bad',
          text: `${unitName(u)} overhangs ${info.overhang.toFixed(1)} m on ${(len - info.overhang).toFixed(1)} m of support: keep the back-span at least 1.5 × the overhang, or prop it on posts.`,
        });
      } else if (info.overhang > 0.3) {
        out.push({
          level: 'warn',
          text: `${unitName(u)} overhangs its supports by ${info.overhang.toFixed(1)} m in total${
            propped ? ' (propped on posts)' : ''
          }: steel I-beams under both bottom rails, engineered connections.`,
        });
      }
    }
    return out;
  };

  const priceOf = (key: string, qty: number) => {
    const book = { ...defaultRateBook(customMaterials), ...rates };
    const b = book[key];
    if (!b) return '';
    const rate = (overrides[key]?.rate ?? b.rate) + (overrides[key]?.labour ?? b.labour);
    return rate ? money(rate * qty, currency) : '';
  };

  // Resolve selection
  const resolved = (() => {
    if (!sel) return null;
    if (sel.t === 'unit') {
      const u = units.find((x) => x.id === sel.id);
      return u ? { t: 'unit' as const, u } : null;
    }
    if (sel.t === 'site') {
      const it = site.find((x) => x.key === sel.key);
      return it ? { t: 'site' as const, it } : null;
    }
    if (sel.t === 'item') {
      const u = units.find((x) => x.id === sel.id);
      const it = u?.items.find((x) => x.key === sel.key);
      return u && it ? { t: 'item' as const, u, it } : null;
    }
    return null;
  })();

  // 1. Project Panel (nothing selected)
  if (!resolved) {
    const st = structureFor();
    const warns = [...layoutWarnings(), ...(st?.warnings || [])];
    const levels = [...new Set(units.map((u) => u.level || 0))].sort((a, b) => a - b);

    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View>
            <Text style={styles.kicker}>Build</Text>
            <Text style={styles.title}>{name}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Floor area</Text>
            <Text style={styles.statVal}>{fmtArea(quantities.floorArea || 0, unitSystem)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Units</Text>
            <Text style={styles.statVal}>{units.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Levels</Text>
            <Text style={styles.statVal}>{levels.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Quoted price</Text>
            <Text style={[styles.statVal, { color: c.lime }]}>{money(grandTotal, currency)}</Text>
          </View>
        </View>

        {warns.length > 0 ? (
          <View style={styles.sec}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>To resolve</Text>
              <Text style={styles.secCount}>{warns.length}</Text>
            </View>
            <View style={styles.notes}>
              {warns.map((w, idx) => (
                <View
                  key={'w_' + idx}
                  style={[styles.note, w.level === 'bad' && styles.noteBad]}
                >
                  <Icon
                    name="warn"
                    size={14}
                    color={w.level === 'bad' ? '#F07878' : '#F2C04D'}
                  />
                  <Text style={styles.noteText}>{w.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.okRow}>
            <Icon name="info" size={14} color={c.mute} />
            <Text style={styles.okText}>
              No layout problems found. Have the final design checked by a structural engineer.
            </Text>
          </View>
        )}

        {levels.map((L) => (
          <View key={'lv_' + L} style={styles.sec}>
            <Text style={styles.secTitle}>{levelName(L)}</Text>
            {units
              .filter((u) => (u.level || 0) === L)
              .map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => onSelect({ t: 'unit', id: u.id })}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: cssHex(hexOfColorId(u.color)) },
                    ]}
                  />
                  <Text style={styles.rowText} numberOfLines={1}>
                    {unitName(u)}
                  </Text>
                  <Text style={styles.rowMeta}>{u.items.length} parts</Text>
                </Pressable>
              ))}
          </View>
        ))}

        {site.length > 0 ? (
          <View style={styles.sec}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>Site</Text>
              <Text style={styles.secCount}>{site.length}</Text>
            </View>
            {site.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => onSelect({ t: 'site', key: s.key })}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowText} numberOfLines={1}>
                  {PART[s.type]?.name || s.type}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.tip}>
          Right-click (or long-press) a wall, a floor or the ground to add parts there. Drag a selected unit to move it; units snap to each other.
        </Text>
      </ScrollView>
    );
  }

  // 2. Unit Panel
  if (resolved.t === 'unit') {
    const u = resolved.u;
    const info = layout.get(u.id);
    const st = structureFor();
    const rStruct = st?.modules.find((m) => m.id === u.id);
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const badge = rStruct
      ? ({
          ok: ['Checks pass', styles.badgeOk, '#68D888'] as const,
          close: ['Close to limits', styles.badgeClose, '#F2C04D'] as const,
          'needs-engineer': ['Needs an engineer', styles.badgeBad, '#F07878'] as const,
        }[rStruct.status] || null)
      : null;

    const rows: [string, string][] = rStruct
      ? ([
          [
            'Racking, across',
            `${rStruct.racking.transverse.demandKn} of ${rStruct.racking.transverse.capacityKn} kN (${pct(
              rStruct.racking.transverse.ratio
            )})`,
          ],
          [
            'Racking, along',
            `${rStruct.racking.longitudinal.demandKn} of ${rStruct.racking.longitudinal.capacityKn} kN (${pct(
              rStruct.racking.longitudinal.ratio
            )})`,
          ],
          rStruct.stacking
            ? [
                'Load on corner posts',
                `${(rStruct.stacking.perPostKg / 1000).toFixed(1)} t per post (${pct(
                  rStruct.stacking.utilisation
                )} of 192 t)`,
              ]
            : null,
          ...rStruct.lintels.map(
            (l) => [`Lintel over ${l.opening.replace(/-/g, ' ')}`, `${l.section}`] as [string, string]
          ),
          rStruct.footings && (u.level || 0) === 0
            ? [
                'Footings',
                `${rStruct.footings.supports} pads, ${fmtLen(rStruct.footings.padSideM, unitSystem)} square`,
              ]
            : null,
          info && info.overhang > 0.3 ? ['Cantilever', fmtLen(info.overhang, unitSystem)] : null,
        ].filter(Boolean) as [string, string][])
      : [];

    const t = UNIT_TYPE[u.preset];

    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Unit · {levelName(u.level || 0)}</Text>
            <TextInput
              value={u.name || unitName(u)}
              onChangeText={(txt) => onUpdateUnit(u.id, { name: txt })}
              style={styles.nameInput}
              placeholder="Unit name"
              placeholderTextColor={c.mute}
            />
          </View>
          <Pressable onPress={() => onSelect(null)} style={styles.iconBtn}>
            <Icon name="close" size={16} color={c.dim} />
          </Pressable>
        </View>

        <View style={styles.fieldsGrid}>
          <View style={styles.fieldWide}>
            <Text style={styles.fieldLabel}>Size</Text>
            <Pressable
              onPress={() => setSizeModalUnitId(u.id)}
              style={styles.selectBtn}
            >
              <Text style={styles.selectBtnText}>{t?.name || u.preset}</Text>
              <Icon name="chevronDown" size={14} color={c.mute} />
            </Pressable>
            {t ? (
              <Text style={styles.fieldHint}>
                Inside {fmtLen(u.len, unitSystem)} × {fmtLen(u.wid, unitSystem)} × {fmtLen(u.hgt, unitSystem)}
              </Text>
            ) : null}
          </View>

          <NumField
            label="Position x"
            valueM={u.cx}
            unit={unitSystem}
            onChangeM={(cx) => onUpdateUnit(u.id, { cx })}
          />
          <NumField
            label="Position z"
            valueM={u.cz}
            unit={unitSystem}
            onChangeM={(cz) => onUpdateUnit(u.id, { cz })}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Level</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onUpdateUnit(u.id, { level: Math.max(0, (u.level || 0) - 1) })}
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepVal}>{u.level || 0}</Text>
              <Pressable
                onPress={() => onUpdateUnit(u.id, { level: (u.level || 0) + 1 })}
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Facing</Text>
            <Pressable onPress={onRotate} style={styles.btnSecondary}>
              <Icon name="rotate" size={14} color={c.text} />
              <Text style={styles.btnText}>Turn 90°</Text>
            </Pressable>
          </View>

          <View style={styles.fieldWide}>
            <Text style={styles.fieldLabel}>Colour</Text>
            <View style={styles.swatches}>
              {SHELL_COLORS.map((col) => (
                <Pressable
                  key={col.id}
                  onPress={() => onUpdateUnit(u.id, { color: col.id })}
                  style={[
                    styles.swatch,
                    { backgroundColor: cssHex(col.hex) },
                    col.id === u.color && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.actsRow}>
          <Pressable onPress={() => onStackUnit(u)} style={styles.btnSecondary}>
            <Icon name="stack" size={14} color={c.text} />
            <Text style={styles.btnText}>Stack on top</Text>
          </Pressable>
          <Pressable onPress={onDuplicate} style={styles.btnSecondary}>
            <Icon name="copy" size={14} color={c.text} />
            <Text style={styles.btnText}>Alongside</Text>
          </Pressable>
        </View>

        {rStruct ? (
          <View style={styles.sec}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>Structure</Text>
              {badge ? (
                <View style={[styles.badge, badge[1]]}>
                  <Text style={[styles.badgeText, { color: badge[2] }]}>{badge[0]}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.dl}>
              {rows.map(([k, v], idx) => (
                <View key={'r_' + idx} style={styles.dlRow}>
                  <Text style={styles.dlKey}>{k}</Text>
                  <Text style={styles.dlVal}>{v}</Text>
                </View>
              ))}
            </View>
            {rStruct.notes.length > 0 ? (
              <View style={styles.notes}>
                {rStruct.notes.map((n, idx) => (
                  <View key={'n_' + idx} style={styles.note}>
                    <Icon name="info" size={14} color={c.mute} />
                    <Text style={styles.noteText}>{n}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sec}>
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>In this unit</Text>
            <Text style={styles.secCount}>{u.items.length}</Text>
          </View>
          {u.items.length > 0 ? (
            u.items.map((it) => (
              <Pressable
                key={it.key}
                onPress={() => onSelect({ t: 'item', id: u.id, key: it.key })}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowText} numberOfLines={1}>
                  {PART[it.type]?.name || it.type}
                </Text>
                <Text style={styles.rowMeta}>
                  {it.kind === 'opening' || it.kind === 'facade'
                    ? WALLS.find((w) => w.id === it.wall)?.name || ''
                    : it.kind === 'roof'
                    ? 'Roof'
                    : 'Inside'}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>
              Nothing yet. Pick parts from the library, or right-click a wall.
            </Text>
          )}
        </View>

        <View style={styles.actsRow}>
          <Pressable onPress={onDelete} style={[styles.btnSecondary, styles.btnDanger]}>
            <Icon name="trash" size={14} color="#F07878" />
            <Text style={[styles.btnText, { color: '#F07878' }]}>Remove unit</Text>
          </Pressable>
        </View>

        {/* Unit Size Picker Modal */}
        <Modal
          visible={sizeModalUnitId === u.id}
          transparent
          animationType="fade"
          onRequestClose={() => setSizeModalUnitId(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setSizeModalUnitId(null)}>
            <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
              <Text style={styles.modalTitle}>Unit size</Text>
              {UNIT_TYPES.map((g) => (
                <View key={g.group} style={{ marginTop: 10 }}>
                  <Text style={styles.modalGroup}>{g.group}</Text>
                  {g.items.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        onChangeUnitPreset(u.id, item.id);
                        setSizeModalUnitId(null);
                      }}
                      style={[styles.modalOpt, item.id === u.preset && styles.modalOptActive]}
                    >
                      <Text style={[styles.modalOptText, item.id === u.preset && { color: c.lime, fontWeight: '700' }]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    );
  }

  // 3. Part Panel (Item or Site)
  const it = resolved.it;
  const u = resolved.t === 'item' ? resolved.u : undefined;
  const p = PART[it.type];
  const kindName =
    {
      opening: 'Wall opening',
      fitting: 'Inside',
      facade: 'Facade',
      roof: 'Roof',
      site: 'Site',
    }[it.kind] || 'Part';

  const notes = [...partNotes(it, u)];
  if (it.kind === 'roof' && p?.panel) {
    const w = it.w ?? p.w;
    const d = it.d ?? p.d ?? 1;
    const n = Math.max(1, Math.floor(w / p.panel.w)) * Math.max(1, Math.floor(d / p.panel.d));
    notes.unshift(`${n} panels, about ${((n * p.panel.watts) / 1000).toFixed(1)} kWp.`);
  }
  if (it.kind === 'site' && p?.stair) {
    const hVal = it.h ?? p.h ?? 2.85;
    const dVal = it.d ?? p.d ?? 4.2;
    const n = Math.max(2, Math.round(hVal / 0.18));
    const going = (dVal * (it.type === 'ext-stair' ? 0.76 : 1)) / n;
    if (it.type !== 'spiral') {
      notes.unshift(
        `${n} risers of ${Math.round((hVal / n) * 1000)} mm, goings about ${Math.round(going * 1000)} mm${
          going < 0.25 ? ' (under 250 mm: lengthen the run)' : ''
        }.`
      );
    }
  }

  const key = `${it.kind}:${it.type}`;
  const wVal = it.w ?? p?.w ?? 1;
  const dVal = it.d ?? p?.d ?? 1;
  const hVal = it.h ?? p?.h ?? 1;
  const qty =
    p?.unit === 'area'
      ? p.isWall
        ? dVal * hVal
        : it.kind === 'opening' || it.kind === 'facade'
        ? wVal * hVal
        : wVal * dVal
      : p?.unit === 'length'
      ? p.lengthOf === 'd'
        ? dVal
        : wVal
      : p?.unit === 'panel' && p.panel
      ? Math.max(1, Math.floor(wVal / p.panel.w)) * Math.max(1, Math.floor(dVal / p.panel.d))
      : 1;
  const price = priceOf(key, qty);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>
            {kindName}
            {u ? ` · ${unitName(u)}` : ''}
          </Text>
          <Text style={styles.title}>{p?.name || it.type}</Text>
        </View>
        <Pressable onPress={() => onSelect(null)} style={styles.iconBtn}>
          <Icon name="close" size={16} color={c.dim} />
        </Pressable>
      </View>

      {price ? (
        <Text style={styles.price}>
          {price} <Text style={styles.priceSub}>supply & fit</Text>
        </Text>
      ) : null}

      <View style={styles.fieldsGrid}>
        {(it.kind === 'opening' || it.kind === 'facade') && u ? (
          <>
            <View style={styles.fieldWide}>
              <Text style={styles.fieldLabel}>Wall</Text>
              <View style={styles.wallChips}>
                {WALLS.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => onChangeItemWall(u.id, it.key, w.id)}
                    style={[styles.wallChip, it.wall === w.id && styles.wallChipActive]}
                  >
                    <Text
                      style={[
                        styles.wallChipText,
                        it.wall === w.id && { color: c.bg, fontWeight: '700' },
                      ]}
                    >
                      {w.name.replace(' (door end)', '')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <NumField
              label="From the left corner"
              valueM={it.along ?? 1}
              unit={unitSystem}
              hint="to the centre, looking at the wall from outside"
              onChangeM={(along) => onUpdateItem(sel, { along })}
            />
            <NumField
              label="Width"
              valueM={wVal}
              unit={unitSystem}
              onChangeM={(w) => onUpdateItem(sel, { w })}
            />
            <NumField
              label="Height"
              valueM={hVal}
              unit={unitSystem}
              onChangeM={(h) => onUpdateItem(sel, { h })}
            />
            <NumField
              label={it.kind === 'facade' ? 'Bottom above floor' : 'Sill above floor'}
              valueM={it.sill ?? p?.sill ?? 0}
              unit={unitSystem}
              onChangeM={(sill) => onUpdateItem(sel, { sill })}
            />
            {it.proj != null ? (
              <NumField
                label="Projection"
                valueM={it.proj}
                unit={unitSystem}
                onChangeM={(proj) => onUpdateItem(sel, { proj })}
              />
            ) : null}
          </>
        ) : it.kind === 'fitting' && u ? (
          <>
            <NumField
              label="From the back end"
              valueM={it.x ?? u.len / 2}
              unit={unitSystem}
              onChangeM={(x) => onUpdateItem(sel, { x })}
            />
            <NumField
              label="From the left side"
              valueM={it.z ?? u.wid / 2}
              unit={unitSystem}
              onChangeM={(z) => onUpdateItem(sel, { z })}
            />
            {p?.isWall ? (
              <NumField
                label="Length"
                valueM={dVal}
                unit={unitSystem}
                onChangeM={(d) => onUpdateItem(sel, { d })}
              />
            ) : (
              <>
                <NumField
                  label="Width"
                  valueM={wVal}
                  unit={unitSystem}
                  onChangeM={(w) => onUpdateItem(sel, { w })}
                />
                <NumField
                  label="Depth"
                  valueM={dVal}
                  unit={unitSystem}
                  onChangeM={(d) => onUpdateItem(sel, { d })}
                />
              </>
            )}
            {it.deck != null ? (
              <NumField
                label="Deck height"
                valueM={it.deck}
                unit={unitSystem}
                onChangeM={(deck) => onUpdateItem(sel, { deck })}
              />
            ) : null}
            {p?.stair ? (
              <NumField
                label="Rise"
                valueM={hVal}
                unit={unitSystem}
                onChangeM={(h) => onUpdateItem(sel, { h })}
              />
            ) : null}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Facing</Text>
              <Pressable onPress={onRotate} style={styles.btnSecondary}>
                <Icon name="rotate" size={14} color={c.text} />
                <Text style={styles.btnText}>Turn 90°</Text>
              </Pressable>
            </View>
          </>
        ) : it.kind === 'roof' && u ? (
          <>
            <NumField
              label="From the back end"
              valueM={it.x ?? u.len / 2}
              unit={unitSystem}
              onChangeM={(x) => onUpdateItem(sel, { x })}
            />
            <NumField
              label="From the left side"
              valueM={it.z ?? u.wid / 2}
              unit={unitSystem}
              onChangeM={(z) => onUpdateItem(sel, { z })}
            />
            <NumField
              label="Length"
              valueM={wVal}
              unit={unitSystem}
              onChangeM={(w) => onUpdateItem(sel, { w })}
            />
            <NumField
              label="Width"
              valueM={dVal}
              unit={unitSystem}
              onChangeM={(d) => onUpdateItem(sel, { d })}
            />
          </>
        ) : (
          // Site part
          <>
            <NumField
              label="East–west (x)"
              valueM={it.x ?? 0}
              unit={unitSystem}
              onChangeM={(x) => onUpdateItem(sel, { x })}
            />
            <NumField
              label="North–south (z)"
              valueM={it.z ?? 0}
              unit={unitSystem}
              onChangeM={(z) => onUpdateItem(sel, { z })}
            />
            <NumField
              label={p?.unit === 'length' && p.lengthOf !== 'd' ? 'Length' : 'Width'}
              valueM={wVal}
              unit={unitSystem}
              onChangeM={(w) => onUpdateItem(sel, { w })}
            />
            <NumField
              label={p?.lengthOf === 'd' || p?.stair ? 'Run' : 'Depth'}
              valueM={dVal}
              unit={unitSystem}
              onChangeM={(d) => onUpdateItem(sel, { d })}
            />
            <NumField
              label={
                p?.stair || ['deck', 'walkway', 'ramp', 'steps'].includes(it.type)
                  ? 'Rise / height'
                  : 'Height'
              }
              valueM={hVal}
              unit={unitSystem}
              onChangeM={(h) => onUpdateItem(sel, { h })}
            />
            <NumField
              label="Raised by"
              valueM={it.elev || 0}
              unit={unitSystem}
              onChangeM={(elev) => onUpdateItem(sel, { elev })}
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Facing</Text>
              <Pressable onPress={onRotate} style={styles.btnSecondary}>
                <Icon name="rotate" size={14} color={c.text} />
                <Text style={styles.btnText}>Turn 90°</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {notes.length > 0 ? (
        <View style={styles.notes}>
          {notes.map((n, idx) => (
            <View key={'pn_' + idx} style={styles.note}>
              <Icon name="info" size={14} color={c.mute} />
              <Text style={styles.noteText}>{n}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {p?.how || p?.spec ? (
        <View style={styles.howBox}>
          <Pressable
            onPress={() => setHowState({ open: !howOpen, tick: currentTick })}
            style={styles.howSummary}
          >
            <Icon name="info" size={14} color={c.dim} />
            <Text style={styles.howTitle}>How it’s built</Text>
            <Icon name={howOpen ? 'chevronDown' : 'chevron'} size={14} color={c.mute} />
          </Pressable>
          {howOpen && (
            <View style={styles.howBody}>
              {p?.spec ? <Text style={styles.howSpec}>{p.spec}</Text> : null}
              {p?.how ? <Text style={styles.howText}>{p.how}</Text> : null}
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.actsRow}>
        <Pressable onPress={onDuplicate} style={styles.btnSecondary}>
          <Icon name="copy" size={14} color={c.text} />
          <Text style={styles.btnText}>Duplicate</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={[styles.btnSecondary, styles.btnDanger]}>
          <Icon name="trash" size={14} color="#F07878" />
          <Text style={[styles.btnText, { color: '#F07878' }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: c.panel,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  kicker: {
    color: c.mute,
    fontSize: 11.5,
  },
  title: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  nameInput: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 6,
    backgroundColor: c.bg,
  },
  iconBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  price: {
    color: c.lime,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  priceSub: {
    color: c.mute,
    fontSize: 12,
    fontWeight: '400',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '48%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
    gap: 2,
  },
  statLabel: {
    color: c.mute,
    fontSize: 11.5,
  },
  statVal: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    width: '47%',
    flexGrow: 1,
    gap: 4,
  },
  fieldWide: {
    width: '100%',
    gap: 4,
  },
  fieldLabel: {
    color: c.dim,
    fontSize: 12,
  },
  fieldHint: {
    color: c.mute,
    fontSize: 11,
    lineHeight: 15,
  },
  numWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  numInput: {
    height: 36,
    paddingHorizontal: 10,
    paddingRight: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 13,
  },
  numUnit: {
    position: 'absolute',
    right: 10,
    color: c.mute,
    fontSize: 11.5,
  },
  selectBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
  },
  selectBtnText: {
    color: c.text,
    fontSize: 13,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 34,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: c.text,
    fontSize: 16,
  },
  stepVal: {
    flex: 1,
    textAlign: 'center',
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  btnSecondary: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.panel2,
  },
  btnDanger: {
    borderColor: 'rgba(240,120,120,0.35)',
  },
  btnText: {
    color: c.text,
    fontSize: 12.5,
    fontWeight: '500',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: c.panel,
  },
  swatchActive: {
    borderColor: c.lime,
  },
  wallChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
  },
  wallChipActive: {
    backgroundColor: c.lime,
    borderColor: c.lime,
  },
  wallChipText: {
    color: c.text,
    fontSize: 12,
  },
  actsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  sec: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  secTitle: {
    color: c.text,
    fontSize: 12.5,
    fontWeight: '600',
  },
  secCount: {
    color: c.mute,
    fontSize: 11.5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOk: {
    backgroundColor: 'rgba(104, 216, 136, 0.14)',
  },
  badgeClose: {
    backgroundColor: 'rgba(242, 192, 77, 0.16)',
  },
  badgeBad: {
    backgroundColor: 'rgba(240, 120, 120, 0.16)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dl: {
    gap: 6,
  },
  dlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dlKey: {
    color: c.mute,
    fontSize: 12.5,
  },
  dlVal: {
    color: c.text,
    fontSize: 12.5,
    textAlign: 'right',
    flex: 1,
  },
  notes: {
    marginTop: 12,
    gap: 6,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 9,
    borderRadius: 8,
    backgroundColor: c.panel2,
  },
  noteBad: {
    backgroundColor: 'rgba(240, 120, 120, 0.14)',
  },
  noteText: {
    flex: 1,
    color: c.dim,
    fontSize: 12.5,
    lineHeight: 17,
  },
  okRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
  },
  okText: {
    flex: 1,
    color: c.mute,
    fontSize: 12.5,
    lineHeight: 17,
  },
  howBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
  },
  howSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  howTitle: {
    flex: 1,
    color: c.text,
    fontSize: 12.5,
    fontWeight: '500',
  },
  howBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  howSpec: {
    color: c.text,
    fontSize: 12.5,
    fontWeight: '600',
  },
  howText: {
    color: c.dim,
    fontSize: 12.5,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  rowPressed: {
    backgroundColor: c.panel2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  rowText: {
    flex: 1,
    color: c.text,
    fontSize: 12.5,
  },
  rowMeta: {
    color: c.mute,
    fontSize: 11.5,
  },
  empty: {
    color: c.mute,
    fontSize: 12.5,
    marginVertical: 4,
  },
  tip: {
    color: c.mute,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: c.panel2,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line2,
    padding: 16,
  },
  modalTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalGroup: {
    color: c.mute,
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalOpt: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  modalOptActive: {
    backgroundColor: c.raised,
  },
  modalOptText: {
    color: c.text,
    fontSize: 13,
  },
});
