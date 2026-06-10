import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  actions,
  RichEditor,
  RichToolbar,
} from 'react-native-pell-rich-editor';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Note } from '@/lib/types';

/** ms to wait after the last edit before pushing an autosave. */
const AUTOSAVE_DELAY = 1400;

type SaveState = 'idle' | 'saving' | 'saved';

/** Toolbar actions, in the order they appear above the keyboard. */
const TOOLBAR_ACTIONS = [
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.setStrikethrough,
  actions.heading1,
  actions.heading2,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.checkboxList,
  actions.blockquote,
  actions.code,
  actions.insertLink,
  actions.undo,
  actions.redo,
];

/** Map H1/H2 actions to text labels (pell has no default icon for these). */
const toolbarIconMap = {
  [actions.heading1]: ({ tintColor }: { tintColor: string }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H1</Text>
  ),
  [actions.heading2]: ({ tintColor }: { tintColor: string }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H2</Text>
  ),
};

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [title, setTitle] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const richText = useRef<RichEditor>(null);
  /** Latest editor HTML, kept in a ref so saving never re-renders the editor. */
  const contentRef = useRef('');
  /** Latest title, mirrored into a ref for the unmount flush. */
  const titleRef = useRef('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when local edits have not yet been persisted. */
  const dirty = useRef(false);
  const mounted = useRef(true);

  const readOnly = note?.sharedPermission === 'READ';

  // --- Load the note once ----------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get<Note>(`/notes/${id}`);
        if (!active) return;
        setNote(data);
        setTitle(data.title ?? '');
        titleRef.current = data.title ?? '';
        contentRef.current = data.content ?? '';
        setIsFavorite(data.isFavorite);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // --- Autosave --------------------------------------------------------------
  const persist = useCallback(async () => {
    if (readOnly || !dirty.current) return;
    dirty.current = false;
    if (mounted.current) setSaveState('saving');
    try {
      await api.put<Note>(`/notes/${id}`, {
        title: titleRef.current,
        content: contentRef.current,
      });
      if (mounted.current) setSaveState('saved');
    } catch {
      // Re-mark dirty so the next change (or unmount flush) retries.
      dirty.current = true;
      if (mounted.current) setSaveState('idle');
    }
  }, [id, readOnly]);

  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    dirty.current = true;
    if (mounted.current) setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DELAY);
  }, [persist, readOnly]);

  // Flush any pending save on unmount (best-effort).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) void persist();
    };
  }, [persist]);

  const onChangeTitle = useCallback(
    (text: string) => {
      setTitle(text);
      titleRef.current = text;
      scheduleSave();
    },
    [scheduleSave],
  );

  const onChangeContent = useCallback(
    (html: string) => {
      contentRef.current = html;
      scheduleSave();
    },
    [scheduleSave],
  );

  // --- Actions ---------------------------------------------------------------
  const handleBack = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirty.current) void persist();
    router.back();
  }, [persist, router]);

  const handleFavorite = useCallback(async () => {
    try {
      const { data } = await api.patch<Note>(`/notes/${id}/favorite`);
      setIsFavorite(data.isFavorite);
    } catch {
      // ignore; leave the current state
    }
  }, [id]);

  const handleArchive = useCallback(async () => {
    try {
      await api.patch<Note>(`/notes/${id}/archive`);
      router.back();
    } catch {
      Alert.alert('Could not archive', 'Please try again.');
    }
  }, [id, router]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete note', 'This note will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            dirty.current = false;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            await api.delete(`/notes/${id}`);
            router.back();
          } catch {
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  }, [id, router]);

  // --- Render ----------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !note) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={Palette.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={Palette.mutedForeground}
          />
          <Text style={styles.errorText}>This note could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBack}
            activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={Palette.foreground} />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            {saveLabel ? (
              <Text style={styles.saveText}>{saveLabel}</Text>
            ) : null}
            {readOnly ? (
              <View style={styles.readonlyBadge}>
                <Ionicons name="lock-closed" size={11} color={Palette.mutedForeground} />
                <Text style={styles.readonlyText}>Read only</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleFavorite}
              activeOpacity={0.7}>
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={22}
                color={isFavorite ? Palette.primary : Palette.foreground}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleArchive}
              activeOpacity={0.7}>
              <Ionicons name="archive-outline" size={22} color={Palette.foreground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleDelete}
              activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={22} color={Palette.destructive} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={onChangeTitle}
          placeholder="Untitled"
          placeholderTextColor={Palette.mutedForeground}
          editable={!readOnly}
          multiline
        />

        {/* Editor */}
        <RichEditor
          ref={richText}
          style={styles.editor}
          initialContentHTML={note.content ?? ''}
          onChange={onChangeContent}
          disabled={readOnly}
          placeholder="Start writing…"
          editorStyle={{
            backgroundColor: Palette.background,
            color: Palette.foreground,
            caretColor: Palette.primary,
            placeholderColor: Palette.mutedForeground,
            contentCSSText: 'font-size: 16px; line-height: 1.6; padding-bottom: 40px;',
          }}
          useContainer
        />

        {/* Toolbar (hidden when read-only) */}
        {!readOnly ? (
          <RichToolbar
            editor={richText}
            actions={TOOLBAR_ACTIONS}
            iconMap={toolbarIconMap}
            style={styles.toolbar}
            iconTint={Palette.foreground}
            selectedIconTint={Palette.primary}
            disabledIconTint={Palette.mutedForeground}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 15, color: Palette.mutedForeground },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 13,
    color: Palette.mutedForeground,
    marginRight: 4,
  },
  readonlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Palette.muted,
    marginRight: 4,
  },
  readonlyText: { fontSize: 11, fontWeight: '600', color: Palette.mutedForeground },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Palette.foreground,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  editor: { flex: 1, paddingHorizontal: 6 },

  toolbar: {
    backgroundColor: Palette.muted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  toolbarLabel: { fontSize: 16, fontWeight: '700' },
});
