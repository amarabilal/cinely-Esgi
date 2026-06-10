import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Folder, Tag } from '@/lib/types';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectFolder: (id: string, name: string) => void;
  onSelectTag: (id: string, name: string) => void;
}

export function FilterSheet({
  visible,
  onClose,
  onSelectFolder,
  onSelectTag,
}: FilterSheetProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [foldersRes, tagsRes] = await Promise.all([
          api.get<Folder[]>('/folders'),
          api.get<Tag[]>('/tags'),
        ]);
        if (active) {
          setFolders(foldersRes.data);
          setTags(tagsRes.data);
        }
      } catch {
        // leave previous lists; sheet still shows empty states
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheetWrap} edges={['bottom']}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close filters">
              <Ionicons name="close" size={24} color={Palette.mutedForeground} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Palette.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Folders</Text>
              {folders.length === 0 ? (
                <Text style={styles.emptyText}>No folders yet</Text>
              ) : (
                folders.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => onSelectFolder(folder.id, folder.name)}>
                    <Ionicons
                      name="folder-outline"
                      size={20}
                      color={Palette.mutedForeground}
                    />
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={Palette.border}
                    />
                  </TouchableOpacity>
                ))
              )}

              <Text style={[styles.sectionTitle, styles.sectionGap]}>Tags</Text>
              {tags.length === 0 ? (
                <Text style={styles.emptyText}>No tags yet</Text>
              ) : (
                tags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => onSelectTag(tag.id, tag.name)}>
                    <View
                      style={[
                        styles.tagDot,
                        { backgroundColor: tag.color || Palette.primary },
                      ]}
                    />
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {tag.name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={Palette.border}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
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
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Palette.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    maxHeight: '75%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Palette.foreground },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  sectionGap: { marginTop: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
    paddingVertical: 6,
  },
  rowLabel: { flex: 1, fontSize: 16, color: Palette.foreground },
  tagDot: { width: 16, height: 16, borderRadius: 8 },
  emptyText: {
    fontSize: 14,
    color: Palette.mutedForeground,
    paddingVertical: 8,
  },
});
