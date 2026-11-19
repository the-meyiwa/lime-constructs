import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OPENING_TYPES, SHELLS, TYPE } from '../data';
import { CATS, FURN, FURNITURE } from '../furniture';
import { unitArea } from '../quote';
import type { Item, Unit } from '../types';
import { c, r } from '../theme';
import { Icon } from './Icon';
import { Btn, Label, Row } from './ui';

export function Inspector({
  unit,
  itemId,
  onChange,
  onDelete,
  onDuplicate,
  onAddOpening,
  onRemoveOpening,
  onAddItem,
  onPatchItem,
  onRemoveItem,
  onSelectItem,
}: {
  unit: Unit | null;
  itemId: string | null;
  onChange: (patch: Partial<Unit>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddOpening: (typeId: string, wall: Unit['openings'][0]['wall']) => void;
  onRemoveOpening: (id: string) => void;
  onAddItem: (kind: string) => void;
  onPatchItem: (id: string, patch: Partial<Item>) => void;
  onRemoveItem: (id: string) => void;
  onSelectItem: (id: string | null) => void;
}) {
  const [wall, setWall] = useState<Unit['openings'][0]['wall']>('left');

  if (!unit) {
    return (
      <View style={styles.empty}>
        <Icon name="cube" size={26} color={c.mute} />
        <Text style={styles.emptyTitle}>Nothing selected</Text>
        <Text style={styles.emptyBody}>Tap a unit to edit its shell and openings, or a piece of furniture to move it.</Text>
      </View>
    );
  }

  const t = TYPE[unit.type];
  const shell = SHELLS.find((s) => s.id === unit.color) || SHELLS[0];
  const item = unit.items.find((x) => x.id === itemId) || null;
  const fit = unit.items.reduce((a, i) => a + (FURN[i.kind]?.price || 0), 0);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.sub}>
            {t.len.toFixed(1)} x {t.wid.toFixed(1)} x {t.hgt.toFixed(2)} m · {unitArea(unit).toFixed(1)} m2
          </Text>
        </View>
        <Text style={styles.levelTag}>L{unit.level + 1}</Text>
      </Row>

      <View style={styles.actions}>
        <Btn compact icon="up" onPress={() => onChange({ level: unit.level + 1 })} />
        <Btn compact icon="down" onPress={() => onChange({ level: Math.max(0, unit.level - 1) })} />
        <Btn compact icon="rotate" onPress={() => onChange({ rot: unit.rot ? 0 : 1 })} />
        <Btn compact icon="copy" onPress={onDuplicate} />
        <Btn compact icon="trash" danger onPress={onDelete} />
      </View>

      <Label style={{ marginTop: 22 }}>Position</Label>
      <Row style={styles.pad}>
        <Btn compact icon="minus" style={{ flex: 1 }} onPress={() => onChange({ x: unit.x - 0.5 })} />
        <Btn compact icon="plus" style={{ flex: 1 }} onPress={() => onChange({ x: unit.x + 0.5 })} />
        <Text style={styles.axis}>X {unit.x.toFixed(1)}</Text>
      </Row>
      <Row style={styles.pad}>
        <Btn compact icon="minus" style={{ flex: 1 }} onPress={() => onChange({ z: unit.z - 0.5 })} />
        <Btn compact icon="plus" style={{ flex: 1 }} onPress={() => onChange({ z: unit.z + 0.5 })} />
        <Text style={styles.axis}>Z {unit.z.toFixed(1)}</Text>
      </Row>

      <Row style={{ marginTop: 22, justifyContent: 'space-between' }}>
        <Label>Shell</Label>
        <Text style={styles.shellName}>{shell.name}</Text>
      </Row>
      <View style={styles.swatches}>
        {SHELLS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onChange({ color: s.id })}
            style={[styles.swatch, { backgroundColor: s.hex }, unit.color === s.id && styles.swatchOn]}
          />
        ))}
      </View>

      <Row style={{ marginTop: 22, justifyContent: 'space-between' }}>
        <Label>Fit-out</Label>
        <Text style={styles.shellName}>{'N' + Math.round(fit / 1000) + 'k'}</Text>
      </Row>

      {unit.items.map((it) => {
        const f = FURN[it.kind];
        if (!f) return null;
        const on = it.id === itemId;
        return (
          <Pressable key={it.id} onPress={() => onSelectItem(on ? null : it.id)} style={[styles.itemRow, on && styles.itemRowOn]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, on && { color: c.lime }]}>{f.name}</Text>
              <Text style={styles.itemMeta}>
                {f.w.toFixed(2)} x {f.d.toFixed(2)} x {f.h.toFixed(2)} m · {(f.price / 1000).toFixed(0)}k
              </Text>
            </View>
            <Pressable onPress={() => onRemoveItem(it.id)} hitSlop={10}>
              <Icon name="close" size={13} color={c.mute} />
            </Pressable>
          </Pressable>
        );
      })}

      {item && (
        <View style={styles.itemCtl}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.itemCtlName}>{FURN[item.kind]?.name}</Text>
            <Text style={styles.itemMeta}>rotation {item.rot * 90}°</Text>
          </Row>
          <Row style={{ gap: 8, marginTop: 8 }}>
            <Btn compact icon="rotate" style={{ flex: 1 }} onPress={() => onPatchItem(item.id, { rot: (((item.rot + 1) % 4) as 0 | 1 | 2 | 3) })} />
            <Btn compact icon="minus" style={{ flex: 1 }} onPress={() => onPatchItem(item.id, { x: Math.max(0.2, item.x - 0.1) })} />
            <Btn compact icon="plus" style={{ flex: 1 }} onPress={() => onPatchItem(item.id, { x: item.x + 0.1 })} />
            <Btn compact icon="trash" danger onPress={() => onRemoveItem(item.id)} />
          </Row>
        </View>
      )}

      {CATS.map((cat) => {
        const list = FURNITURE.filter((f) => f.cat === cat.id);
        return (
          <View key={cat.id}>
            <Text style={styles.cat}>{cat.label}</Text>
            <View style={styles.grid}>
              {list.map((f) => (
                <Pressable key={f.id} onPress={() => onAddItem(f.id)} style={({ pressed }) => [styles.add, pressed && { borderColor: c.lime }]}>
                  <Text style={styles.addName}>{f.name}</Text>
                  <Text style={styles.addMeta}>{(f.price / 1000).toFixed(0)}k</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      <Label style={{ marginTop: 26 }}>Openings</Label>
      {unit.openings.length === 0 && <Text style={styles.hint}>No openings yet. A sealed box is cheap and dark.</Text>}
      {unit.openings.map((o) => (
        <Row key={o.id} style={styles.opening}>
          <View style={{ flex: 1 }}>
            <Text style={styles.openingName}>{o.label}</Text>
            <Text style={styles.openingMeta}>
              {o.wall} wall · {o.w.toFixed(2)} x {o.h.toFixed(2)} m
            </Text>
          </View>
          <Pressable onPress={() => onRemoveOpening(o.id)} hitSlop={8}>
            <Icon name="close" size={14} color={c.mute} />
          </Pressable>
        </Row>
      ))}

      <View style={styles.wallPicker}>
        {(['front', 'back', 'left', 'right'] as const).map((w) => (
          <Pressable key={w} onPress={() => setWall(w)} style={[styles.wallBtn, wall === w && styles.wallBtnOn]}>
            <Text style={[styles.wallText, wall === w && { color: c.bg }]}>{w}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.openingGrid}>
        {OPENING_TYPES.map((o) => (
          <Pressable key={o.id} onPress={() => onAddOpening(o.id, wall)} style={({ pressed }) => [styles.openingAdd, pressed && { borderColor: c.lime }]}>
            <Text style={styles.openingAddName}>{o.label}</Text>
            <Text style={styles.openingAddMeta}>{(o.rate / 1000).toFixed(0)}k</Text>
          </Pressable>
        ))}
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
  name: { color: c.text, fontSize: 16, fontWeight: '600' },
  sub: { color: c.mute, fontSize: 11.5, marginTop: 4 },
  levelTag: { color: c.lime, fontSize: 12, letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  pad: { gap: 8, marginTop: 8 },
  axis: { color: c.dim, fontSize: 11.5, width: 54, textAlign: 'right' },
  shellName: { color: c.dim, fontSize: 11.5 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  swatch: { width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  swatchOn: { borderColor: c.lime, borderWidth: 2 },
  cat: { color: c.mute, fontSize: 9.5, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  add: { width: '47%', borderWidth: 1, borderColor: c.line, borderRadius: r.sm, paddingVertical: 8, paddingHorizontal: 9, backgroundColor: c.panel },
  addName: { color: c.text, fontSize: 11.5 },
  addMeta: { color: c.mute, fontSize: 10, marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.panel, borderRadius: r.sm, padding: 9, marginTop: 7 },
  itemRowOn: { borderColor: c.lime },
  itemName: { color: c.text, fontSize: 12 },
  itemMeta: { color: c.mute, fontSize: 10.5, marginTop: 2 },
  itemCtl: { borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel2, borderRadius: r.sm, padding: 10, marginTop: 8 },
  itemCtlName: { color: c.text, fontSize: 12, fontWeight: '600' },
  hint: { color: c.mute, fontSize: 11.5, marginTop: 10 },
  opening: { backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, borderRadius: r.sm, padding: 10, marginTop: 8 },
  openingName: { color: c.text, fontSize: 12.5 },
  openingMeta: { color: c.mute, fontSize: 10.5, marginTop: 3 },
  wallPicker: { flexDirection: 'row', gap: 6, marginTop: 14 },
  wallBtn: { flex: 1, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingVertical: 6, alignItems: 'center', backgroundColor: c.panel },
  wallBtnOn: { backgroundColor: c.lime, borderColor: c.lime },
  wallText: { color: c.dim, fontSize: 10.5, textTransform: 'capitalize' },
  openingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  openingAdd: { width: '47%', borderWidth: 1, borderColor: c.line, borderRadius: r.sm, padding: 10, backgroundColor: c.panel },
  openingAddName: { color: c.text, fontSize: 11.5 },
  openingAddMeta: { color: c.mute, fontSize: 10.5, marginTop: 3 },
});
