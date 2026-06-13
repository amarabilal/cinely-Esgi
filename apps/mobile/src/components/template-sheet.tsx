import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Palette } from '@/constants/theme';
import { useSheetLayout } from '@/lib/sheet';
import { getTemplates, type NoteTemplate } from '@/lib/templates';

/**
 * Bottom sheet shown when the user taps "+" on the Notes screen. Picking a
 * template hands the chosen template back so the screen can create the note.
 */
export function TemplateSheet({
  visible,
  busy,
  onClose,
  onSelect,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSelect: (template: NoteTemplate) => void;
}) {
  const sheetLayout = useSheetLayout();
  const templates = getTemplates();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: sheetLayout.paddingBottom,
              maxHeight: sheetLayout.maxHeight(0.8),
            },
          ]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Create a new note</Text>
              <Text style={styles.subtitle}>Choose a template to get started</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              activeOpacity={0.7}
              accessibilityLabel="Close templates">
              <Ionicons name="close" size={24} color={Palette.mutedForeground} />
            </TouchableOpacity>
          </View>

          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={Palette.primary} />
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.name}
                  style={styles.tile}
                  activeOpacity={0.8}
                  disabled={busy}
                  onPress={() => onSelect(t)}>
                  <View style={styles.tileIcon}>
                    <Ionicons name={t.icon} size={22} color={Palette.primary} />
                  </View>
                  <Text style={styles.tileName}>{t.name}</Text>
                  <Text style={styles.tileDesc} numberOfLines={2}>
                    {t.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
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
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: Palette.foreground },
  subtitle: { fontSize: 13, color: Palette.mutedForeground, marginTop: 2 },
  busy: { paddingVertical: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  tile: {
    width: '48%',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: Palette.card,
    gap: 6,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: { fontSize: 15, fontWeight: '700', color: Palette.foreground, marginTop: 4 },
  tileDesc: { fontSize: 12, color: Palette.mutedForeground, lineHeight: 16 },
});
