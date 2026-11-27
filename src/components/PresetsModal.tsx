import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Icon } from './Icon';
import { PART, PRESETS, unitRect, type PresetDef } from '../container-library';
import { c, r } from '../theme';

function PresetPlanSvg({ p }: { p: PresetDef }) {
  const units = p.units.map((u, i) => ({ ...u, id: `p${i}` }));
  const rects = units.map((u) => ({ ...unitRect(u), level: u.level || 0 }));
  const site = (p.site || []).map((s) => {
    const pt = s.type ? PART[s.type] : undefined;
    const w = s.w ?? pt?.w ?? 1;
    const d = s.d ?? pt?.d ?? 1;
    const [dx, dz] = (s.rot || 0) % 2 ? [d, w] : [w, d];
    const sx = s.x ?? 0;
    const sz = s.z ?? 0;
    return { x0: sx - dx / 2, x1: sx + dx / 2, z0: sz - dz / 2, z1: sz + dz / 2 };
  });
  const all = [...rects, ...site];
  const x0 = Math.min(...all.map((r) => r.x0));
  const x1 = Math.max(...all.map((r) => r.x1));
  const z0 = Math.min(...all.map((r) => r.z0));
  const z1 = Math.max(...all.map((r) => r.z1));
  const W = 160;
  const H = 96;
  const pad = 8;
  const s = Math.min((W - 2 * pad) / Math.max(x1 - x0, 0.1), (H - 2 * pad) / Math.max(z1 - z0, 0.1));
  const ox = (W - (x1 - x0) * s) / 2;
  const oz = (H - (z1 - z0) * s) / 2;

  const sortedRects = [...rects].sort((a, b) => a.level - b.level);

  return (
    <View style={styles.planBox}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={84}>
        {site.map((r, i) => (
          <Rect
            key={'s' + i}
            x={ox + (r.x0 - x0) * s}
            y={oz + (r.z0 - z0) * s}
            width={(r.x1 - r.x0) * s}
            height={(r.z1 - r.z0) * s}
            rx={1}
            fill="none"
            stroke={c.mute}
            strokeWidth={0.9}
            strokeDasharray="2,2"
          />
        ))}
        {sortedRects.map((r, i) => {
          const fill = r.level === 0 ? '#787C84' : r.level === 1 ? '#C9F24D' : '#F2F3F5';
          const opacity = r.level === 0 ? 0.85 : 0.92;
          return (
            <Rect
              key={'u' + i}
              x={ox + (r.x0 - x0) * s}
              y={oz + (r.z0 - z0) * s}
              width={(r.x1 - r.x0) * s}
              height={(r.z1 - r.z0) * s}
              rx={1.5}
              fill={fill}
              fillOpacity={opacity}
              stroke={c.panel}
              strokeWidth={1.1}
            />
          );
        })}
      </Svg>
    </View>
  );
}

export function PresetsModal({
  visible,
  onClose,
  onSelectPreset,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetDef) => void;
}) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 640;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Start from a design</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Icon name="close" size={16} color={c.dim} />
            </Pressable>
          </View>
          <Text style={styles.sub}>
            Every layout uses real ISO sizes and carries notes on how it is built. Loading one replaces the current build (undo brings it back).
          </Text>
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  onSelectPreset(p);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.preset,
                  isNarrow ? { width: '48%' } : { width: 205 },
                  pressed && styles.presetPressed,
                ]}
              >
                <PresetPlanSvg p={p} />
                <Text style={styles.presetName}>{p.name}</Text>
                <Text style={styles.presetTag}>{p.tag}</Text>
                {!isNarrow && <Text style={styles.presetBlurb}>{p.blurb}</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 940,
    maxHeight: '90%',
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: r.lg,
    padding: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  sub: {
    color: c.dim,
    fontSize: 12.5,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
  },
  preset: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.md,
    backgroundColor: c.panel2,
    padding: 10,
    gap: 3,
  },
  presetPressed: {
    borderColor: c.lime,
    backgroundColor: c.raised,
  },
  planBox: {
    width: '100%',
    height: 84,
    borderRadius: 8,
    backgroundColor: c.bg,
    marginBottom: 6,
    overflow: 'hidden',
  },
  presetName: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  presetTag: {
    color: c.mute,
    fontSize: 11.5,
  },
  presetBlurb: {
    color: c.dim,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
