import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRESETS, UNIT_TYPES } from '../data';
import type { Unit } from '../types';
import { c, r } from '../theme';
import { Icon } from './Icon';
import { Label } from './ui';

export function BuildPanel({
  onAdd,
  onPreset,
  onClear,
}: {
  onAdd: (type: string) => void;
  onPreset: (units: Unit[]) => void;
  onClear: () => void;
}) {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Label>Presets</Label>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Pressable key={p.id} onPress={() => onPreset(p.units)} style={({ pressed }) => [styles.preset, pressed && { borderColor: c.line2 }]}>
            <View style={styles.presetTop}>
              <Text style={styles.presetName}>{p.name}</Text>
              <Icon name="chevron" size={13} color={c.mute} />
            </View>
            <Text style={styles.presetMeta}>{p.meta}</Text>
            <Text style={styles.presetNote}>{p.note}</Text>
          </Pressable>
        ))}
      </View>

      <Label style={{ marginTop: 22 }}>Add a unit</Label>
      <View style={styles.types}>
        {UNIT_TYPES.map((t) => (
          <Pressable key={t.id} onPress={() => onAdd(t.id)} style={({ pressed }) => [styles.type, pressed && { borderColor: c.lime }]}>
            <View style={styles.typeIcon}>
              <Icon name="cube" size={16} color={c.dim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeName}>{t.name}</Text>
              <Text style={styles.typeMeta}>
                {t.len.toFixed(1)} x {t.wid.toFixed(1)} x {t.hgt.toFixed(2)} m
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clear: { color: c.mute, fontSize: 11, letterSpacing: 0.6 },
  presets: { gap: 8 },
  preset: {
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    borderRadius: r.md,
    padding: 13,
  },
  presetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetName: { color: c.text, fontSize: 14, fontWeight: '600' },
  presetMeta: { color: c.lime, fontSize: 10.5, letterSpacing: 1, marginTop: 5, textTransform: 'uppercase' },
  presetNote: { color: c.mute, fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  types: { gap: 8, marginTop: 10 },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    borderRadius: r.md,
    padding: 11,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: c.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: { color: c.text, fontSize: 13, fontWeight: '500' },
  typeMeta: { color: c.mute, fontSize: 10.5, marginTop: 3 },
});
