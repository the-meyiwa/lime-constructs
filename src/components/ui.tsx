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
  disabled,
  style,
  compact,
  holdRepeat,
}: {
  icon?: string;
  label?: string;
  onPress?: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
  holdRepeat?: boolean;
}) {
  const color = disabled ? c.mute : active ? c.lime : danger ? '#E4A0A0' : c.text;
  const onPressRef = React.useRef(onPress);
  onPressRef.current = onPress;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  React.useEffect(() => stopHold, [stopHold]);

  const handlePressIn = () => {
    if (disabled || !holdRepeat) return;
    stopHold();
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        onPressRef.current?.();
      }, 95);
    }, 320);
  };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={stopHold}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        active && styles.btnActive,
        disabled && { opacity: 0.38 },
        pressed && !disabled && { opacity: 0.65 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={compact ? 15 : 17} color={color} /> : null}
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
  btnText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
