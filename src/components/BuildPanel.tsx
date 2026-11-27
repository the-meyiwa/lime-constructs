import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from './Icon';
import {
  CATEGORIES,
  PARTS,
  UNIT_TYPE,
  WALLS,
  type PartDef,
  type UnitModel,
  type WallId,
} from '../container-library';
import { c } from '../theme';

export type PlaceTarget = {
  kind: 'wall' | 'floor' | 'roof' | 'site';
  unitId?: string;
  wall?: WallId;
  along?: number;
  x?: number;
  z?: number;
} | null;

const placeKinds = (at: PlaceTarget): string[] | null =>
  at?.kind === 'wall'
    ? ['opening', 'facade']
    : at?.kind === 'floor'
    ? ['fitting']
    : at?.kind === 'roof'
    ? ['roof']
    : at?.kind === 'site'
    ? ['site']
    : null;

const sizeLabel = (p: PartDef) =>
  p.kind === 'site' || p.kind === 'roof' || (p.kind === 'fitting' && !p.isWall)
    ? `${p.w} × ${p.d} m`
    : p.isWall
    ? 'wall'
    : `${p.w} × ${p.h} m`;

export function BuildPanel({
  units,
  placeAt,
  onCancelPlace,
  onAddUnit,
  onAddPart,
  onOpenPresets,
}: {
  units: UnitModel[];
  placeAt: PlaceTarget;
  onCancelPlace: () => void;
  onAddUnit: (preset: string) => void;
  onAddPart: (partId: string) => void;
  onOpenPresets: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    doors: true,
    glazing: true,
  });

  const q = query.trim().toLowerCase();
  const kinds = placeKinds(placeAt);

  const filteredCats = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const parts = PARTS.filter((p) => {
        if (p.cat !== cat.id) return false;
        const matchesQuery = !q || `${p.name} ${p.spec || ''} ${p.cat}`.toLowerCase().includes(q);
        const matchesKind = !kinds || kinds.includes(p.kind) || (kinds.includes('site') && p.siteOk);
        return matchesQuery && matchesKind;
      });
      return { ...cat, parts };
    }).filter((cat) => cat.parts.length > 0);
  }, [q, kinds]);

  const placeWhere = useMemo(() => {
    if (!placeAt) return '';
    const u = placeAt.unitId ? units.find((x) => x.id === placeAt.unitId) : null;
    const uName = u ? u.name || UNIT_TYPE[u.preset]?.name || 'Unit' : 'Unit';
    if (placeAt.kind === 'wall') {
      const wName = WALLS.find((w) => w.id === placeAt.wall)?.name.toLowerCase() || 'wall';
      return `on the ${wName} of ${uName}`;
    }
    if (placeAt.kind === 'floor') return `inside ${uName}`;
    if (placeAt.kind === 'roof') return `on the roof of ${uName}`;
    return 'on the site';
  }, [placeAt, units]);

  const toggleCat = (id: string) => {
    setOpenCats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.search}>
          <Icon name="search" size={14} color={c.mute} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search parts"
            placeholderTextColor={c.mute}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <Icon name="close" size={12} color={c.mute} />
            </Pressable>
          ) : Platform.OS === 'web' ? (
            <View style={styles.kbd}>
              <Text style={styles.kbdText}>/</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onOpenPresets} style={({ pressed }) => [styles.presetsBtn, pressed && styles.pressed]}>
          <Icon name="grid" size={14} color={c.text} />
          <Text style={styles.presetsBtnText}>Designs</Text>
        </Pressable>
      </View>

      {placeAt ? (
        <View style={styles.placeBanner}>
          <Icon name="place" size={14} color={c.bg} />
          <Text style={styles.placeBannerText}>Choose a part to place {placeWhere}</Text>
          <Pressable onPress={onCancelPlace} style={styles.placeClose} hitSlop={8}>
            <Icon name="close" size={14} color={c.bg} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.unitsAdd}>
        <Text style={styles.libH}>Add a unit</Text>
        <View style={styles.unitChips}>
          {(['20ft', '40ft', '40hc', 'pc20'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => onAddUnit(id)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Icon name="plus" size={12} color={c.text} />
              <Text style={styles.chipText}>{UNIT_TYPE[id].name.replace(' container', '')}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.lib} contentContainerStyle={styles.libContent} keyboardShouldPersistTaps="handled">
        {filteredCats.map((cat, idx) => {
          const isOpen = Boolean(q || kinds || openCats[cat.id]);
          return (
            <View key={cat.id} style={[styles.cat, idx > 0 && styles.catBorder]}>
              <Pressable onPress={() => toggleCat(cat.id)} style={styles.catSummary}>
                <Text style={styles.catTitle}>{cat.name}</Text>
                <Text style={styles.catCount}>{cat.parts.length}</Text>
                <Icon name={isOpen ? 'chevronDown' : 'chevron'} size={13} color={c.mute} />
              </Pressable>
              {isOpen && (
                <View style={styles.parts}>
                  {cat.parts.map((p) => {
                    const webDragProps =
                      Platform.OS === 'web'
                        ? {
                            draggable: true,
                            onDragStart: (e: any) => {
                              e.dataTransfer?.setData?.('text/x-cb-part', p.id);
                              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                            },
                          }
                        : {};
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => onAddPart(p.id)}
                        style={({ pressed }) => [styles.part, pressed && styles.partPressed]}
                        {...(webDragProps as any)}
                      >
                        <Text style={styles.partName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.partSize}>{sizeLabel(p)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        {filteredCats.length === 0 ? <Text style={styles.empty}>No parts match.</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: c.panel,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.line,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 13,
    paddingVertical: 0,
  },
  kbd: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.line2,
    backgroundColor: c.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbdText: {
    color: c.mute,
    fontSize: 10.5,
    fontWeight: '600',
  },
  presetsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line,
  },
  presetsBtnText: {
    color: c.text,
    fontSize: 12.5,
    fontWeight: '500',
  },
  pressed: {
    backgroundColor: c.raised,
  },
  placeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: c.lime,
  },
  placeBannerText: {
    flex: 1,
    color: c.bg,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  placeClose: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitsAdd: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  libH: {
    color: c.mute,
    fontSize: 11.5,
    fontWeight: '500',
    marginBottom: 6,
    marginLeft: 2,
  },
  unitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.line,
  },
  chipText: {
    color: c.text,
    fontSize: 12,
  },
  lib: {
    flex: 1,
  },
  libContent: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  cat: {},
  catBorder: {
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  catSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  catTitle: {
    flex: 1,
    color: c.text,
    fontSize: 12.5,
    fontWeight: '600',
  },
  catCount: {
    color: c.mute,
    fontSize: 11.5,
  },
  parts: {
    gap: 2,
    paddingBottom: 8,
  },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  partPressed: {
    backgroundColor: c.bg,
  },
  partName: {
    flex: 1,
    color: c.text,
    fontSize: 12.5,
  },
  partSize: {
    color: c.mute,
    fontSize: 11,
  },
  empty: {
    color: c.mute,
    fontSize: 12.5,
    margin: 8,
  },
});
