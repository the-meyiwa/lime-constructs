import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OPENING_TYPES, SHELLS, TYPE } from '../data';
import { unitArea } from '../quote';
import type { Unit } from '../types';
import { c, r } from '../theme';
import { Icon } from './Icon';
import { Btn, Label, Row } from './ui';

export function Inspector({
  unit,
  onChange,
  onDelete,
  onDuplicate,
  onAddOpening,
  onRemoveOpening,
}: {
  unit: Unit | null;
  onChange: (patch: Partial<Unit>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddOpening: (typeId: string, wall: Unit['openings'][0]['wall']) => void;
  onRemoveOpening: (id: string) => void;
}) {
  const [wall, setWall] = useState<Unit['openings'][0]['wall']>('left');

  if (!unit) {
    return (
      <View style={styles.empty}>
        <Icon name="cube" size={26} color={c.mute} />
        <Text style={styles.emptyTitle}>Nothing selected</Text>
        <Text style={styles.emptyBody}>Tap a unit in the scene to edit its level, shell and openings.</Text>
      </View>
    );
  }

  const t = TYPE[unit.type];

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

      <Label style={{ marginTop: 22 }}>Shell</Label>
      <Row style={{ gap: 8, marginTop: 10 }}>
        {SHELLS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onChange({ color: s.id })}
            style={[styles.swatch, { backgroundColor: 'rgb(' + Math.round(s.g * 255) + ',' + Math.round(s.g * 255) + ',' + Math.round(s.g * 255) + ')' }, unit.color === s.id && styles.swatchOn]}
          />
        ))}
      </Row>

      <Label style={{ marginTop: 22 }}>Openings</Label>
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
  content: { padding: 16, paddingBottom: 30 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8 },
  emptyTitle: { color: c.dim, fontSize: 14, marginTop: 6 },
  emptyBody: { color: c.mute, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  name: { color: c.text, fontSize: 16, fontWeight: '600' },
  sub: { color: c.mute, fontSize: 11.5, marginTop: 4 },
  levelTag: { color: c.lime, fontSize: 12, letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  pad: { gap: 8, marginTop: 8 },
  axis: { color: c.dim, fontSize: 11.5, width: 54, textAlign: 'right' },
  swatch: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: c.line2 },
  swatchOn: { borderColor: c.lime, borderWidth: 2 },
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
