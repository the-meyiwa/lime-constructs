import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Icon } from './Icon';
import {
  LOGISTICS,
  SERVICES,
  UNITS,
  elementsWith,
  type CustomMaterial,
  type ElementOption,
} from '../container-catalog';
import { num, type Quantities } from '../container-quote';
import { fmtArea } from './Inspector';
import { c, r } from '../theme';

const SHELL_CHOICES = ['buy-20', 'new-20', 'client'];
const shellLabel = (o: ElementOption) =>
  ({
    'buy-20': 'Used containers, each at its size (cabins fabricated)',
    'new-20': 'One-trip containers, each at its size (cabins fabricated)',
    client: 'Client supplies the units',
  }[o.id] || o.name);

export function SpecPanel({
  spec,
  services,
  logistics,
  customMaterials,
  quantities,
  unitSystem,
  onChangeSpec,
  onChangeService,
  onChangeLogistics,
}: {
  spec: Record<string, string>;
  services: Record<string, number>;
  logistics: Record<string, number>;
  customMaterials: CustomMaterial[];
  quantities: Quantities;
  unitSystem: 'ft' | 'm';
  onChangeSpec: (elementId: string, optionId: string) => void;
  onChangeService: (serviceId: string, qty: number) => void;
  onChangeLogistics: (logisticsId: string, qty: number) => void;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const [pickerElId, setPickerElId] = useState<string | null>(null);

  const elements = elementsWith(customMaterials);
  const activeElement = elements.find((el) => el.id === pickerElId) || null;

  const statItems: [string, string][] = [
    [fmtArea(quantities.floorArea, unitSystem), 'Floor'],
    [fmtArea(quantities.interiorArea, unitSystem), 'Interior lining'],
    [fmtArea(quantities.exteriorArea, unitSystem), 'External walls'],
    [fmtArea(quantities.roofArea, unitSystem), 'Exposed roof'],
    [fmtArea(quantities.glazingArea || 0, unitSystem), 'Glazing'],
    [fmtArea(quantities.openingArea, unitSystem), 'Openings'],
    [`${num(quantities.studLength, 0)} m`, 'Stud framing'],
    [String(quantities.supports), 'Supports'],
  ];
  if (quantities.stacked) statItems.push([String(quantities.stacked), 'Units stacked']);
  if (quantities.joins) statItems.push([String(quantities.joins), 'Unit joints']);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.cols, isWide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        {/* Left column: Build-up */}
        <View style={[styles.col, isWide && { flex: 1 }]}>
          <Text style={styles.h3}>Build-up</Text>
          <Text style={styles.hint}>
            Choose what each part is made from. Quantities come off the model automatically, across every unit.
          </Text>
          <View style={styles.specList}>
            {elements.map((el) => {
              const opts = el.options.filter((o) => el.id !== 'shell' || SHELL_CHOICES.includes(o.id));
              const chosenId = spec[el.id];
              const chosenOpt = opts.find((o) => o.id === chosenId) || opts[0];
              const displayLabel = el.id === 'shell' && chosenOpt ? shellLabel(chosenOpt) : chosenOpt?.name || chosenId;
              return (
                <View key={el.id} style={styles.specRow}>
                  <Text style={styles.label}>{el.name}</Text>
                  <Pressable
                    onPress={() => setPickerElId(el.id)}
                    style={styles.selectBtn}
                  >
                    <Text style={styles.selectText} numberOfLines={1}>
                      {displayLabel}
                    </Text>
                    <Icon name="chevronDown" size={14} color={c.mute} />
                  </Pressable>
                  {el.help ? <Text style={styles.fieldHelp}>{el.help}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* Right column: Services & Logistics */}
        <View style={[styles.col, isWide && { flex: 1 }]}>
          <Text style={styles.h3}>Services & installations</Text>
          <Text style={styles.hint}>
            Suggested from the floor area. Change any figure to suit the job.
          </Text>
          <View style={styles.qtyList}>
            {SERVICES.map((s) => {
              const auto =
                services[s.id] !== undefined
                  ? services[s.id]
                  : s.autoFrom
                  ? (quantities as Record<string, number>)[s.autoFrom] ?? 0
                  : s.unit === 'area'
                  ? quantities.floorArea
                  : s.auto(quantities.floorArea);
              const valStr = Number(auto).toFixed(s.unit === 'area' || s.unit === 'length' ? 1 : 0);
              return (
                <View key={s.id} style={styles.qtyRow}>
                  <Text style={styles.qtyName}>{s.name}</Text>
                  <TextInput
                    defaultValue={valStr}
                    keyboardType="numeric"
                    onEndEditing={(e) => {
                      const v = parseFloat(e.nativeEvent.text);
                      if (Number.isFinite(v)) onChangeService(s.id, Math.max(0, v));
                    }}
                    style={styles.qtyInput}
                  />
                  <Text style={styles.qtyUnit}>{UNITS[s.unit].label}</Text>
                </View>
              );
            })}
          </View>

          <Text style={[styles.h3, { marginTop: 28 }]}>Logistics</Text>
          <View style={[styles.qtyList, { marginTop: 10 }]}>
            {LOGISTICS.map((l) => {
              const def =
                l.id === 'haulage'
                  ? Math.ceil(quantities.fortyEquivalents || 1)
                  : l.id === 'offload'
                  ? quantities.stacked
                    ? 2
                    : 1
                  : l.qty;
              const val = logistics[l.id] ?? def;
              return (
                <View key={l.id} style={styles.qtyRow}>
                  <Text style={styles.qtyName}>{l.name}</Text>
                  <TextInput
                    defaultValue={String(val)}
                    keyboardType="numeric"
                    onEndEditing={(e) => {
                      const v = parseFloat(e.nativeEvent.text);
                      if (Number.isFinite(v)) onChangeLogistics(l.id, Math.max(0, v));
                    }}
                    style={styles.qtyInput}
                  />
                  <Text style={styles.qtyUnit}>{UNITS[l.unit].label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Takeoff section */}
      <View style={styles.takeoff}>
        <Text style={styles.h3}>Measured off the model</Text>
        <View style={styles.statsGrid}>
          {statItems.map(([v, l], idx) => (
            <View key={'st_' + idx} style={styles.statCard}>
              <Text style={styles.statVal}>{v}</Text>
              <Text style={styles.statLab}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Option Picker Modal */}
      <Modal
        visible={Boolean(activeElement)}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerElId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerElId(null)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{activeElement?.name}</Text>
              <Pressable onPress={() => setPickerElId(null)} hitSlop={8}>
                <Icon name="close" size={16} color={c.dim} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {(activeElement?.options || [])
                .filter((o) => activeElement?.id !== 'shell' || SHELL_CHOICES.includes(o.id))
                .map((o) => {
                  const isSel = spec[activeElement!.id] === o.id;
                  const lbl = activeElement?.id === 'shell' ? shellLabel(o) : o.name;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => {
                        onChangeSpec(activeElement!.id, o.id);
                        setPickerElId(null);
                      }}
                      style={[styles.modalOpt, isSel && styles.modalOptActive]}
                    >
                      <Text style={[styles.modalOptText, isSel && { color: c.lime, fontWeight: '700' }]}>
                        {lbl}
                      </Text>
                      {isSel && <Icon name="check" size={14} color={c.lime} />}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  cols: {
    gap: 28,
  },
  col: {
    width: '100%',
  },
  h3: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    color: c.mute,
    fontSize: 12.5,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  specList: {
    gap: 14,
  },
  specRow: {
    gap: 5,
  },
  label: {
    color: c.dim,
    fontSize: 12.5,
    fontWeight: '500',
  },
  selectBtn: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.panel,
  },
  selectText: {
    flex: 1,
    color: c.text,
    fontSize: 13,
  },
  fieldHelp: {
    color: c.mute,
    fontSize: 11.5,
    lineHeight: 16,
  },
  qtyList: {
    gap: 8,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
  },
  qtyName: {
    flex: 1,
    color: c.text,
    fontSize: 13,
  },
  qtyInput: {
    width: 72,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 13,
    textAlign: 'right',
  },
  qtyUnit: {
    width: 34,
    color: c.mute,
    fontSize: 12,
  },
  takeoff: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statCard: {
    minWidth: 130,
    flexGrow: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    gap: 2,
  },
  statVal: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
  },
  statLab: {
    color: c.mute,
    fontSize: 11.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: c.panel2,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line2,
    padding: 16,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptActive: {
    backgroundColor: c.raised,
  },
  modalOptText: {
    flex: 1,
    color: c.text,
    fontSize: 13.5,
  },
});
