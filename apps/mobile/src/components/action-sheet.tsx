import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Palette } from '@/constants/theme';
import { useSheetLayout } from '@/lib/sheet';

export interface ActionItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Render in the destructive (red) style. */
  destructive?: boolean;
}

/**
 * A styled bottom-sheet menu — the app's own look (rounded sheet, grabber,
 * icon rows) instead of the platform `Alert` action sheet.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: ActionItem[];
  onClose: () => void;
}) {
  const sheetLayout = useSheetLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: sheetLayout.paddingBottom }]}>
          <View style={styles.grabber} />
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {actions.map((action, i) => (
            <TouchableOpacity
              key={`${action.label}-${i}`}
              style={[styles.row, i > 0 && styles.rowDivider]}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                // Defer so the sheet's close animation isn't interrupted by
                // a follow-up modal/alert the action might open.
                requestAnimationFrame(action.onPress);
              }}>
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? Palette.destructive : Palette.foreground}
              />
              <Text
                style={[styles.label, action.destructive && styles.labelDestructive]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.mutedForeground,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  label: { fontSize: 16, fontWeight: '600', color: Palette.foreground },
  labelDestructive: { color: Palette.destructive },
});
