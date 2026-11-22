import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CURRENCIES } from '../data';
import { buildQuote, formatCompact, formatMoney, quoteText } from '../quote';
import type { CurrencyCode, ProjectMeta, Unit } from '../types';
import { c, r } from '../theme';
import { Btn, Label, Row } from './ui';
import { Icon } from './Icon';

export function QuoteSheet({
  visible,
  units,
  meta,
  onChangeMeta,
  onImportUnits,
  onClose,
  onToast,
}: {
  visible: boolean;
  units: Unit[];
  meta: ProjectMeta;
  onChangeMeta: (patch: Partial<ProjectMeta>) => void;
  onImportUnits: (units: Unit[], meta?: Partial<ProjectMeta>) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [importMode, setImportMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const q = buildQuote(units);
  const cur = meta.currency || 'NGN';
  const fmt = (n: number) => formatMoney(n, cur);

  const copyBoQ = async () => {
    await Clipboard.setStringAsync(quoteText(units, meta));
    onToast('Itemized BoQ copied to clipboard');
  };

  const copyProjectJson = async () => {
    const payload = JSON.stringify({ version: 2, meta, units }, null, 2);
    await Clipboard.setStringAsync(payload);
    onToast('Project JSON copied to clipboard');
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput.trim());
      const rawUnits = Array.isArray(parsed) ? parsed : parsed.units;
      if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
        onToast('Invalid layout JSON');
        return;
      }
      const nextUnits: Unit[] = rawUnits.map((u: any, idx: number) => ({
        id: typeof u.id === 'string' && u.id ? u.id : 'unit_imp_' + idx,
        type: typeof u.type === 'string' && u.type ? u.type : '20ft',
        label: typeof u.label === 'string' ? u.label : undefined,
        x: Number(u.x) || 0,
        z: Number(u.z) || 0,
        level: Math.max(0, Math.round(Number(u.level) || 0)),
        rot: u.rot === 1 ? 1 : 0,
        color: typeof u.color === 'string' ? u.color : 'charcoal',
        fitout: u.fitout || 'lined',
        roofDeck: Boolean(u.roofDeck),
        stairs: Boolean(u.stairs),
        solar: Boolean(u.solar),
        openings: Array.isArray(u.openings)
          ? u.openings.map((o: any, oIdx: number) => ({
              id: typeof o.id === 'string' && o.id ? o.id : 'op_imp_' + idx + '_' + oIdx,
              typeId: o.typeId,
              kind: o.kind === 'door' || o.kind === 'cutout' ? o.kind : 'window',
              wall: o.wall === 'front' || o.wall === 'back' || o.wall === 'right' ? o.wall : 'left',
              along: Number(o.along) || 1.2,
              w: Number(o.w) || 1.2,
              h: Number(o.h) || 1.0,
              sill: Number(o.sill) || 0,
              label: typeof o.label === 'string' ? o.label : 'Opening',
              rate: Number(o.rate) || 95000,
            }))
          : [],
      }));
      onImportUnits(nextUnits, parsed.meta);
      setImportMode(false);
      setJsonInput('');
      onToast('Project layout loaded');
    } catch {
      onToast('Could not parse JSON');
    }
  };

  const printWebSpec = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    } else {
      copyBoQ();
    }
  };

  const catItems: { key: keyof typeof q.byCategory; label: string; color: string }[] = [
    { key: 'shell', label: 'Shells', color: '#C9F24D' },
    { key: 'fitout', label: 'Fit-Out & MEP', color: '#64D2FF' },
    { key: 'openings', label: 'Openings', color: '#FFD60A' },
    { key: 'structural', label: 'Foundations & Steel', color: '#FF9F0A' },
    { key: 'systems', label: 'Decks, Stairs & Solar', color: '#BF5AF2' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Label>Architectural Estimate & BoQ</Label>
              <Text style={styles.title}>{fmt(q.total)}</Text>
              <Text style={styles.costPerM2}>
                {fmt(q.costPerM2)} / m² · {q.area.toFixed(1)} m² total floor area
              </Text>
            </View>

            <View style={styles.currencyRow}>
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                <Pressable
                  key={code}
                  onPress={() => onChangeMeta({ currency: code })}
                  style={[styles.curBtn, cur === code && styles.curBtnOn]}
                >
                  <Text style={[styles.curText, cur === code && { color: c.bg }]}>{code}</Text>
                </Pressable>
              ))}
              <Pressable onPress={onClose} hitSlop={10} style={{ marginLeft: 8 }}>
                <Icon name="close" size={20} color={c.dim} />
              </Pressable>
            </View>
          </View>

          <View style={styles.stats}>
            <Stat k="Units" v={String(q.units)} />
            <Stat k="Levels" v={String(q.levels)} />
            <Stat k="Floor Area" v={q.area.toFixed(1) + ' m²'} />
            <Stat k="Rate / m²" v={formatCompact(q.costPerM2, cur)} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Label style={{ marginTop: 10, marginBottom: 8 }}>Project Details</Label>
            <View style={styles.metaGrid}>
              <TextInput
                value={meta.name}
                onChangeText={(name) => onChangeMeta({ name })}
                placeholder="Project Name (e.g. Lagos Courtyard House)"
                placeholderTextColor={c.mute}
                style={styles.metaInput}
              />
              <Row style={{ gap: 8 }}>
                <TextInput
                  value={meta.client}
                  onChangeText={(client) => onChangeMeta({ client })}
                  placeholder="Client Name"
                  placeholderTextColor={c.mute}
                  style={[styles.metaInput, { flex: 1 }]}
                />
                <TextInput
                  value={meta.site}
                  onChangeText={(site) => onChangeMeta({ site })}
                  placeholder="Site Location"
                  placeholderTextColor={c.mute}
                  style={[styles.metaInput, { flex: 1 }]}
                />
              </Row>
            </View>

            {q.base > 0 && (
              <>
                <Label style={{ marginTop: 16, marginBottom: 8 }}>Cost Breakdown</Label>
                <View style={styles.barWrap}>
                  {catItems.map((ci) => {
                    const amt = q.byCategory[ci.key];
                    if (amt <= 0) return null;
                    const pct = Math.max(4, Math.round((amt / q.base) * 100));
                    return <View key={ci.key} style={{ flex: pct, backgroundColor: ci.color, height: 7 }} />;
                  })}
                </View>
                <View style={styles.legendWrap}>
                  {catItems.map((ci) => {
                    const amt = q.byCategory[ci.key];
                    if (amt <= 0) return null;
                    return (
                      <View key={ci.key} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: ci.color }]} />
                        <Text style={styles.legendLabel}>
                          {ci.label}: {formatCompact(amt, cur)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Label style={{ marginTop: 16, marginBottom: 4 }}>Itemized Bill of Quantities ({q.lines.length} items)</Label>
            {q.lines.map((l, i) => (
              <View key={i} style={styles.line}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.lineLabel}>{l.label}</Text>
                  <Text style={styles.lineDetail}>{l.detail}</Text>
                </View>
                <Text style={styles.lineAmount}>{fmt(l.amount)}</Text>
              </View>
            ))}

            <View style={styles.totals}>
              <Total k="Materials, Fit-Out & Structural" v={fmt(q.base)} />
              <Total k="Site Assembly & Labour (12%)" v={fmt(q.labour)} />
              <Total k="Subtotal" v={fmt(q.subtotal)} />
              <Total k="VAT (7.5%)" v={fmt(q.vat)} />
              <Total k="Total Estimate" v={fmt(q.total)} big />
            </View>

            {importMode && (
              <View style={styles.importBox}>
                <Label>Paste Project JSON to Load Layout</Label>
                <TextInput
                  value={jsonInput}
                  onChangeText={setJsonInput}
                  placeholder='{"units": [...]}'
                  placeholderTextColor={c.mute}
                  multiline
                  style={styles.jsonInput}
                />
                <Row style={{ gap: 8, marginTop: 8 }}>
                  <Btn compact label="Load JSON" active onPress={handleImportJson} style={{ flex: 1 }} />
                  <Btn compact label="Cancel" onPress={() => setImportMode(false)} />
                </Row>
              </View>
            )}

            <Text style={styles.fine}>
              Indicative architectural budget. Corner castings transfer vertical loads; cantilevered spans and wall cutouts
              wider than 1.8m include RHS steel lintels/columns and require structural engineer sign-off for site soil conditions.
            </Text>
          </ScrollView>

          <View style={styles.footerActions}>
            <Btn icon="copy" label="Copy BoQ" active onPress={copyBoQ} style={{ flex: 1.3 }} />
            <Btn icon="save" label="Export JSON" onPress={copyProjectJson} style={{ flex: 1 }} />
            <Btn
              icon="share"
              label={importMode ? 'Hide Load' : 'Load JSON'}
              onPress={() => setImportMode(!importMode)}
              style={{ flex: 1 }}
            />
            {Platform.OS === 'web' && <Btn compact icon="quote" onPress={printWebSpec} />}
          </View>
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
      <Text style={[styles.totalK, big && { color: c.text, fontWeight: '700' }]}>{k}</Text>
      <Text style={[styles.totalV, big && { fontSize: 20, color: c.lime, fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.panel,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    borderWidth: 1,
    borderColor: c.line,
    padding: 20,
    maxHeight: '90%',
    minHeight: '62%',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: c.text, fontSize: 26, fontWeight: '700', marginTop: 4, letterSpacing: -0.5 },
  costPerM2: { color: c.lime, fontSize: 11.5, marginTop: 2, fontWeight: '500' },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  curBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel2,
  },
  curBtnOn: { backgroundColor: c.lime, borderColor: c.lime },
  curText: { color: c.dim, fontSize: 10.5, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: c.panel2, borderRadius: r.sm, padding: 9 },
  statV: { color: c.text, fontSize: 14, fontWeight: '600' },
  statK: { color: c.mute, fontSize: 9.5, marginTop: 3, letterSpacing: 0.8, textTransform: 'uppercase' },
  metaGrid: { gap: 7 },
  metaInput: {
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    color: c.text,
    fontSize: 12,
  },
  barWrap: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: c.panel2,
  },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendLabel: { color: c.dim, fontSize: 10.5 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  lineLabel: { color: c.text, fontSize: 12.5, fontWeight: '500' },
  lineDetail: { color: c.mute, fontSize: 10.5, marginTop: 2 },
  lineAmount: { color: c.dim, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  totals: { marginTop: 14, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalK: { color: c.dim, fontSize: 12.5 },
  totalV: { color: c.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  importBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: r.sm,
  },
  jsonInput: {
    marginTop: 8,
    minHeight: 72,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    padding: 8,
    color: c.text,
    fontSize: 11,
  },
  fine: { color: c.mute, fontSize: 10.5, lineHeight: 16, marginTop: 16, marginBottom: 8 },
  footerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
