import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { buildQuote, ng, quoteText } from '../quote';
import type { Unit } from '../types';
import { c, r } from '../theme';
import { Btn, Label } from './ui';
import { Icon } from './Icon';

export function QuoteSheet({
  visible,
  units,
  onClose,
  onToast,
}: {
  visible: boolean;
  units: Unit[];
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const q = buildQuote(units);

  const copy = async () => {
    await Clipboard.setStringAsync(quoteText(units));
    onToast('Estimate copied');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View>
              <Label>Estimate</Label>
              <Text style={styles.title}>{ng(q.total)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="close" size={20} color={c.dim} />
            </Pressable>
          </View>

          <View style={styles.stats}>
            <Stat k="Units" v={String(q.units)} />
            <Stat k="Levels" v={String(q.levels)} />
            <Stat k="Floor" v={q.area.toFixed(0) + ' m2'} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {q.lines.map((l, i) => (
              <View key={i} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineLabel}>{l.label}</Text>
                  <Text style={styles.lineDetail}>{l.detail}</Text>
                </View>
                <Text style={styles.lineAmount}>{ng(l.amount)}</Text>
              </View>
            ))}

            <View style={styles.totals}>
              <Total k="Labour 12%" v={ng(q.labour)} />
              <Total k="Subtotal" v={ng(q.subtotal)} />
              <Total k="VAT 7.5%" v={ng(q.vat)} />
              <Total k="Total" v={ng(q.total)} big />
            </View>

            <Text style={styles.fine}>
              Indicative budget only. Corner castings carry the stack, so anything above one level needs an
              engineer's check before it leaves paper.
            </Text>
          </ScrollView>

          <Btn icon="copy" label="Copy estimate" onPress={copy} style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statV}>{v}</Text>
      <Text style={styles.statK}>{k}</Text>
    </View>
  );
}

function Total({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalK, big && { color: c.text }]}>{k}</Text>
      <Text style={[styles.totalV, big && { fontSize: 20, color: c.lime }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.panel,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    borderWidth: 1,
    borderColor: c.line,
    padding: 20,
    maxHeight: '88%',
    minHeight: '55%',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: c.text, fontSize: 28, fontWeight: '700', marginTop: 4, letterSpacing: -0.5 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: c.panel2, borderRadius: r.sm, padding: 10 },
  statV: { color: c.text, fontSize: 15, fontWeight: '600' },
  statK: { color: c.mute, fontSize: 10, marginTop: 3, letterSpacing: 1, textTransform: 'uppercase' },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.line },
  lineLabel: { color: c.text, fontSize: 13 },
  lineDetail: { color: c.mute, fontSize: 10.5, marginTop: 3 },
  lineAmount: { color: c.dim, fontSize: 12.5 },
  totals: { marginTop: 14, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalK: { color: c.dim, fontSize: 12.5 },
  totalV: { color: c.text, fontSize: 13 },
  fine: { color: c.mute, fontSize: 11, lineHeight: 17, marginTop: 18, marginBottom: 6 },
});
