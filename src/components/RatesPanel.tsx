import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from './Icon';
import {
  CUSTOM_TARGETS,
  RATES_REVISED,
  UNITS,
  defaultRateBook,
  type CustomMaterial,
  type RateBook,
  type RateBookEntry,
  type UnitKey,
} from '../container-catalog';
import { money } from '../container-quote';
import { c, r } from '../theme';

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
};

export function RatesPanel({
  currency,
  rates,
  customMaterials,
  onUpdateRate,
  onResetRates,
  onImportRates,
  onAddMaterial,
  onRemoveMaterial,
  onToast,
}: {
  currency: string;
  rates: Partial<RateBook>;
  customMaterials: CustomMaterial[];
  onUpdateRate: (key: string, field: 'rate' | 'labour' | 'wastage', val: number) => void;
  onResetRates: () => void;
  onImportRates: (nextRates: Partial<RateBook>, nextMaterials?: CustomMaterial[]) => void;
  onAddMaterial: (mat: CustomMaterial) => void;
  onRemoveMaterial: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const { width } = useWindowDimensions();
  const isPhone = width < 680;

  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [matName, setMatName] = useState('');
  const [matElement, setMatElement] = useState(CUSTOM_TARGETS[0].id);
  const [matUnit, setMatUnit] = useState<UnitKey>('area');
  const [matCoverage, setMatCoverage] = useState('2.98');
  const [matRate, setMatRate] = useState('0');
  const [matLabour, setMatLabour] = useState('0');
  const [matWastage, setMatWastage] = useState('10');

  const [elementPickerOpen, setElementPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const book = useMemo(() => ({ ...defaultRateBook(customMaterials), ...(rates as RateBook) }), [customMaterials, rates]);
  const q = filter.trim().toLowerCase();

  const groupedRates = useMemo(() => {
    const byGroup = new Map<string, [string, RateBookEntry][]>();
    for (const [key, v] of Object.entries(book)) {
      if (!v) continue;
      if (q && !v.name.toLowerCase().includes(q) && !(v.group || '').toLowerCase().includes(q)) continue;
      const g = v.group || 'Other';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push([key, v]);
    }
    return [...byGroup.entries()];
  }, [book, q]);

  const byElement = useMemo(() => new Map(CUSTOM_TARGETS.map((t) => [t.id, t.name])), []);

  const handleSaveMaterial = () => {
    const name = matName.trim();
    if (!name) return;
    onAddMaterial({
      id: `mine-${Date.now().toString(36)}`,
      element: matElement,
      name,
      unit: matUnit,
      coverage: matUnit === 'sheet' ? parseFloat(matCoverage) || 2.98 : null,
      rate: Math.max(0, parseFloat(matRate) || 0),
      labour: Math.max(0, parseFloat(matLabour) || 0),
      wastage: Math.max(0, parseFloat(matWastage) || 0),
    });
    setMatName('');
    setMatRate('0');
    setMatLabour('0');
    setMatWastage('10');
    setFormOpen(false);
    onToast('Material added');
  };

  const handleExportRates = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      exported: new Date().toISOString(),
      currency,
      materials: customMaterials,
      rates: book,
    };
    const json = JSON.stringify(payload, null, 2);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rate-book-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onToast('Rate book exported');
    } else {
      await Clipboard.setStringAsync(json);
      try {
        await Share.share({ message: json, title: `rate-book-${today}.json` });
      } catch {}
      onToast('Rate book JSON copied to clipboard');
    }
  };

  const handleConfirmImport = () => {
    try {
      const data = JSON.parse(importJsonText);
      const nextRates = data.rates || data;
      const nextMaterials = Array.isArray(data.materials) ? data.materials : undefined;
      onImportRates(nextRates, nextMaterials);
      setImportModalOpen(false);
      setImportJsonText('');
      onToast('Rate book imported');
    } catch {
      onToast('That file could not be read as a rate book.');
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h3}>Rate book</Text>
          <Text style={styles.hint}>
            Seed rates were last reviewed <Text style={{ color: c.text, fontWeight: '600' }}>{fmtDate(RATES_REVISED)}</Text>. Prices move — edit anything here and it is saved on this device. Export the file to back it up or share it.
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable onPress={handleExportRates} style={styles.btnSec}>
            <Text style={styles.btnSecText}>Export rates</Text>
          </Pressable>
          <Pressable onPress={() => setImportModalOpen(true)} style={styles.btnSec}>
            <Text style={styles.btnSecText}>Import rates</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onResetRates();
              onToast('Rates reset to defaults');
            }}
            style={styles.btnSec}
          >
            <Text style={styles.btnSecText}>Reset to defaults</Text>
          </Pressable>
        </View>
      </View>

      {/* Custom Materials */}
      <View style={styles.materialsCard}>
        <View style={styles.matHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h3}>Your own materials</Text>
            <Text style={styles.hint}>
              Anything the catalogue does not carry. Added materials show up in the specification dropdowns and price like any other.
            </Text>
          </View>
          <Pressable onPress={() => setFormOpen((prev) => !prev)} style={styles.btnPri}>
            <Text style={styles.btnPriText}>Add a material</Text>
          </Pressable>
        </View>

        {formOpen && (
          <View style={styles.matForm}>
            <View style={styles.matGrid}>
              <View style={styles.field}>
                <Text style={styles.label}>What is it called?</Text>
                <TextInput
                  value={matName}
                  onChangeText={setMatName}
                  placeholder="e.g. 18 mm birch ply"
                  placeholderTextColor={c.mute}
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Where does it go?</Text>
                <Pressable onPress={() => setElementPickerOpen(true)} style={styles.selectBtn}>
                  <Text style={styles.selectText}>{byElement.get(matElement) || matElement}</Text>
                  <Icon name="chevronDown" size={14} color={c.mute} />
                </Pressable>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sold by</Text>
                <Pressable onPress={() => setUnitPickerOpen(true)} style={styles.selectBtn}>
                  <Text style={styles.selectText}>{UNITS[matUnit]?.label || matUnit}</Text>
                  <Icon name="chevronDown" size={14} color={c.mute} />
                </Pressable>
              </View>
              {matUnit === 'sheet' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Covers (m² per sheet)</Text>
                  <TextInput
                    value={matCoverage}
                    onChangeText={setMatCoverage}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              )}
              <View style={styles.field}>
                <Text style={styles.label}>Material cost per unit</Text>
                <TextInput
                  value={matRate}
                  onChangeText={setMatRate}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Labour per unit</Text>
                <TextInput
                  value={matLabour}
                  onChangeText={setMatLabour}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Wastage %</Text>
                <TextInput
                  value={matWastage}
                  onChangeText={setMatWastage}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.controls}>
              <Pressable onPress={handleSaveMaterial} style={styles.btnPri}>
                <Text style={styles.btnPriText}>Save material</Text>
              </Pressable>
              <Pressable onPress={() => setFormOpen(false)} style={styles.btnSec}>
                <Text style={styles.btnSecText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.matList}>
          {customMaterials.length === 0 ? (
            <Text style={styles.empty}>No materials of your own yet.</Text>
          ) : (
            customMaterials.map((m) => (
              <View key={m.id} style={styles.matRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matRowName}>{m.name}</Text>
                  <Text style={styles.matRowMeta}>
                    {byElement.get(m.element) ?? m.element} · {money(m.rate, currency)} + {money(m.labour, currency)} labour per {UNITS[m.unit]?.label ?? m.unit}
                    {m.wastage ? ` · ${m.wastage}% wastage` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => onRemoveMaterial(m.id)} hitSlop={8}>
                  <Icon name="close" size={15} color={c.mute} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Catalogue Rates */}
      <Text style={[styles.h3, { marginTop: 28 }]}>Catalogue rates</Text>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filter rates…"
        placeholderTextColor={c.mute}
        style={[styles.input, { maxWidth: 340, marginVertical: 12 }]}
      />

      {groupedRates.length === 0 ? (
        <Text style={styles.empty}>Nothing matches that.</Text>
      ) : (
        <View style={styles.groupsWrap}>
          {groupedRates.map(([group, entries]) => (
            <View key={group} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{group}</Text>
                <Text style={styles.groupCount}>{entries.length} items</Text>
              </View>

              {!isPhone && (
                <View style={styles.rateHead}>
                  <Text style={[styles.th, { flex: 2.5 }]}>Item</Text>
                  <Text style={[styles.th, { width: 52 }]}>Unit</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Material rate ({currency})</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Labour rate ({currency})</Text>
                  <Text style={[styles.th, { width: 72, textAlign: 'right' }]}>Waste %</Text>
                </View>
              )}

              {entries.map(([key, v]) => (
                <View key={key} style={isPhone ? styles.phoneRateRow : styles.rateRow}>
                  {isPhone ? (
                    <>
                      <View style={styles.phoneRateTop}>
                        <Text style={styles.itemName}>{v.name}</Text>
                        <Text style={styles.unitTag}>{UNITS[v.unit]?.label ?? v.unit}</Text>
                      </View>
                      <View style={styles.phoneRateInputs}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniCaption}>Material ({currency})</Text>
                          <TextInput
                            defaultValue={String(v.rate)}
                            keyboardType="numeric"
                            onEndEditing={(e) => {
                              const n = parseFloat(e.nativeEvent.text);
                              if (Number.isFinite(n)) onUpdateRate(key, 'rate', Math.max(0, n));
                            }}
                            style={styles.rateInput}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniCaption}>Labour ({currency})</Text>
                          <TextInput
                            defaultValue={String(v.labour)}
                            keyboardType="numeric"
                            onEndEditing={(e) => {
                              const n = parseFloat(e.nativeEvent.text);
                              if (Number.isFinite(n)) onUpdateRate(key, 'labour', Math.max(0, n));
                            }}
                            style={styles.rateInput}
                          />
                        </View>
                        <View style={{ width: 68 }}>
                          <Text style={styles.miniCaption}>Waste %</Text>
                          <TextInput
                            defaultValue={String(v.wastage)}
                            keyboardType="numeric"
                            onEndEditing={(e) => {
                              const n = parseFloat(e.nativeEvent.text);
                              if (Number.isFinite(n)) onUpdateRate(key, 'wastage', Math.max(0, n));
                            }}
                            style={styles.rateInput}
                          />
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.itemName, { flex: 2.5 }]} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={[styles.unitTag, { width: 52 }]}>{UNITS[v.unit]?.label ?? v.unit}</Text>
                      <TextInput
                        defaultValue={String(v.rate)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const n = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(n)) onUpdateRate(key, 'rate', Math.max(0, n));
                        }}
                        style={[styles.rateInput, { width: 130 }]}
                      />
                      <TextInput
                        defaultValue={String(v.labour)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const n = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(n)) onUpdateRate(key, 'labour', Math.max(0, n));
                        }}
                        style={[styles.rateInput, { width: 130 }]}
                      />
                      <TextInput
                        defaultValue={String(v.wastage)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const n = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(n)) onUpdateRate(key, 'wastage', Math.max(0, n));
                        }}
                        style={[styles.rateInput, { width: 72 }]}
                      />
                    </>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Element Picker Modal */}
      <Modal
        visible={elementPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setElementPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setElementPickerOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Where does it go?</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {CUSTOM_TARGETS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setMatElement(t.id);
                    setElementPickerOpen(false);
                  }}
                  style={[styles.modalOpt, t.id === matElement && styles.modalOptActive]}
                >
                  <Text style={[styles.modalOptText, t.id === matElement && { color: c.lime, fontWeight: '700' }]}>
                    {t.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Unit Picker Modal */}
      <Modal
        visible={unitPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setUnitPickerOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sold by</Text>
            {(Object.entries(UNITS) as [UnitKey, { label: string }][]).map(([k, v]) => (
              <Pressable
                key={k}
                onPress={() => {
                  setMatUnit(k);
                  setUnitPickerOpen(false);
                }}
                style={[styles.modalOpt, k === matUnit && styles.modalOptActive]}
              >
                <Text style={[styles.modalOptText, k === matUnit && { color: c.lime, fontWeight: '700' }]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Import Rates Modal */}
      <Modal
        visible={importModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setImportModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setImportModalOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import rate book JSON</Text>
            <TextInput
              value={importJsonText}
              onChangeText={setImportJsonText}
              placeholder="Paste exported rate-book JSON here…"
              placeholderTextColor={c.mute}
              multiline
              style={[styles.input, { height: 140, textAlignVertical: 'top', paddingTop: 10, marginVertical: 10 }]}
            />
            <View style={styles.controls}>
              <Pressable onPress={handleConfirmImport} style={styles.btnPri}>
                <Text style={styles.btnPriText}>Import</Text>
              </Pressable>
              <Pressable onPress={() => setImportModalOpen(false)} style={styles.btnSec}>
                <Text style={styles.btnSecText}>Cancel</Text>
              </Pressable>
            </View>
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
    paddingBottom: 40,
  },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
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
    lineHeight: 18,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btnSec: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecText: {
    color: c.text,
    fontSize: 12.5,
    fontWeight: '500',
  },
  btnPri: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: c.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPriText: {
    color: c.bg,
    fontSize: 12.5,
    fontWeight: '700',
  },
  materialsCard: {
    padding: 16,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    gap: 14,
  },
  matHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  matForm: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
    gap: 14,
  },
  matGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    minWidth: 170,
    flex: 1,
    gap: 4,
  },
  label: {
    color: c.dim,
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 13,
  },
  selectBtn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
  },
  selectText: {
    color: c.text,
    fontSize: 13,
    flex: 1,
  },
  matList: {
    gap: 8,
  },
  matRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
  },
  matRowName: {
    color: c.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  matRowMeta: {
    color: c.mute,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    color: c.mute,
    fontSize: 12.5,
  },
  groupsWrap: {
    gap: 16,
  },
  groupCard: {
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
    padding: 14,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  groupTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
  },
  groupCount: {
    color: c.mute,
    fontSize: 12,
  },
  rateHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  th: {
    color: c.mute,
    fontSize: 11.5,
    fontWeight: '600',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  phoneRateRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    gap: 8,
  },
  phoneRateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phoneRateInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  miniCaption: {
    color: c.mute,
    fontSize: 11,
    marginBottom: 2,
  },
  itemName: {
    color: c.text,
    fontSize: 13,
    flex: 1,
  },
  unitTag: {
    color: c.mute,
    fontSize: 12,
  },
  rateInput: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 12.5,
    textAlign: 'right',
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
    maxWidth: 420,
    backgroundColor: c.panel2,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line2,
    padding: 16,
  },
  modalTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalOpt: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  modalOptActive: {
    backgroundColor: c.raised,
  },
  modalOptText: {
    color: c.text,
    fontSize: 13.5,
  },
});
