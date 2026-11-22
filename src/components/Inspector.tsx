import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CORNER_POST_MARGIN, EXTRAS, FITOUT_SPECS, OPENING_TYPES, SHELLS, TYPE } from '../data';
import { unitBox, wallLen } from '../geo';
import { formatCompact, unitArea } from '../quote';
import type { CurrencyCode, Opening, Unit, Wall } from '../types';
import { c, r } from '../theme';
import { Icon } from './Icon';
import { Btn, Label, Row } from './ui';

const STEPS = [
  { label: '0.1m', val: 0.1 },
  { label: '0.5m', val: 0.5 },
  { label: '1.22m (4ft)', val: 1.22 },
  { label: '2.44m (8ft)', val: 2.44 },
];

export function Inspector({
  unit,
  allUnits,
  currency = 'NGN',
  onChange,
  onDelete,
  onDuplicate,
  onAddOpening,
  onUpdateOpening,
  onRemoveOpening,
}: {
  unit: Unit | null;
  allUnits: Unit[];
  currency?: CurrencyCode;
  onChange: (patch: Partial<Unit>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddOpening: (typeId: string, wall: Wall) => void;
  onUpdateOpening: (id: string, patch: Partial<Opening>) => void;
  onRemoveOpening: (id: string) => void;
}) {
  const [wall, setWall] = useState<Wall>('left');
  const [step, setStep] = useState<number>(0.5);

  if (!unit) {
    return (
      <View style={styles.empty}>
        <Icon name="cube" size={26} color={c.mute} />
        <Text style={styles.emptyTitle}>Nothing selected</Text>
        <Text style={styles.emptyBody}>Tap a unit in the 3D or plan view to configure its fit-out, alignment, shell and openings.</Text>
      </View>
    );
  }

  const t = TYPE[unit.type] || TYPE['20ft'];
  const box = unitBox(unit);
  const others = allUnits.filter((u) => u.id !== unit.id);
  const anchor = others[others.length - 1] || null;
  const anchorBox = anchor ? unitBox(anchor) : null;

  const snapSideBySide = () => {
    if (!anchor || !anchorBox) return;
    onChange({ x: anchor.x, z: Number((anchor.z + anchorBox.W).toFixed(2)), level: anchor.level, rot: anchor.rot });
  };

  const snapEndToEnd = () => {
    if (!anchor || !anchorBox) return;
    onChange({ x: Number((anchor.x + anchorBox.L).toFixed(2)), z: anchor.z, level: anchor.level, rot: anchor.rot });
  };

  const snapLCorner = () => {
    if (!anchor || !anchorBox) return;
    const nextRot: 0 | 1 = anchor.rot ? 0 : 1;
    const nextL = nextRot ? t.wid : t.len;
    onChange({
      rot: nextRot,
      level: anchor.level,
      x: Number((anchor.x + anchorBox.L - nextL).toFixed(2)),
      z: Number((anchor.z + anchorBox.W).toFixed(2)),
    });
  };

  const snapStackAbove = () => {
    if (!anchor) return;
    onChange({ x: anchor.x, z: anchor.z, rot: anchor.rot, level: anchor.level + 1 });
  };

  const clampOpeningAlong = (o: Opening, nextWall: Wall, targetAlong: number) => {
    const wLen = wallLen(nextWall, box);
    const min = Math.min(wLen / 2, o.w / 2 + CORNER_POST_MARGIN);
    const max = Math.max(wLen / 2, wLen - o.w / 2 - CORNER_POST_MARGIN);
    return Number(Math.max(min, Math.min(max, targetAlong)).toFixed(2));
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <TextInput
            value={unit.label ?? ''}
            onChangeText={(txt) => onChange({ label: txt })}
            placeholder={t.name}
            placeholderTextColor={c.dim}
            style={styles.nameInput}
          />
          <Text style={styles.sub}>
            {t.name} · {t.len.toFixed(2)} × {t.wid.toFixed(2)} × {t.hgt.toFixed(2)} m · {unitArea(unit).toFixed(1)} m²
          </Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelTag}>L{unit.level + 1}</Text>
        </View>
      </Row>

      <View style={styles.actions}>
        <Btn compact icon="up" onPress={() => onChange({ level: unit.level + 1 })} />
        <Btn compact icon="down" disabled={unit.level === 0} onPress={() => onChange({ level: Math.max(0, unit.level - 1) })} />
        <Btn
          compact
          icon="rotate"
          onPress={() => {
            const nextRot: 0 | 1 = unit.rot ? 0 : 1;
            const nextBox = unitBox({ ...unit, rot: nextRot });
            const nextOpenings = unit.openings.map((o) => {
              const wLen = wallLen(o.wall, nextBox);
              const min = Math.min(wLen / 2, o.w / 2 + CORNER_POST_MARGIN);
              const max = Math.max(wLen / 2, wLen - o.w / 2 - CORNER_POST_MARGIN);
              return { ...o, along: Number(Math.max(min, Math.min(max, o.along)).toFixed(2)) };
            });
            onChange({ rot: nextRot, openings: nextOpenings });
          }}
        />
        <Btn compact icon="copy" onPress={onDuplicate} />
        <Btn compact icon="trash" danger onPress={onDelete} />
      </View>

      {anchor && (
        <>
          <Label style={{ marginTop: 18 }}>Magnetic Snap (to {anchor.label || TYPE[anchor.type]?.short})</Label>
          <View style={styles.snapGrid}>
            <Pressable onPress={snapSideBySide} style={styles.snapBtn}>
              <Icon name="magnet" size={13} color={c.lime} />
              <Text style={styles.snapText}>Flush Side</Text>
            </Pressable>
            <Pressable onPress={snapEndToEnd} style={styles.snapBtn}>
              <Icon name="magnet" size={13} color={c.lime} />
              <Text style={styles.snapText}>Flush End</Text>
            </Pressable>
            <Pressable onPress={snapLCorner} style={styles.snapBtn}>
              <Icon name="magnet" size={13} color={c.lime} />
              <Text style={styles.snapText}>90° L-Corner</Text>
            </Pressable>
            <Pressable onPress={snapStackAbove} style={styles.snapBtn}>
              <Icon name="layers" size={13} color={c.lime} />
              <Text style={styles.snapText}>Stack On Top</Text>
            </Pressable>
          </View>
        </>
      )}

      <Row style={{ justifyContent: 'space-between', marginTop: 18 }}>
        <Label>Position & Step</Label>
        <Pressable onPress={() => onChange({ x: 0, z: 0 })} hitSlop={6}>
          <Text style={styles.zeroLink}>Zero (0, 0)</Text>
        </Pressable>
      </Row>

      <View style={styles.stepBar}>
        {STEPS.map((s) => (
          <Pressable key={s.label} onPress={() => setStep(s.val)} style={[styles.stepChip, step === s.val && styles.stepChipOn]}>
            <Text style={[styles.stepChipText, step === s.val && { color: c.bg }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Row style={styles.pad}>
        <Btn compact holdRepeat icon="minus" style={{ flex: 1 }} onPress={() => onChange({ x: Number((unit.x - step).toFixed(2)) })} />
        <Btn compact holdRepeat icon="plus" style={{ flex: 1 }} onPress={() => onChange({ x: Number((unit.x + step).toFixed(2)) })} />
        <Text style={styles.axis}>X {unit.x.toFixed(2)}m</Text>
      </Row>
      <Row style={styles.pad}>
        <Btn compact holdRepeat icon="minus" style={{ flex: 1 }} onPress={() => onChange({ z: Number((unit.z - step).toFixed(2)) })} />
        <Btn compact holdRepeat icon="plus" style={{ flex: 1 }} onPress={() => onChange({ z: Number((unit.z + step).toFixed(2)) })} />
        <Text style={styles.axis}>Z {unit.z.toFixed(2)}m</Text>
      </Row>

      <Label style={{ marginTop: 20 }}>Interior Fit-Out & MEP</Label>
      <View style={styles.fitoutList}>
        {FITOUT_SPECS.map((f) => {
          const active = (unit.fitout || 'raw') === f.id;
          const cost = Math.round(unitArea(unit) * f.ratePerM2 + f.mepFlat);
          return (
            <Pressable
              key={f.id}
              onPress={() => onChange({ fitout: f.id })}
              style={[styles.fitCard, active && styles.fitCardOn]}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[styles.fitName, active && { color: c.lime }]}>{f.name}</Text>
                <Text style={styles.fitCost}>{cost === 0 ? 'Included' : '+' + formatCompact(cost, currency)}</Text>
              </Row>
              <Text style={styles.fitDesc}>{f.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label style={{ marginTop: 20 }}>Systems & Architectural Add-ons</Label>
      <View style={styles.addonGrid}>
        <Pressable
          onPress={() => onChange({ roofDeck: !unit.roofDeck })}
          style={[styles.addonBtn, unit.roofDeck && styles.addonBtnOn]}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[styles.addonTitle, unit.roofDeck && { color: c.lime }]}>Roof Terrace Deck</Text>
            <Text style={styles.addonMeta}>+{formatCompact(unitArea(unit) * EXTRAS.roofDeckPerM2, currency)}</Text>
          </Row>
          <Text style={styles.addonSub}>Composite timber decking + perimeter guard rail</Text>
        </Pressable>

        <Pressable
          onPress={() => onChange({ stairs: !unit.stairs })}
          style={[styles.addonBtn, unit.stairs && styles.addonBtnOn]}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[styles.addonTitle, unit.stairs && { color: c.lime }]}>External Steel Stair</Text>
            <Text style={styles.addonMeta}>+{formatCompact(EXTRAS.externalStair, currency)}</Text>
          </Row>
          <Text style={styles.addonSub}>Galvanized tread flight & upper level landing</Text>
        </Pressable>

        <Pressable
          onPress={() => onChange({ solar: !unit.solar })}
          style={[styles.addonBtn, unit.solar && styles.addonBtnOn]}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[styles.addonTitle, unit.solar && { color: c.lime }]}>3.5 kVA Solar + Battery</Text>
            <Text style={styles.addonMeta}>+{formatCompact(EXTRAS.solarPackage, currency)}</Text>
          </Row>
          <Text style={styles.addonSub}>4× 450W roof panels, hybrid inverter & LiFePO4 pack</Text>
        </Pressable>
      </View>

      <Label style={{ marginTop: 20 }}>
        Exterior Shell Finish ({SHELLS.find((s) => s.id === unit.color)?.name || 'Custom'})
      </Label>
      <Row style={{ gap: 8, marginTop: 10 }}>
        {SHELLS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onChange({ color: s.id })}
            style={[
              styles.swatch,
              { backgroundColor: s.hex },
              unit.color === s.id && styles.swatchOn,
            ]}
          />
        ))}
      </Row>

      <Label style={{ marginTop: 20 }}>Openings & Wall Cutouts ({unit.openings.length})</Label>
      {unit.openings.length === 0 && <Text style={styles.hint}>No openings yet. Tap a wall below to cut doors, windows or open spans.</Text>}
      {unit.openings.map((o) => {
        const wLen = wallLen(o.wall, box);
        return (
          <View key={o.id} style={styles.openingCard}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.openingName}>
                  {o.label} {o.w >= 1.8 ? '· +RHS Lintel' : ''}
                </Text>
                <Text style={styles.openingMeta}>
                  {o.wall} wall ({wLen.toFixed(2)}m) · {o.w.toFixed(2)}×{o.h.toFixed(2)}m · center @ {o.along.toFixed(2)}m
                </Text>
              </View>
              <Pressable onPress={() => onRemoveOpening(o.id)} hitSlop={8}>
                <Icon name="close" size={14} color={c.mute} />
              </Pressable>
            </Row>

            <Row style={styles.openingControls}>
              <Btn
                compact
                holdRepeat
                icon="left"
                onPress={() => onUpdateOpening(o.id, { along: clampOpeningAlong(o, o.wall, o.along - 0.25) })}
              />
              <Pressable
                onPress={() => onUpdateOpening(o.id, { along: Number((wLen / 2).toFixed(2)) })}
                style={styles.centerPill}
              >
                <Text style={styles.centerPillText}>Center ({(wLen / 2).toFixed(1)}m)</Text>
              </Pressable>
              <Btn
                compact
                holdRepeat
                icon="right"
                onPress={() => onUpdateOpening(o.id, { along: clampOpeningAlong(o, o.wall, o.along + 0.25) })}
              />
              <View style={{ flex: 1 }} />
              {(['front', 'back', 'left', 'right'] as const).map((w) => {
                const targetLen = wallLen(w, box);
                const fitsWall = o.w + CORNER_POST_MARGIN * 2 <= targetLen;
                return (
                  <Pressable
                    key={w}
                    disabled={!fitsWall}
                    onPress={() => onUpdateOpening(o.id, { wall: w, along: clampOpeningAlong(o, w, targetLen / 2) })}
                    style={[styles.miniWallBtn, !fitsWall && { opacity: 0.25 }, o.wall === w && styles.miniWallBtnOn]}
                  >
                    <Text style={[styles.miniWallText, o.wall === w && { color: c.bg }]}>{w[0].toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </Row>
          </View>
        );
      })}

      <Label style={{ marginTop: 16 }}>Add Opening on Wall</Label>
      <View style={styles.wallPicker}>
        {(['front', 'back', 'left', 'right'] as const).map((w) => (
          <Pressable key={w} onPress={() => setWall(w)} style={[styles.wallBtn, wall === w && styles.wallBtnOn]}>
            <Text style={[styles.wallText, wall === w && { color: c.bg }]}>
              {w} ({wallLen(w, box).toFixed(1)}m)
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.openingGrid}>
        {OPENING_TYPES.map((o) => {
          const fits = o.w + CORNER_POST_MARGIN * 2 <= wallLen(wall, box);
          return (
            <Pressable
              key={o.id}
              disabled={!fits}
              onPress={() => onAddOpening(o.id, wall)}
              style={({ pressed }) => [
                styles.openingAdd,
                !fits && { opacity: 0.35 },
                pressed && fits && { borderColor: c.lime },
              ]}
            >
              <Text style={styles.openingAddName}>{o.label}</Text>
              <Text style={styles.openingAddMeta}>
                {o.w.toFixed(1)}×{o.h.toFixed(1)}m · {formatCompact(o.rate, currency)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 34 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8 },
  emptyTitle: { color: c.dim, fontSize: 14, marginTop: 6 },
  emptyBody: { color: c.mute, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  nameInput: {
    color: c.text,
    fontSize: 15.5,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    paddingVertical: 2,
  },
  sub: { color: c.mute, fontSize: 11, marginTop: 5 },
  levelBadge: {
    backgroundColor: 'rgba(201,242,77,0.12)',
    borderWidth: 1,
    borderColor: c.lime,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelTag: { color: c.lime, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  snapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  snapBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  snapText: { color: c.text, fontSize: 11.5, fontWeight: '500' },
  zeroLink: { color: c.lime, fontSize: 10.5, fontWeight: '600' },
  stepBar: { flexDirection: 'row', gap: 6, marginTop: 8 },
  stepChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    borderRadius: 7,
    paddingVertical: 5,
    alignItems: 'center',
  },
  stepChipOn: { backgroundColor: c.lime, borderColor: c.lime },
  stepChipText: { color: c.dim, fontSize: 10, fontWeight: '600' },
  pad: { gap: 8, marginTop: 8 },
  axis: { color: c.dim, fontSize: 11.5, width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  fitoutList: { gap: 7, marginTop: 8 },
  fitCard: {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.sm,
    padding: 10,
  },
  fitCardOn: { borderColor: c.lime, backgroundColor: 'rgba(201,242,77,0.06)' },
  fitName: { color: c.text, fontSize: 12.5, fontWeight: '600' },
  fitCost: { color: c.dim, fontSize: 11, fontWeight: '600' },
  fitDesc: { color: c.mute, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  addonGrid: { gap: 7, marginTop: 8 },
  addonBtn: {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.sm,
    padding: 10,
  },
  addonBtnOn: { borderColor: c.lime, backgroundColor: 'rgba(201,242,77,0.07)' },
  addonTitle: { color: c.text, fontSize: 12, fontWeight: '600' },
  addonMeta: { color: c.dim, fontSize: 11, fontWeight: '600' },
  addonSub: { color: c.mute, fontSize: 10.5, marginTop: 3 },
  swatch: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: c.line2 },
  swatchOn: { borderColor: c.lime, borderWidth: 2 },
  hint: { color: c.mute, fontSize: 11.5, marginTop: 10, lineHeight: 16 },
  openingCard: {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.sm,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  openingName: { color: c.text, fontSize: 12.5, fontWeight: '500' },
  openingMeta: { color: c.mute, fontSize: 10.5, marginTop: 2 },
  openingControls: { gap: 5 },
  centerPill: {
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 7,
    paddingHorizontal: 8,
    height: 30,
    justifyContent: 'center',
  },
  centerPillText: { color: c.dim, fontSize: 10.5 },
  miniWallBtn: {
    width: 24,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniWallBtnOn: { backgroundColor: c.lime, borderColor: c.lime },
  miniWallText: { color: c.dim, fontSize: 10, fontWeight: '700' },
  wallPicker: { flexDirection: 'row', gap: 6, marginTop: 8 },
  wallBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: c.panel,
  },
  wallBtnOn: { backgroundColor: c.lime, borderColor: c.lime },
  wallText: { color: c.dim, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  openingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  openingAdd: {
    width: '48%',
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.sm,
    padding: 10,
    backgroundColor: c.panel,
  },
  openingAddName: { color: c.text, fontSize: 11.5, fontWeight: '500' },
  openingAddMeta: { color: c.mute, fontSize: 10, marginTop: 3 },
});
