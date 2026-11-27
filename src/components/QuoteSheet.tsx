import React, { useState } from 'react';
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
import { COMMERCIAL_DEFAULTS, UNITS } from '../container-catalog';
import {
  CURRENCIES,
  groupLines,
  money,
  num,
  type CommercialSettings,
  type CurrencyCode,
  type LineOverride,
  type Quantities,
  type QuoteLine,
} from '../container-quote';
import { UNIT_TYPE, type UnitModel } from '../container-library';
import { fmtArea } from './Inspector';
import { c, r } from '../theme';

export type CompanyMeta = {
  name: string;
  address: string;
  phone: string;
  email: string;
  regNo: string;
  client: string;
  clientAddress: string;
  quoteNo: string;
  date: string;
  scope: string;
  terms: string;
};

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return iso;
  const [y, m, d] = parts;
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

export function QuoteSheet({
  buildName,
  units,
  unitSystem,
  currency,
  company,
  commercial,
  lines,
  totals,
  quantities,
  onChangeCurrency,
  onChangeCompany,
  onChangeCommercial,
  onOverrideLine,
  onRemoveLine,
  onAddCustomLine,
  onToast,
}: {
  buildName: string;
  units: UnitModel[];
  unitSystem: 'ft' | 'm';
  currency: CurrencyCode;
  company: CompanyMeta;
  commercial: CommercialSettings;
  lines: QuoteLine[];
  totals: {
    material: number;
    labour: number;
    prime: number;
    overhead: number;
    contingency: number;
    profit: number;
    discount: number;
    netTotal: number;
    vat: number;
    grandTotal: number;
  };
  quantities: Quantities;
  onChangeCurrency: (c: CurrencyCode) => void;
  onChangeCompany: (patch: Partial<CompanyMeta>) => void;
  onChangeCommercial: (patch: Partial<CommercialSettings>) => void;
  onOverrideLine: (lineId: string, patch: Partial<LineOverride>) => void;
  onRemoveLine: (lineId: string) => void;
  onAddCustomLine: () => void;
  onToast: (msg: string) => void;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const isPhone = width < 680;
  const [currencyModal, setCurrencyModal] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [printPreviewModal, setPrintPreviewModal] = useState(false);

  const groups = groupLines(lines);
  const area = quantities.floorArea || 0;

  const handleDownloadCsv = async () => {
    const header = [
      'Group',
      'Material',
      'Unit',
      'Quantity',
      'Wastage %',
      'Charged qty',
      `Rate (${currency})`,
      `Material cost (${currency})`,
      `Labour (${currency})`,
      `Total (${currency})`,
    ];
    const rows = [
      ...lines.map((l) => [
        l.group,
        l.name,
        UNITS[l.unit]?.label ?? l.unit,
        l.qty.toFixed(2),
        String(l.wastage),
        l.chargeQty.toFixed(2),
        l.rate.toFixed(2),
        l.materialCost.toFixed(2),
        l.labourCost.toFixed(2),
        l.total.toFixed(2),
      ]),
      ['', 'PRIME COST', '', '', '', '', '', totals.material.toFixed(2), totals.labour.toFixed(2), totals.prime.toFixed(2)],
      ['', 'QUOTED PRICE (incl. VAT)', '', '', '', '', '', '', '', totals.grandTotal.toFixed(2)],
    ];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${company.quoteNo || 'container'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onToast('CSV downloaded');
    } else {
      await Clipboard.setStringAsync(csv);
      try {
        await Share.share({ message: csv, title: `quote-${company.quoteNo || 'container'}.csv` });
      } catch {}
      onToast('CSV copied to clipboard');
    }
  };

  const handlePrintQuote = async () => {
    setPrintPreviewModal(true);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Top Meta Fields */}
      <View style={styles.metaGrid}>
        <View style={styles.metaField}>
          <Text style={styles.label}>Currency</Text>
          <Pressable onPress={() => setCurrencyModal(true)} style={styles.selectBtn}>
            <Text style={styles.selectText} numberOfLines={1}>
              {CURRENCIES.find((c) => c.code === currency)?.label || currency}
            </Text>
            <Icon name="chevronDown" size={14} color={c.mute} />
          </Pressable>
        </View>
        <View style={styles.metaField}>
          <Text style={styles.label}>Quote number</Text>
          <TextInput
            value={company.quoteNo}
            onChangeText={(quoteNo) => onChangeCompany({ quoteNo })}
            style={styles.input}
          />
        </View>
        <View style={styles.metaField}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            value={company.date}
            onChangeText={(date) => onChangeCompany({ date })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.mute}
            style={styles.input}
          />
        </View>
        <View style={styles.metaField}>
          <Text style={styles.label}>Client</Text>
          <TextInput
            value={company.client}
            onChangeText={(client) => onChangeCompany({ client })}
            placeholder="Client name"
            placeholderTextColor={c.mute}
            style={styles.input}
          />
        </View>
      </View>

      {/* Grouped Lines */}
      {lines.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Nothing to price yet. Set a specification on the previous tab.
          </Text>
        </View>
      ) : (
        <View style={styles.groupsWrap}>
          {groups.map((group) => (
            <View key={group.name} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{group.name}</Text>
                <Text style={styles.groupSub}>{money(group.subtotal, currency)}</Text>
              </View>

              {!isPhone && (
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2.5 }]}>Material</Text>
                  <Text style={[styles.th, { width: 48 }]}>Unit</Text>
                  <Text style={[styles.th, { width: 64, textAlign: 'right' }]}>Qty</Text>
                  <Text style={[styles.th, { width: 58, textAlign: 'right' }]}>Waste</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Material</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Labour</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Total</Text>
                  <View style={{ width: 28 }} />
                </View>
              )}

              {group.items.map((l) => (
                <View key={l.id} style={styles.lineWrap}>
                  {isPhone ? (
                    <View style={styles.phoneLine}>
                      <View style={styles.phoneLineTop}>
                        <Text style={styles.lineName}>{l.name}</Text>
                        <Pressable onPress={() => onRemoveLine(l.id)} hitSlop={8}>
                          <Icon name="close" size={14} color={c.mute} />
                        </Pressable>
                      </View>
                      <View style={styles.phoneLineMid}>
                        <Text style={styles.unitTag}>{UNITS[l.unit]?.label ?? l.unit}</Text>
                        <TextInput
                          defaultValue={l.qty.toFixed(l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)}
                          keyboardType="numeric"
                          onEndEditing={(e) => {
                            const v = parseFloat(e.nativeEvent.text);
                            if (Number.isFinite(v)) onOverrideLine(l.id, { qty: Math.max(0, v) });
                          }}
                          style={styles.smallInput}
                        />
                        <Text style={styles.miniLabel}>Waste %</Text>
                        <TextInput
                          defaultValue={String(l.wastage)}
                          keyboardType="numeric"
                          onEndEditing={(e) => {
                            const v = parseFloat(e.nativeEvent.text);
                            if (Number.isFinite(v)) onOverrideLine(l.id, { wastage: Math.max(0, v) });
                          }}
                          style={styles.smallInput}
                        />
                      </View>
                      <View style={styles.phoneLineCosts}>
                        <View>
                          <Text style={styles.costCaption}>Materials</Text>
                          <Text style={styles.costValue}>{money(l.materialCost, currency)}</Text>
                        </View>
                        <View>
                          <Text style={styles.costCaption}>Labour</Text>
                          <Text style={styles.costValue}>{money(l.labourCost, currency)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.costCaption}>Total</Text>
                          <Text style={styles.costTotal}>{money(l.total, currency)}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.desktopLine}>
                      <Text style={[styles.lineName, { flex: 2.5 }]} numberOfLines={1}>
                        {l.name}
                      </Text>
                      <Text style={[styles.unitTag, { width: 48 }]}>{UNITS[l.unit]?.label ?? l.unit}</Text>
                      <TextInput
                        defaultValue={l.qty.toFixed(l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const v = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(v)) onOverrideLine(l.id, { qty: Math.max(0, v) });
                        }}
                        style={[styles.smallInput, { width: 64 }]}
                      />
                      <TextInput
                        defaultValue={String(l.wastage)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const v = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(v)) onOverrideLine(l.id, { wastage: Math.max(0, v) });
                        }}
                        style={[styles.smallInput, { width: 58 }]}
                      />
                      <Text style={[styles.cellText, { flex: 1 }]}>{money(l.materialCost, currency)}</Text>
                      <Text style={[styles.cellText, { flex: 1 }]}>{money(l.labourCost, currency)}</Text>
                      <Text style={[styles.cellTotal, { flex: 1 }]}>{money(l.total, currency)}</Text>
                      <Pressable onPress={() => onRemoveLine(l.id)} style={{ width: 28, alignItems: 'flex-end' }}>
                        <Icon name="close" size={14} color={c.mute} />
                      </Pressable>
                    </View>
                  )}

                  {/* Sub-row: inline rate & labour overrides */}
                  <View style={styles.ratesSubRow}>
                    <View style={styles.rateMini}>
                      <Text style={styles.miniLabel}>rate</Text>
                      <TextInput
                        defaultValue={String(l.rate)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const v = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(v)) onOverrideLine(l.id, { rate: Math.max(0, v) });
                        }}
                        style={styles.miniInput}
                      />
                    </View>
                    <View style={styles.rateMini}>
                      <Text style={styles.miniLabel}>labour</Text>
                      <TextInput
                        defaultValue={String(l.labour)}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          const v = parseFloat(e.nativeEvent.text);
                          if (Number.isFinite(v)) onOverrideLine(l.id, { labour: Math.max(0, v) });
                        }}
                        style={styles.miniInput}
                      />
                    </View>
                    {l.unit === 'sheet' && l.coverage ? (
                      <Text style={styles.sheetNote}>1 sheet ≈ {l.coverage.toFixed(2)} m²</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Bottom section: Mark-ups + Quote Summary */}
      <View style={[styles.bottomRow, isWide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={[styles.commCol, isWide && { flex: 1 }]}>
          <Text style={styles.h3}>Mark-ups</Text>
          <View style={styles.commGrid}>
            {(
              [
                ['Overheads %', 'overheadPct', commercial.overheadPct],
                ['Contingency %', 'contingencyPct', commercial.contingencyPct],
                ['Profit %', 'profitPct', commercial.profitPct],
                ['VAT %', 'vatPct', commercial.vatPct],
                ['Discount', 'discount', commercial.discount],
              ] as const
            ).map(([label, key, val]) => (
              <View key={key} style={styles.commField}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  defaultValue={String(val)}
                  keyboardType="numeric"
                  onEndEditing={(e) => {
                    const v = parseFloat(e.nativeEvent.text);
                    if (Number.isFinite(v)) onChangeCommercial({ [key]: Math.max(0, v) });
                  }}
                  style={styles.input}
                />
              </View>
            ))}
          </View>
          <View style={styles.btnRow}>
            <Pressable onPress={onAddCustomLine} style={styles.btnSec}>
              <Text style={styles.btnSecText}>Add a line</Text>
            </Pressable>
            <Pressable onPress={handleDownloadCsv} style={styles.btnSec}>
              <Text style={styles.btnSecText}>Download CSV</Text>
            </Pressable>
            <Pressable onPress={handlePrintQuote} style={styles.btnPri}>
              <Text style={styles.btnPriText}>Print / save as PDF</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.totalsCol, isWide && { flex: 1 }]}>
          <Text style={styles.h3}>Quote summary</Text>
          <View style={styles.totalRows}>
            <View style={styles.totRow}>
              <Text style={styles.totLab}>Materials</Text>
              <Text style={styles.totVal}>{money(totals.material, currency)}</Text>
            </View>
            <View style={styles.totRow}>
              <Text style={styles.totLab}>Labour</Text>
              <Text style={styles.totVal}>{money(totals.labour, currency)}</Text>
            </View>
            <View style={[styles.totRow, styles.totSub]}>
              <Text style={styles.totSubLab}>Prime cost</Text>
              <Text style={styles.totSubVal}>{money(totals.prime, currency)}</Text>
            </View>
            <View style={styles.totRow}>
              <Text style={styles.totLab}>Overheads</Text>
              <Text style={styles.totVal}>{money(totals.overhead, currency)}</Text>
            </View>
            <View style={styles.totRow}>
              <Text style={styles.totLab}>Contingency</Text>
              <Text style={styles.totVal}>{money(totals.contingency, currency)}</Text>
            </View>
            <View style={styles.totRow}>
              <Text style={styles.totLab}>Profit</Text>
              <Text style={styles.totVal}>{money(totals.profit, currency)}</Text>
            </View>
            {totals.discount > 0 ? (
              <View style={styles.totRow}>
                <Text style={styles.totLab}>Discount</Text>
                <Text style={styles.totVal}>−{money(totals.discount, currency)}</Text>
              </View>
            ) : null}
            <View style={[styles.totRow, styles.totSub]}>
              <Text style={styles.totSubLab}>Net total</Text>
              <Text style={styles.totSubVal}>{money(totals.netTotal, currency)}</Text>
            </View>
            <View style={styles.totRow}>
              <Text style={styles.totLab}>VAT</Text>
              <Text style={styles.totVal}>{money(totals.vat, currency)}</Text>
            </View>
            <View style={[styles.totRow, styles.totGrand]}>
              <Text style={styles.totGrandLab}>Quoted price</Text>
              <Text style={styles.totGrandVal}>{money(totals.grandTotal, currency)}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricStrong}>
                {money(area > 0 ? totals.grandTotal / area : 0, currency)}
              </Text>
              <Text style={styles.metricSpan}>per m² of floor</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricStrong}>{lines.length}</Text>
              <Text style={styles.metricSpan}>priced lines</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricStrong}>
                {totals.prime > 0 ? ((totals.labour / totals.prime) * 100).toFixed(0) : 0}%
              </Text>
              <Text style={styles.metricSpan}>is labour</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Company & terms collapsible */}
      <View style={styles.detailsBox}>
        <Pressable onPress={() => setCompanyOpen((prev) => !prev)} style={styles.detailsSummary}>
          <Text style={styles.detailsTitle}>Company & terms shown on the printed quote</Text>
          <Icon name={companyOpen ? 'chevronDown' : 'chevron'} size={14} color={c.mute} />
        </Pressable>
        {companyOpen && (
          <View style={styles.companyGrid}>
            <View style={styles.metaField}>
              <Text style={styles.label}>Your company</Text>
              <TextInput
                value={company.name}
                onChangeText={(name) => onChangeCompany({ name })}
                style={styles.input}
              />
            </View>
            <View style={styles.metaField}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                value={company.phone}
                onChangeText={(phone) => onChangeCompany({ phone })}
                style={styles.input}
              />
            </View>
            <View style={styles.metaField}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={company.email}
                onChangeText={(email) => onChangeCompany({ email })}
                style={styles.input}
              />
            </View>
            <View style={styles.metaField}>
              <Text style={styles.label}>RC / VAT number</Text>
              <TextInput
                value={company.regNo}
                onChangeText={(regNo) => onChangeCompany({ regNo })}
                style={styles.input}
              />
            </View>
            <View style={styles.wideField}>
              <Text style={styles.label}>Your address</Text>
              <TextInput
                value={company.address}
                onChangeText={(address) => onChangeCompany({ address })}
                style={styles.input}
              />
            </View>
            <View style={styles.wideField}>
              <Text style={styles.label}>Client address</Text>
              <TextInput
                value={company.clientAddress}
                onChangeText={(clientAddress) => onChangeCompany({ clientAddress })}
                style={styles.input}
              />
            </View>
            <View style={styles.wideField}>
              <Text style={styles.label}>Scope of works</Text>
              <TextInput
                value={company.scope}
                onChangeText={(scope) => onChangeCompany({ scope })}
                multiline
                numberOfLines={2}
                style={[styles.input, { height: 58, textAlignVertical: 'top', paddingTop: 8 }]}
              />
            </View>
            <View style={styles.wideField}>
              <Text style={styles.label}>Terms</Text>
              <TextInput
                value={company.terms}
                onChangeText={(terms) => onChangeCompany({ terms })}
                multiline
                numberOfLines={4}
                style={[styles.input, { height: 92, textAlignVertical: 'top', paddingTop: 8 }]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Currency Picker Modal */}
      <Modal
        visible={currencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCurrencyModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Currency</Text>
            {CURRENCIES.map((cur) => (
              <Pressable
                key={cur.code}
                onPress={() => {
                  onChangeCurrency(cur.code);
                  setCurrencyModal(false);
                }}
                style={[styles.modalOpt, cur.code === currency && styles.modalOptActive]}
              >
                <Text style={[styles.modalOptText, cur.code === currency && { color: c.lime, fontWeight: '700' }]}>
                  {cur.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Printable Quotation Preview Modal */}
      <Modal
        visible={printPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPrintPreviewModal(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetTopBar}>
              <Text style={styles.sheetTopTitle}>Quotation Sheet</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Platform.OS === 'web' && (
                  <Pressable
                    onPress={() => {
                      if (typeof window !== 'undefined' && window.print) window.print();
                    }}
                    style={styles.btnPri}
                  >
                    <Text style={styles.btnPriText}>Print / Save PDF</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setPrintPreviewModal(false)} style={styles.btnSec}>
                  <Text style={styles.btnSecText}>Close</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView style={styles.printDoc} contentContainerStyle={{ padding: 24 }}>
              <View style={styles.docHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docH1}>{company.name || 'Quotation'}</Text>
                  {company.address ? <Text style={styles.docSub}>{company.address}</Text> : null}
                  <Text style={styles.docSub}>
                    {[company.phone, company.email, company.regNo && `RC ${company.regNo}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.docBadge}>
                  <Text style={styles.docBadgeLabel}>Quotation</Text>
                  <Text style={styles.docBadgeNo}>{company.quoteNo}</Text>
                  <Text style={styles.docBadgeDate}>{fmtDate(company.date)}</Text>
                </View>
              </View>

              <View style={styles.docParties}>
                <View style={styles.docPartyCol}>
                  <Text style={styles.docPartyH}>Prepared for</Text>
                  <Text style={styles.docPartyText}>{company.client || '—'}</Text>
                  {company.clientAddress ? <Text style={styles.docPartyText}>{company.clientAddress}</Text> : null}
                </View>
                <View style={styles.docPartyCol}>
                  <Text style={styles.docPartyH}>{buildName}</Text>
                  <Text style={styles.docPartyText}>
                    {units
                      .map((x) => `${x.name || UNIT_TYPE[x.preset]?.name || 'Unit'}${x.level ? ` (level ${x.level})` : ''}`)
                      .join(', ')}
                  </Text>
                  <Text style={styles.docPartyText}>{fmtArea(quantities.floorArea, unitSystem)} floor area</Text>
                </View>
                <View style={styles.docPartyCol}>
                  <Text style={styles.docPartyH}>Validity</Text>
                  <Text style={styles.docPartyText}>
                    {COMMERCIAL_DEFAULTS.validityDays} days from {fmtDate(company.date)}
                  </Text>
                </View>
              </View>

              {company.scope ? (
                <View style={styles.docSec}>
                  <Text style={styles.docPartyH}>Scope of works</Text>
                  <Text style={styles.docPartyText}>{company.scope}</Text>
                </View>
              ) : null}

              {groups.map((g) => (
                <View key={g.name} style={styles.docGroup}>
                  <Text style={styles.docGroupTitle}>{g.name}</Text>
                  {g.items.map((l) => (
                    <View key={l.id} style={styles.docLine}>
                      <Text style={[styles.docLineText, { flex: 2 }]}>{l.name}</Text>
                      <Text style={[styles.docLineText, { width: 55, textAlign: 'right' }]}>
                        {num(l.qty, l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)} {UNITS[l.unit]?.label ?? l.unit}
                      </Text>
                      <Text style={[styles.docLineText, { width: 100, textAlign: 'right', fontWeight: '600' }]}>
                        {money(l.total, currency)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.docSubtotal}>
                    <Text style={styles.docSubtotalText}>{g.name} subtotal</Text>
                    <Text style={styles.docSubtotalText}>{money(g.subtotal, currency)}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.docTotals}>
                <View style={styles.docTotRow}>
                  <Text style={styles.docLineText}>Materials</Text>
                  <Text style={styles.docLineText}>{money(totals.material, currency)}</Text>
                </View>
                <View style={styles.docTotRow}>
                  <Text style={styles.docLineText}>Labour</Text>
                  <Text style={styles.docLineText}>{money(totals.labour, currency)}</Text>
                </View>
                <View style={[styles.docTotRow, styles.docTotDivider]}>
                  <Text style={[styles.docLineText, { fontWeight: '700' }]}>Prime cost</Text>
                  <Text style={[styles.docLineText, { fontWeight: '700' }]}>{money(totals.prime, currency)}</Text>
                </View>
                <View style={styles.docTotRow}>
                  <Text style={styles.docLineText}>Overheads & contingency</Text>
                  <Text style={styles.docLineText}>{money(totals.overhead + totals.contingency, currency)}</Text>
                </View>
                <View style={styles.docTotRow}>
                  <Text style={styles.docLineText}>Profit</Text>
                  <Text style={styles.docLineText}>{money(totals.profit, currency)}</Text>
                </View>
                {totals.discount > 0 ? (
                  <View style={styles.docTotRow}>
                    <Text style={styles.docLineText}>Discount</Text>
                    <Text style={styles.docLineText}>−{money(totals.discount, currency)}</Text>
                  </View>
                ) : null}
                <View style={[styles.docTotRow, styles.docTotDivider]}>
                  <Text style={[styles.docLineText, { fontWeight: '700' }]}>Net total</Text>
                  <Text style={[styles.docLineText, { fontWeight: '700' }]}>{money(totals.netTotal, currency)}</Text>
                </View>
                <View style={styles.docTotRow}>
                  <Text style={styles.docLineText}>VAT @ {num(commercial.vatPct, 1)}%</Text>
                  <Text style={styles.docLineText}>{money(totals.vat, currency)}</Text>
                </View>
                <View style={[styles.docTotRow, styles.docTotGrand]}>
                  <Text style={styles.docGrandText}>Total quoted price</Text>
                  <Text style={styles.docGrandText}>{money(totals.grandTotal, currency)}</Text>
                </View>
              </View>

              {company.terms ? (
                <View style={styles.docSec}>
                  <Text style={styles.docPartyH}>Terms</Text>
                  <Text style={styles.docPartyText}>{company.terms}</Text>
                </View>
              ) : null}

              <Text style={styles.docFoot}>
                Quantities measured from the modelled units. Material rates include a wastage allowance; labour is charged on net measured quantity. Structural items are preliminary and subject to an engineer&apos;s design. Prepared with Lime Constructs.
              </Text>
            </ScrollView>
          </View>
        </View>
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
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metaField: {
    minWidth: 160,
    flex: 1,
    gap: 4,
  },
  wideField: {
    width: '100%',
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
    backgroundColor: c.panel,
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
    backgroundColor: c.panel,
  },
  selectText: {
    color: c.text,
    fontSize: 13,
    flex: 1,
  },
  emptyBox: {
    padding: 20,
    borderRadius: r.md,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    marginBottom: 20,
  },
  emptyText: {
    color: c.mute,
    fontSize: 13,
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
  groupSub: {
    color: c.lime,
    fontSize: 14,
    fontWeight: '700',
  },
  tableHead: {
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
  lineWrap: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    gap: 6,
  },
  desktopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneLine: {
    gap: 8,
  },
  phoneLineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phoneLineMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneLineCosts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  costCaption: {
    color: c.mute,
    fontSize: 11,
  },
  costValue: {
    color: c.dim,
    fontSize: 12.5,
  },
  costTotal: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
  },
  lineName: {
    color: c.text,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  unitTag: {
    color: c.mute,
    fontSize: 12,
  },
  smallInput: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 12.5,
    textAlign: 'right',
    minWidth: 56,
  },
  cellText: {
    color: c.dim,
    fontSize: 12.5,
    textAlign: 'right',
  },
  cellTotal: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  ratesSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 2,
  },
  rateMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniLabel: {
    color: c.mute,
    fontSize: 11.5,
  },
  miniInput: {
    width: 92,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.bg,
    color: c.dim,
    fontSize: 12,
    textAlign: 'right',
  },
  sheetNote: {
    color: c.mute,
    fontSize: 11.5,
  },
  bottomRow: {
    marginTop: 24,
    gap: 24,
  },
  commCol: {
    width: '100%',
  },
  totalsCol: {
    width: '100%',
    padding: 16,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
  },
  h3: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  commGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  commField: {
    minWidth: 120,
    flex: 1,
    gap: 4,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  btnSec: {
    height: 36,
    paddingHorizontal: 14,
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
  totalRows: {
    gap: 8,
  },
  totRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totLab: {
    color: c.dim,
    fontSize: 13,
  },
  totVal: {
    color: c.text,
    fontSize: 13,
  },
  totSub: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  totSubLab: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  totSubVal: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  totGrand: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.line2,
  },
  totGrandLab: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
  },
  totGrandVal: {
    color: c.lime,
    fontSize: 16,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  metricBox: {
    flex: 1,
    gap: 2,
  },
  metricStrong: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
  },
  metricSpan: {
    color: c.mute,
    fontSize: 11,
  },
  detailsBox: {
    marginTop: 24,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.panel,
  },
  detailsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  detailsTitle: {
    color: c.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  companyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 14,
    paddingTop: 0,
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
    maxWidth: 360,
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 16,
    justifyContent: 'center',
  },
  sheetCard: {
    flex: 1,
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: r.md,
    overflow: 'hidden',
  },
  sheetTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.panel2,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  sheetTopTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
  },
  printDoc: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  docHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#111',
    paddingBottom: 14,
    marginBottom: 16,
  },
  docH1: {
    color: '#111',
    fontSize: 22,
    fontWeight: '700',
  },
  docSub: {
    color: '#555',
    fontSize: 12,
    marginTop: 2,
  },
  docBadge: {
    alignItems: 'flex-end',
  },
  docBadgeLabel: {
    color: '#666',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  docBadgeNo: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  docBadgeDate: {
    color: '#555',
    fontSize: 12,
  },
  docParties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  docPartyCol: {
    flex: 1,
    minWidth: 150,
  },
  docPartyH: {
    color: '#111',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  docPartyText: {
    color: '#333',
    fontSize: 12,
    lineHeight: 17,
  },
  docSec: {
    marginVertical: 12,
  },
  docGroup: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    paddingTop: 8,
  },
  docGroupTitle: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  docLine: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  docLineText: {
    color: '#222',
    fontSize: 12,
  },
  docSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  docSubtotalText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
  },
  docTotals: {
    marginTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#111',
    paddingTop: 12,
    gap: 6,
  },
  docTotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  docTotDivider: {
    borderTopWidth: 1,
    borderTopColor: '#CCC',
    paddingTop: 6,
  },
  docTotGrand: {
    borderTopWidth: 2,
    borderTopColor: '#111',
    paddingTop: 8,
  },
  docGrandText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  docFoot: {
    color: '#666',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 24,
  },
});
