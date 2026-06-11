import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  actions,
  RichEditor,
  RichToolbar,
} from 'react-native-pell-rich-editor';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareModal } from '@/components/share-modal';
import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSheetLayout } from '@/lib/sheet';
import {
  connectSocket,
  type JoinNoteAck,
  type NoteUpdatedPayload,
  type Presence,
} from '@/lib/socket';
import type { Note, Tag } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';

/** ms to wait after the last edit before pushing an autosave. */
const AUTOSAVE_DELAY = 1400;

/** ms to wait after the last edit before broadcasting a realtime update. */
const REALTIME_DELAY = 400;

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
  const sheetLayout = useSheetLayout();
  const currentUser = useAuthStore((s) => s.user);

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [title, setTitle] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [tags, setTags] = useState<Tag[]>([]);
  const [shareVisible, setShareVisible] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  /** Other users currently viewing/editing this note (realtime presence). */
  const [presence, setPresence] = useState<Presence[]>([]);

  const richText = useRef<RichEditor>(null);
  /** Latest editor HTML, kept in a ref so saving never re-renders the editor. */
  const contentRef = useRef('');
  /** Latest title, mirrored into a ref for the unmount flush. */
  const titleRef = useRef('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when local edits have not yet been persisted. */
  const dirty = useRef(false);
  const mounted = useRef(true);

  // --- Realtime refs ---------------------------------------------------------
  /** The shared socket, once connected for this screen (null if unavailable). */
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);
  /** Debounce timer for outgoing realtime broadcasts. */
  const rtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * True while the local user is actively editing. Used to suppress applying a
   * remote update on top of in-progress local edits (and as an extra echo
   * guard). Cleared shortly after the last keystroke.
   */
  const localEditing = useRef(false);
  const localEditingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * True while we are programmatically applying a REMOTE update to the editor.
   * onChangeContent fires as a side effect of setContentHTML; this flag stops
   * us from re-broadcasting that change (echo loop guard).
   */
  const applyingRemote = useRef(false);

  const readOnly = note?.sharedPermission === 'READ';
  /** Owner has no sharedPermission set. Only the owner can manage sharing. */
  const isOwner = !!note && !note.sharedPermission;
  const canEdit = !readOnly;

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
        setTags(data.tags ?? []);
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

  // --- Realtime sync ---------------------------------------------------------
  // Best-effort: connect, join the note room, mirror remote edits into the
  // editor, and maintain a presence list. Everything is wrapped so a socket
  // failure never breaks the editor (autosave already persists changes).
  useEffect(() => {
    // Only wire realtime once the note has loaded successfully.
    if (!note) return;

    let active = true;
    let joined = false;
    let sock: import('socket.io-client').Socket | null = null;

    const onNoteUpdated = (payload: NoteUpdatedPayload) => {
      try {
        if (!active || payload.noteId !== id) return;
        // Ignore our own broadcasts (echo) and updates while we're typing.
        if (payload.userId === currentUser?.id) return;
        if (localEditing.current) return;

        // Apply remote title.
        if (typeof payload.title === 'string') {
          titleRef.current = payload.title;
          setTitle(payload.title);
        }
        // Apply remote content, guarding the resulting onChange from echoing.
        if (typeof payload.content === 'string') {
          applyingRemote.current = true;
          contentRef.current = payload.content;
          richText.current?.setContentHTML(payload.content);
          // Release the guard after the change has settled.
          setTimeout(() => {
            applyingRemote.current = false;
          }, 50);
        }
      } catch {
        applyingRemote.current = false;
      }
    };

    const onUserJoined = (p: Presence) => {
      if (!active) return;
      setPresence((prev) =>
        prev.some((u) => u.userId === p.userId) ? prev : [...prev, p],
      );
    };

    const onUserLeft = (p: { userId: string }) => {
      if (!active) return;
      setPresence((prev) => prev.filter((u) => u.userId !== p.userId));
    };

    (async () => {
      try {
        sock = await connectSocket();
        if (!sock || !active) return;
        socketRef.current = sock;

        sock.on('note_updated', onNoteUpdated);
        sock.on('user_joined', onUserJoined);
        sock.on('user_left', onUserLeft);

        const doJoin = () => {
          try {
            sock?.emit('join_note', { noteId: id }, (ack?: JoinNoteAck) => {
              if (!active) return;
              if (ack?.users) setPresence(ack.users);
            });
            joined = true;
          } catch {
            // ignore
          }
        };

        if (sock.connected) doJoin();
        // Re-join on (re)connect so presence survives transient drops.
        sock.on('connect', doJoin);
      } catch {
        // realtime unavailable; editor keeps working via autosave
      }
    })();

    return () => {
      active = false;
      if (rtTimer.current) clearTimeout(rtTimer.current);
      if (localEditingTimer.current) clearTimeout(localEditingTimer.current);
      try {
        if (sock) {
          if (joined) sock.emit('leave_note', { noteId: id });
          sock.off('note_updated', onNoteUpdated);
          sock.off('user_joined', onUserJoined);
          sock.off('user_left', onUserLeft);
        }
      } catch {
        // ignore
      }
      socketRef.current = null;
      setPresence([]);
    };
    // Re-run only when the note id changes (note presence is a load gate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, note?.id, currentUser?.id]);

  // --- Realtime broadcast (best-effort) --------------------------------------
  /**
   * Debounced broadcast of the local title+content to collaborators. No-ops
   * when read-only, when the socket isn't connected, or while applying a
   * remote update (echo guard).
   */
  const broadcastRealtime = useCallback(() => {
    if (readOnly || applyingRemote.current) return;
    if (rtTimer.current) clearTimeout(rtTimer.current);
    rtTimer.current = setTimeout(() => {
      const sock = socketRef.current;
      if (!sock?.connected) return;
      try {
        sock.emit('note_update', {
          noteId: id,
          title: titleRef.current,
          content: contentRef.current,
        });
      } catch {
        // best-effort; autosave still persists over HTTP
      }
    }, REALTIME_DELAY);
  }, [id, readOnly]);

  /** Mark the editor as actively edited locally (suppresses remote overwrite). */
  const markLocalEditing = useCallback(() => {
    localEditing.current = true;
    if (localEditingTimer.current) clearTimeout(localEditingTimer.current);
    // Clear the "actively editing" flag a beat after the last keystroke so
    // remote updates can flow in again once the user pauses.
    localEditingTimer.current = setTimeout(() => {
      localEditing.current = false;
    }, 1500);
  }, []);

  const onChangeTitle = useCallback(
    (text: string) => {
      setTitle(text);
      titleRef.current = text;
      markLocalEditing();
      scheduleSave();
      broadcastRealtime();
    },
    [scheduleSave, broadcastRealtime, markLocalEditing],
  );

  const onChangeContent = useCallback(
    (html: string) => {
      contentRef.current = html;
      // setContentHTML (remote apply) triggers onChange; don't re-broadcast it.
      if (applyingRemote.current) return;
      markLocalEditing();
      scheduleSave();
      broadcastRealtime();
    },
    [scheduleSave, broadcastRealtime, markLocalEditing],
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

  // --- Tags ------------------------------------------------------------------
  const openTagPicker = useCallback(async () => {
    setTagPickerVisible(true);
    setTagsLoading(true);
    try {
      const { data } = await api.get<Tag[]>('/tags');
      setAllTags(data);
    } catch {
      // leave list empty; picker shows empty state
    } finally {
      setTagsLoading(false);
    }
  }, []);

  const handleAttachTag = useCallback(
    async (tag: Tag) => {
      if (tags.some((t) => t.id === tag.id)) {
        setTagPickerVisible(false);
        return;
      }
      // optimistic
      setTags((prev) => [...prev, tag]);
      setTagPickerVisible(false);
      try {
        const { data } = await api.post<Note | null>(
          `/notes/${id}/tags/${tag.id}`,
        );
        if (data?.tags) setTags(data.tags);
      } catch {
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        Alert.alert('Could not add tag', 'Please try again.');
      }
    },
    [id, tags],
  );

  const handleRemoveTag = useCallback(
    async (tag: Tag) => {
      const prevTags = tags;
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      try {
        const { data } = await api.delete<Note | null>(
          `/notes/${id}/tags/${tag.id}`,
        );
        if (data?.tags) setTags(data.tags);
      } catch {
        setTags(prevTags);
        Alert.alert('Could not remove tag', 'Please try again.');
      }
    },
    [id, tags],
  );

  const availableTags = useMemo(
    () => allTags.filter((t) => !tags.some((nt) => nt.id === t.id)),
    [allTags, tags],
  );

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
            {/* Realtime presence: colored dots for collaborators in this note. */}
            {presence.length > 0 ? (
              <View
                style={styles.presence}
                accessibilityLabel={`${presence.length} other ${presence.length === 1 ? 'person' : 'people'} editing`}>
                {presence.slice(0, 3).map((p) => (
                  <View
                    key={p.userId}
                    style={[
                      styles.presenceDot,
                      { backgroundColor: p.color || Palette.primary },
                    ]}
                  />
                ))}
                {presence.length > 3 ? (
                  <Text style={styles.presenceMore}>+{presence.length - 3}</Text>
                ) : null}
              </View>
            ) : null}
            {saveLabel ? (
              <Text style={styles.saveText}>{saveLabel}</Text>
            ) : null}
            {readOnly ? (
              <View style={styles.readonlyBadge}>
                <Ionicons name="lock-closed" size={11} color={Palette.mutedForeground} />
                <Text style={styles.readonlyText}>Read only</Text>
              </View>
            ) : null}

            {isOwner ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShareVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Share note">
                <Ionicons
                  name="person-add-outline"
                  size={21}
                  color={Palette.foreground}
                />
              </TouchableOpacity>
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

        {/* Tag chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagBar}
          contentContainerStyle={styles.tagBarContent}
          keyboardShouldPersistTaps="handled">
          {tags.map((tag) => (
            <View key={tag.id} style={styles.tagChip}>
              <View
                style={[
                  styles.tagChipDot,
                  { backgroundColor: tag.color || Palette.primary },
                ]}
              />
              <Text style={styles.tagChipText} numberOfLines={1}>
                {tag.name}
              </Text>
              {canEdit ? (
                <TouchableOpacity
                  hitSlop={12}
                  activeOpacity={0.7}
                  onPress={() => handleRemoveTag(tag)}
                  accessibilityLabel={`Remove tag ${tag.name}`}>
                  <Ionicons name="close" size={14} color={Palette.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {canEdit ? (
            <TouchableOpacity
              style={styles.addTagChip}
              activeOpacity={0.7}
              onPress={openTagPicker}
              accessibilityLabel="Add tag">
              <Ionicons name="add" size={16} color={Palette.primary} />
              <Text style={styles.addTagText}>tag</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

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

      {/* Share modal (owner only) */}
      {isOwner ? (
        <ShareModal
          visible={shareVisible}
          noteId={id}
          onClose={() => setShareVisible(false)}
        />
      ) : null}

      {/* Tag picker */}
      <Modal
        visible={tagPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTagPickerVisible(false)}>
        <Pressable
          style={styles.tagBackdrop}
          onPress={() => setTagPickerVisible(false)}
        />
        <View style={styles.tagSheetWrap} pointerEvents="box-none">
          {/* Bottom padding lives INSIDE the sheet so the panel reaches the screen
              edge while content clears gesture bars / home indicators. */}
          <View
            style={[
              styles.tagSheet,
              {
                paddingBottom: sheetLayout.paddingBottom,
                maxHeight: sheetLayout.maxHeight(0.7),
              },
            ]}>
            <View style={styles.tagGrabber} />
            <View style={styles.tagSheetHeader}>
              <Text style={styles.tagSheetTitle}>Add a tag</Text>
              <TouchableOpacity
                onPress={() => setTagPickerVisible(false)}
                hitSlop={10}
                activeOpacity={0.7}
                accessibilityLabel="Close tag picker">
                <Ionicons name="close" size={24} color={Palette.mutedForeground} />
              </TouchableOpacity>
            </View>
            {tagsLoading ? (
              <View style={styles.tagSheetCenter}>
                <ActivityIndicator color={Palette.primary} />
              </View>
            ) : availableTags.length === 0 ? (
              <Text style={styles.tagSheetEmpty}>
                No more tags to add. Create tags from the filter sheet.
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {availableTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={styles.tagPickRow}
                    activeOpacity={0.7}
                    onPress={() => handleAttachTag(tag)}>
                    <View
                      style={[
                        styles.tagChipDot,
                        { backgroundColor: tag.color || Palette.primary },
                      ]}
                    />
                    <Text style={styles.tagPickLabel} numberOfLines={1}>
                      {tag.name}
                    </Text>
                    <Ionicons name="add" size={20} color={Palette.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.mutedForeground,
    marginRight: 4,
  },
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 6,
  },
  presenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Palette.background,
  },
  presenceMore: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.mutedForeground,
    marginLeft: 2,
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
    // Explicit lineHeight so descenders (g, y, p) aren't clipped by the input.
    lineHeight: 34,
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

  // Tag chips
  tagBar: { flexGrow: 0, paddingHorizontal: 20, marginBottom: 4 },
  tagBarContent: { gap: 8, alignItems: 'center', paddingVertical: 2 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Palette.muted,
    maxWidth: 180,
  },
  tagChipDot: { width: 10, height: 10, borderRadius: 5 },
  tagChipText: { fontSize: 13, fontWeight: '600', color: Palette.foreground },
  addTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.border,
    borderStyle: 'dashed',
  },
  addTagText: { fontSize: 13, fontWeight: '600', color: Palette.primary },

  // Tag picker sheet
  tagBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  tagSheetWrap: { flex: 1, justifyContent: 'flex-end' },
  tagSheet: {
    backgroundColor: Palette.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  tagGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 12,
  },
  tagSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagSheetTitle: { fontSize: 20, fontWeight: '800', color: Palette.foreground },
  tagSheetCenter: { paddingVertical: 32, alignItems: 'center' },
  tagSheetEmpty: {
    fontSize: 14,
    color: Palette.mutedForeground,
    paddingVertical: 12,
  },
  tagPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 6,
  },
  tagPickLabel: { flex: 1, fontSize: 16, color: Palette.foreground },
});
