import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FITOUT, PRESETS, TYPE, UNIT_TYPES } from '../data';
import { formatCompact } from '../quote';
import type { CurrencyCode, Unit } from '../types';
import { c, r } from '../theme';
import { Icon } from './Icon';
import { Label } from './ui';

export function BuildPanel({
  units,
  selected,
  currency = 'NGN',
  onSelect,
  onAdd,
  onPreset,
  onClear,
}: {
  units?: Unit[];
  selected?: string | null;
  currency?: CurrencyCode;
  onSelect?: (id: string) => void;
  onAdd: (type: string) => void;
  onPreset: (units: Unit[]) => void;
  onClear: () => void;
}) {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {units && units.length > 0 && (
        <>
          <View style={styles.head}>
            <Label>Active Layout ({units.length})</Label>
            <Pressable onPress={onClear} hitSlop={8}>
              <Text style={styles.clear}>Clear All</Text>
            </Pressable>
          </View>
          <View style={styles.schedule}>
            {units.map((u, idx) => {
              const t = TYPE[u.type] || TYPE['20ft'];
              const fit = FITOUT[u.fitout || 'raw'] || FITOUT.raw;
              const isSel = u.id === selected;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => onSelect?.(u.id)}
                  style={[styles.unitRow, isSel && styles.unitRowSel]}
                >
                  <View style={[styles.unitIndex, isSel && { backgroundColor: c.lime }]}>
                    <Text style={[styles.unitIndexText, isSel && { color: c.bg }]}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitRowName, isSel && { color: c.lime }]}>{u.label || t.name}</Text>
                    <Text style={styles.unitRowMeta}>
                      {t.short} · L{u.level + 1} · {fit.short} · {u.openings.length} openings
                    </Text>
                  </View>
                  <Text style={styles.unitCoord}>
                    ({u.x.toFixed(1)}, {u.z.toFixed(1)})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Label style={{ marginTop: units && units.length ? 22 : 0, marginBottom: 10 }}>Add Container / Cabin</Label>
      <View style={styles.types}>
        {UNIT_TYPES.map((t) => (
          <Pressable key={t.id} onPress={() => onAdd(t.id)} style={({ pressed }) => [styles.type, pressed && { borderColor: c.lime }]}>
            <View style={styles.typeIcon}>
              <Icon name="cube" size={16} color={c.dim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeName}>{t.name}</Text>
              <Text style={styles.typeMeta}>
                {t.len.toFixed(2)} × {t.wid.toFixed(2)} × {t.hgt.toFixed(2)} m · {(t.len * t.wid).toFixed(0)} m²
              </Text>
            </View>
            <Text style={styles.typePrice}>{formatCompact(t.price, currency)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.head, { marginTop: 22 }]}>
        <Label>Starter Templates</Label>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clear: { color: '#E4A0A0', fontSize: 11, letterSpacing: 0.5, fontWeight: '600' },
  schedule: { gap: 6 },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.sm,
    padding: 9,
  },
  unitRowSel: { borderColor: c.lime, backgroundColor: 'rgba(201,242,77,0.07)' },
  unitIndex: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: c.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitIndexText: { color: c.dim, fontSize: 10.5, fontWeight: '700' },
  unitRowName: { color: c.text, fontSize: 12.5, fontWeight: '600' },
  unitRowMeta: { color: c.mute, fontSize: 10, marginTop: 2 },
  unitCoord: { color: c.mute, fontSize: 10, fontVariant: ['tabular-nums'] },
  presets: { gap: 8 },
  preset: {
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    borderRadius: r.md,
    padding: 13,
  },
  presetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetName: { color: c.text, fontSize: 13.5, fontWeight: '600' },
  presetMeta: { color: c.lime, fontSize: 10, letterSpacing: 0.9, marginTop: 4, textTransform: 'uppercase' },
  presetNote: { color: c.mute, fontSize: 11, lineHeight: 15, marginTop: 5 },
  types: { gap: 7 },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    borderRadius: r.md,
    padding: 10,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: { color: c.text, fontSize: 12.5, fontWeight: '500' },
  typeMeta: { color: c.mute, fontSize: 10, marginTop: 2 },
  typePrice: { color: c.lime, fontSize: 11, fontWeight: '600' },
});
