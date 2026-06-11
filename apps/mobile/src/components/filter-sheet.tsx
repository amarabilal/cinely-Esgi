import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Folder, Tag } from '@/lib/types';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectFolder: (id: string, name: string) => void;
  onSelectTag: (id: string, name: string) => void;
}

/** Preset colors offered when creating/editing a tag. */
const TAG_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

export function FilterSheet({
  visible,
  onClose,
  onSelectFolder,
  onSelectTag,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  // Folder creation
  const [newFolder, setNewFolder] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Tag creation
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[5]);
  const [creatingTag, setCreatingTag] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersRes, tagsRes] = await Promise.all([
        api.get<Folder[]>('/folders'),
        api.get<Tag[]>('/tags'),
      ]);
      setFolders(foldersRes.data);
      setTags(tagsRes.data);
    } catch {
      // leave previous lists; sheet still shows empty states
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);

  // --- Folders ---------------------------------------------------------------
  const handleCreateFolder = useCallback(async () => {
    const name = newFolder.trim();
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    try {
      await api.post('/folders', { name });
      setNewFolder('');
      await load();
    } catch {
      Alert.alert('Could not create folder', 'Please try again.');
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolder, creatingFolder, load]);

  // Inline rename/recolor dialog state (works on iOS + Android; Alert.prompt is
  // iOS-only so we use a custom modal for both).
  const [renameTarget, setRenameTarget] = useState<
    { kind: 'folder' | 'tag'; id: string; name: string; color?: string } | null
  >(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameColor, setRenameColor] = useState(TAG_COLORS[5]);

  const promptRenameFolder = useCallback((folder: Folder) => {
    setRenameTarget({ kind: 'folder', id: folder.id, name: folder.name });
    setRenameValue(folder.name);
  }, []);

  const promptRenameTag = useCallback((tag: Tag) => {
    setRenameTarget({ kind: 'tag', id: tag.id, name: tag.name, color: tag.color });
    setRenameValue(tag.name);
    setRenameColor(tag.color || TAG_COLORS[5]);
  }, []);

  const submitRename = useCallback(async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      if (renameTarget.kind === 'folder') {
        await api.put(`/folders/${renameTarget.id}`, { name });
      } else {
        await api.put(`/tags/${renameTarget.id}`, { name, color: renameColor });
      }
      setRenameTarget(null);
      await load();
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    }
  }, [renameTarget, renameValue, renameColor, load]);

  const handleDeleteFolder = useCallback(
    (folder: Folder) => {
      Alert.alert(
        'Delete folder',
        `Delete "${folder.name}"? Notes inside are kept (just unfiled).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(`/folders/${folder.id}`);
                await load();
              } catch {
                Alert.alert('Could not delete', 'Please try again.');
              }
            },
          },
        ],
      );
    },
    [load],
  );

  const folderActions = useCallback(
    (folder: Folder) => {
      Alert.alert(folder.name, undefined, [
        { text: 'Rename', onPress: () => promptRenameFolder(folder) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteFolder(folder),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [promptRenameFolder, handleDeleteFolder],
  );

  // --- Tags ------------------------------------------------------------------
  const handleCreateTag = useCallback(async () => {
    const name = newTag.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      await api.post('/tags', { name, color: newTagColor });
      setNewTag('');
      await load();
    } catch {
      Alert.alert('Could not create tag', 'Please try again.');
    } finally {
      setCreatingTag(false);
    }
  }, [newTag, newTagColor, creatingTag, load]);

  const handleDeleteTag = useCallback(
    (tag: Tag) => {
      Alert.alert('Delete tag', `Delete "${tag.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/tags/${tag.id}`);
              await load();
            } catch {
              Alert.alert('Could not delete', 'Please try again.');
            }
          },
        },
      ]);
    },
    [load],
  );

  const tagActions = useCallback(
    (tag: Tag) => {
      Alert.alert(tag.name, undefined, [
        { text: 'Rename / recolor', onPress: () => promptRenameTag(tag) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteTag(tag),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [promptRenameTag, handleDeleteTag],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Bottom padding lives INSIDE the sheet so the panel reaches the screen
              edge while content clears gesture bars / home indicators. */}
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 20 },
            ]}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={10}
                activeOpacity={0.7}
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
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                {/* Folders */}
                <Text style={styles.sectionTitle}>Folders</Text>
                {folders.length === 0 ? (
                  <Text style={styles.emptyText}>No folders yet</Text>
                ) : (
                  folders.map((folder) => (
                    <View key={folder.id} style={styles.row}>
                      <TouchableOpacity
                        style={styles.rowMain}
                        activeOpacity={0.7}
                        onPress={() => onSelectFolder(folder.id, folder.name)}
                        onLongPress={() => folderActions(folder)}>
                        <Ionicons
                          name="folder-outline"
                          size={20}
                          color={Palette.mutedForeground}
                        />
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {folder.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        hitSlop={8}
                        style={styles.rowAction}
                        activeOpacity={0.7}
                        onPress={() => folderActions(folder)}
                        accessibilityLabel={`Edit folder ${folder.name}`}>
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={Palette.mutedForeground}
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* New folder */}
                <View style={styles.createRow}>
                  <Ionicons name="add" size={20} color={Palette.primary} />
                  <TextInput
                    style={styles.createInput}
                    value={newFolder}
                    onChangeText={setNewFolder}
                    placeholder="New folder"
                    placeholderTextColor={Palette.mutedForeground}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateFolder}
                    editable={!creatingFolder}
                  />
                  {newFolder.trim() ? (
                    <TouchableOpacity
                      style={styles.createBtn}
                      activeOpacity={0.85}
                      hitSlop={5}
                      onPress={handleCreateFolder}
                      disabled={creatingFolder}>
                      {creatingFolder ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.createBtnText}>Add</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Tags */}
                <Text style={[styles.sectionTitle, styles.sectionGap]}>Tags</Text>
                {tags.length === 0 ? (
                  <Text style={styles.emptyText}>No tags yet</Text>
                ) : (
                  tags.map((tag) => (
                    <View key={tag.id} style={styles.row}>
                      <TouchableOpacity
                        style={styles.rowMain}
                        activeOpacity={0.7}
                        onPress={() => onSelectTag(tag.id, tag.name)}
                        onLongPress={() => tagActions(tag)}>
                        <View
                          style={[
                            styles.tagDot,
                            { backgroundColor: tag.color || Palette.primary },
                          ]}
                        />
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {tag.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        hitSlop={8}
                        style={styles.rowAction}
                        activeOpacity={0.7}
                        onPress={() => tagActions(tag)}
                        accessibilityLabel={`Edit tag ${tag.name}`}>
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={Palette.mutedForeground}
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* New tag */}
                <View style={styles.createRow}>
                  <View
                    style={[styles.tagDot, { backgroundColor: newTagColor }]}
                  />
                  <TextInput
                    style={styles.createInput}
                    value={newTag}
                    onChangeText={setNewTag}
                    placeholder="New tag"
                    placeholderTextColor={Palette.mutedForeground}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateTag}
                    editable={!creatingTag}
                  />
                  {newTag.trim() ? (
                    <TouchableOpacity
                      style={styles.createBtn}
                      activeOpacity={0.85}
                      hitSlop={5}
                      onPress={handleCreateTag}
                      disabled={creatingTag}>
                      {creatingTag ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.createBtnText}>Add</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.colorPicker}>
                  {TAG_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setNewTagColor(c)}
                      hitSlop={9}
                      activeOpacity={0.7}
                      accessibilityLabel={`Pick color ${c}`}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c },
                        newTagColor === c && styles.colorSwatchActive,
                      ]}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Inline rename modal (Android fallback + tag recolor) */}
      <Modal
        visible={!!renameTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}>
        <Pressable
          style={styles.dialogBackdrop}
          onPress={() => setRenameTarget(null)}
        />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {renameTarget?.kind === 'folder' ? 'Rename folder' : 'Edit tag'}
            </Text>
            <TextInput
              style={styles.dialogInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Name"
              placeholderTextColor={Palette.mutedForeground}
              autoFocus
            />
            {renameTarget?.kind === 'tag' ? (
              <View style={styles.colorPicker}>
                {TAG_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setRenameColor(c)}
                    hitSlop={9}
                    activeOpacity={0.7}
                    accessibilityLabel={`Pick color ${c}`}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      renameColor === c && styles.colorSwatchActive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogCancel}
                activeOpacity={0.7}
                hitSlop={4}
                onPress={() => setRenameTarget(null)}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogSave}
                activeOpacity={0.85}
                hitSlop={4}
                onPress={submitRename}>
                <Text style={styles.dialogSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    maxHeight: '80%',
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
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  rowAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 16, color: Palette.foreground },
  tagDot: { width: 16, height: 16, borderRadius: 8 },
  emptyText: {
    fontSize: 14,
    color: Palette.mutedForeground,
    paddingVertical: 8,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    marginTop: 2,
  },
  createInput: {
    flex: 1,
    fontSize: 16,
    color: Palette.foreground,
    paddingVertical: 6,
  },
  createBtn: {
    backgroundColor: Palette.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingLeft: 28,
    paddingTop: 8,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: Palette.foreground },

  // Rename / recolor dialog
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialogWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: {
    width: '100%',
    backgroundColor: Palette.background,
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Palette.foreground,
    marginBottom: 14,
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 16,
    color: Palette.foreground,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  dialogCancel: {
    paddingHorizontal: 16,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dialogCancelText: { fontSize: 15, fontWeight: '600', color: Palette.mutedForeground },
  dialogSave: {
    paddingHorizontal: 20,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Palette.primary,
  },
  dialogSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
