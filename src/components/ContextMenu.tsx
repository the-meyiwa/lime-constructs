import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Icon } from './Icon';
import { c, r } from '../theme';

export type ContextMenuItem = {
  heading?: string;
  separator?: boolean;
  label?: string;
  icon?: string;
  shortcut?: string;
  destructive?: boolean;
  action?: () => void;
};

export type ContextMenuConfig = {
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
};

export function ContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuConfig | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  if (!menu) return null;

  const isNarrow = width < 640;
  const menuW = 248;
  const clampedX = Math.max(12, Math.min(width - menuW - 12, menu.x));
  const clampedY = Math.max(16, Math.min(height - 340, menu.y));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={
            isNarrow
              ? styles.sheet
              : [
                  styles.popover,
                  {
                    left: clampedX,
                    top: clampedY,
                    width: menuW,
                  },
                ]
          }
        >
          {isNarrow && (
            <View style={styles.grabWrap}>
              <View style={styles.grab} />
            </View>
          )}
          {menu.title ? (
            <View style={styles.head}>
              <Text style={styles.title} numberOfLines={1}>
                {menu.title}
              </Text>
              {isNarrow && (
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Icon name="close" size={16} color={c.dim} />
                </Pressable>
              )}
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: isNarrow ? height * 0.65 : 380 }} bounces={false}>
            {menu.items.map((item, idx) => {
              if (item.separator) {
                return <View key={'sep_' + idx} style={styles.sep} />;
              }
              if (item.heading) {
                return (
                  <Text key={'hd_' + idx} style={styles.heading}>
                    {item.heading}
                  </Text>
                );
              }
              return (
                <Pressable
                  key={'it_' + idx}
                  onPress={() => {
                    onClose();
                    item.action?.();
                  }}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  {item.icon ? (
                    <Icon name={item.icon} size={14} color={item.destructive ? '#F07878' : c.dim} />
                  ) : null}
                  <Text
                    style={[
                      styles.itemLabel,
                      item.destructive && { color: '#F07878' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.shortcut && Platform.OS === 'web' && !isNarrow ? (
                    <Text style={styles.shortcut}>{item.shortcut}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  popover: {
    position: 'absolute',
    backgroundColor: c.panel2,
    borderWidth: 1,
    borderColor: c.line2,
    borderRadius: r.md,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  sheet: {
    backgroundColor: c.panel2,
    borderTopLeftRadius: r.lg,
    borderTopRightRadius: r.lg,
    borderTopWidth: 1,
    borderColor: c.line2,
    paddingBottom: 24,
    paddingTop: 6,
  },
  grabWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  grab: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  title: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sep: {
    height: 1,
    backgroundColor: c.line,
    marginVertical: 4,
  },
  heading: {
    color: c.mute,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  itemPressed: {
    backgroundColor: c.raised,
  },
  itemLabel: {
    color: c.text,
    fontSize: 13,
    flex: 1,
  },
  shortcut: {
    color: c.mute,
    fontSize: 11,
  },
});
