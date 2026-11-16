import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { c, r } from '../theme';

export function Label({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Btn({
  icon,
  label,
  onPress,
  active,
  danger,
  style,
  compact,
}: {
  icon?: string;
  label?: string;
  onPress?: () => void;
  active?: boolean;
  danger?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}) {
  const color = active ? c.lime : danger ? '#E4A0A0' : c.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        active && styles.btnActive,
        pressed && { opacity: 0.65 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={compact ? 16 : 17} color={color} /> : null}
      {label ? <Text style={[styles.btnText, { color }]}>{label}</Text> : null}
    </Pressable>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  label: {
    color: c.mute,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.sm,
    paddingHorizontal: 12,
    height: 38,
  },
  btnCompact: { height: 32, paddingHorizontal: 9, borderRadius: 8 },
  btnActive: { borderColor: c.lime, backgroundColor: 'rgba(201,242,77,0.09)' },
  btnText: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
