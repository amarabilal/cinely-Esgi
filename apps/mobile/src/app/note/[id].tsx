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

import { ActionSheet, type ActionItem } from '@/components/action-sheet';
import { ShareModal } from '@/components/share-modal';
import { Palette } from '@/constants/theme';
import { suggestTitle, summarizeContent, suggestTags } from '@/lib/ai';
import { api } from '@/lib/api';
import { stripHtml } from '@/lib/format';
import {
  exportNoteToDrive,
  getGoogleStatus,
  sendNoteEmail,
  syncNoteToCalendar,
} from '@/lib/google';
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

/** Average reading speed for the reading-time estimate. */
const WORDS_PER_MINUTE = 200;

type SaveState = 'idle' | 'saving' | 'saved';

/** Word count from an HTML string (strips tags, splits on whitespace). */
function countWords(html: string): number {
  const text = stripHtml(html ?? '').trim();
  return text ? text.split(/\s+/).length : 0;
}

/**
 * A non-format pseudo-action used to draw a vertical divider between toolbar
 * groups. Pressing it is a no-op (pell's `_onPress` default case calls
 * `props['sep']?.()`, which is undefined). The key can repeat — the toolbar's
 * keyExtractor disambiguates by index.
 */
const SEP = 'sep';

/**
 * Toolbar actions, grouped by kind. `SEP` markers render a divider so related
 * controls read as one cluster: inline styles · headings · lists · blocks ·
 * history.
 */
const TOOLBAR_ACTIONS = [
  // Inline styles
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.setStrikethrough,
  SEP,
  // Headings
  actions.heading1,
  actions.heading2,
  actions.heading3,
  SEP,
  // Lists
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.checkboxList,
  SEP,
  // Blocks & links
  actions.blockquote,
  actions.code,
  actions.insertLink,
  SEP,
  // History
  actions.undo,
  actions.redo,
];

/**
 * Custom renderers for actions pell has no icon for: H1/H2/H3 text labels and
 * the group divider.
 */
const toolbarIconMap = {
  [actions.heading1]: ({ tintColor }: { tintColor: string }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H1</Text>
  ),
  [actions.heading2]: ({ tintColor }: { tintColor: string }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H2</Text>
  ),
  [actions.heading3]: ({ tintColor }: { tintColor: string }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H3</Text>
  ),
  [SEP]: () => <View style={styles.toolbarDivider} />,
};

/** Preset colors offered when creating a tag (mirrors the filter sheet). */
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
  const [isPinned, setIsPinned] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [tags, setTags] = useState<Tag[]>([]);
  const [shareVisible, setShareVisible] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  // Google integration (per-note export actions).
  const [googleConnected, setGoogleConnected] = useState(false);
  // "More" actions bottom sheet.
  const [menuVisible, setMenuVisible] = useState(false);
  // AI assistant (suggest title / summarize / suggest tags).
  const [aiMenuVisible, setAiMenuVisible] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestVisible, setSuggestVisible] = useState(false);
  // Email-note modal.
  const [emailVisible, setEmailVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  // New-tag creation (from inside this note's tag picker).
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[5]);
  const [creatingTag, setCreatingTag] = useState(false);
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
        setIsPinned(!!data.isPinned);
        setWordCount(countWords(data.content ?? ''));
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
      setWordCount(countWords(html));
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

  const handlePin = useCallback(async () => {
    // optimistic toggle
    setIsPinned((p) => !p);
    try {
      const { data } = await api.patch<Note>(`/notes/${id}/pin`);
      setIsPinned(!!data.isPinned);
    } catch {
      setIsPinned((p) => !p);
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

  /** Create a brand-new tag and attach it to this note in one step. */
  const handleCreateTag = useCallback(async () => {
    const name = newTag.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      const { data: created } = await api.post<Tag>('/tags', {
        name,
        color: newTagColor,
      });
      setAllTags((prev) => [...prev, created]);
      setNewTag('');
      // Attach to the current note (also closes the picker).
      await handleAttachTag(created);
    } catch {
      Alert.alert('Could not create tag', 'Please try again.');
    } finally {
      setCreatingTag(false);
    }
  }, [newTag, newTagColor, creatingTag, handleAttachTag]);

  const availableTags = useMemo(
    () => allTags.filter((t) => !tags.some((nt) => nt.id === t.id)),
    [allTags, tags],
  );

  // --- Google per-note actions -----------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await getGoogleStatus();
        if (active) setGoogleConnected(status.connected);
      } catch {
        // leave disconnected; actions just won't be offered
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleExportDrive = useCallback(async () => {
    try {
      const link = await exportNoteToDrive(id);
      Alert.alert('Exported to Drive', link ? 'Opened as a Google Doc.' : 'Done.');
    } catch {
      Alert.alert('Export failed', 'Please try again.');
    }
  }, [id]);

  const handleSyncCalendar = useCallback(async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      await syncNoteToCalendar(id, start, end);
      Alert.alert('Added to Calendar', 'A 1-hour event was created (starting now).');
    } catch {
      Alert.alert('Calendar sync failed', 'Please try again.');
    }
  }, [id]);

  const handleSendEmail = useCallback(async () => {
    const to = emailTo.trim();
    if (!to) return;
    setEmailSending(true);
    try {
      await sendNoteEmail(to, emailSubject.trim() || titleRef.current || 'Note', contentRef.current);
      setEmailVisible(false);
      setEmailTo('');
      Alert.alert('Email sent', `Sent to ${to}.`);
    } catch {
      Alert.alert('Could not send', 'Please try again.');
    } finally {
      setEmailSending(false);
    }
  }, [emailTo, emailSubject]);

  /** Consolidated "more" actions: organize + Google export, shown in a styled sheet. */
  const moreActions = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    if (isOwner) {
      items.push({
        label: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? 'pin' : 'pin-outline',
        onPress: () => void handlePin(),
      });
    }
    items.push({
      label: 'Archive',
      icon: 'archive-outline',
      onPress: () => void handleArchive(),
    });
    if (googleConnected) {
      items.push({
        label: 'Export to Google Drive',
        icon: 'cloud-upload-outline',
        onPress: () => void handleExportDrive(),
      });
      items.push({
        label: 'Add to Google Calendar',
        icon: 'calendar-outline',
        onPress: () => void handleSyncCalendar(),
      });
      items.push({
        label: 'Email this note',
        icon: 'mail-outline',
        onPress: () => {
          setEmailSubject(titleRef.current || 'Note');
          setEmailVisible(true);
        },
      });
    }
    items.push({
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => handleDelete(),
    });
    return items;
  }, [
    isOwner,
    isPinned,
    googleConnected,
    handlePin,
    handleArchive,
    handleDelete,
    handleExportDrive,
    handleSyncCalendar,
  ]);

  // --- AI assistant ----------------------------------------------------------
  const hasContent = () => stripHtml(contentRef.current ?? '').trim().length > 0;

  const doSuggestTitle = useCallback(async () => {
    if (!hasContent()) {
      Alert.alert('Nothing to work with', 'Write some content first.');
      return;
    }
    setAiBusy(true);
    try {
      const t = await suggestTitle(contentRef.current);
      if (t) {
        setTitle(t);
        titleRef.current = t;
        scheduleSave();
        broadcastRealtime();
      }
    } catch {
      Alert.alert('Could not suggest a title', 'Please try again.');
    } finally {
      setAiBusy(false);
    }
  }, [scheduleSave, broadcastRealtime]);

  const doSummarize = useCallback(async () => {
    if (!hasContent()) {
      Alert.alert('Nothing to summarize', 'Write some content first.');
      return;
    }
    setAiBusy(true);
    try {
      const s = await summarizeContent(contentRef.current);
      setSummaryText(s || 'No summary was generated.');
      setSummaryVisible(true);
    } catch {
      Alert.alert('Could not summarize', 'Please try again.');
    } finally {
      setAiBusy(false);
    }
  }, []);

  const doSuggestTags = useCallback(async () => {
    if (!hasContent()) {
      Alert.alert('Nothing to work with', 'Write some content first.');
      return;
    }
    setAiBusy(true);
    try {
      const existing = tags.map((t) => t.name);
      const sugg = await suggestTags(contentRef.current, existing);
      setSuggestedTags(sugg);
      setSuggestVisible(true);
    } catch {
      Alert.alert('Could not suggest tags', 'Please try again.');
    } finally {
      setAiBusy(false);
    }
  }, [tags]);

  /** Create (or reuse) a tag for a suggested name and attach it to the note. */
  const addSuggestedTag = useCallback(
    async (name: string) => {
      try {
        const { data: all } = await api.get<Tag[]>('/tags');
        let tag = all.find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (!tag) {
          const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
          const { data: created } = await api.post<Tag>('/tags', { name, color });
          tag = created;
        }
        setAllTags((prev) => (prev.some((t) => t.id === tag!.id) ? prev : [...prev, tag!]));
        await handleAttachTag(tag);
        setSuggestedTags((prev) => prev.filter((t) => t !== name));
      } catch {
        Alert.alert('Could not add tag', 'Please try again.');
      }
    },
    [handleAttachTag],
  );

  const aiActions = useMemo<ActionItem[]>(
    () => [
      { label: 'Suggest a title', icon: 'sparkles-outline', onPress: () => void doSuggestTitle() },
      { label: 'Summarize note', icon: 'document-text-outline', onPress: () => void doSummarize() },
      { label: 'Suggest tags', icon: 'pricetags-outline', onPress: () => void doSuggestTags() },
    ],
    [doSuggestTitle, doSummarize, doSuggestTags],
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

            {isOwner ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handlePin}
                activeOpacity={0.7}
                accessibilityLabel={isPinned ? 'Unpin note' : 'Pin note'}>
                <Ionicons
                  name={isPinned ? 'pin' : 'pin-outline'}
                  size={21}
                  color={isPinned ? Palette.primary : Palette.foreground}
                />
              </TouchableOpacity>
            ) : null}

            {canEdit ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setAiMenuVisible(true)}
                disabled={aiBusy}
                activeOpacity={0.7}
                accessibilityLabel="AI assistant">
                {aiBusy ? (
                  <ActivityIndicator size="small" color={Palette.primary} />
                ) : (
                  <Ionicons name="sparkles" size={20} color={Palette.primary} />
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setMenuVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="More actions">
              <Ionicons name="ellipsis-horizontal" size={22} color={Palette.foreground} />
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

        {/* Word count / reading time */}
        <Text style={styles.wordCount}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'} ·{' '}
          {wordCount < WORDS_PER_MINUTE
            ? '< 1 min read'
            : `${Math.ceil(wordCount / WORDS_PER_MINUTE)} min read`}
        </Text>

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

        {/* Format toolbar — sits above the editor, grouped by kind */}
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
      </KeyboardAvoidingView>

      {/* More actions (styled bottom sheet) */}
      <ActionSheet
        visible={menuVisible}
        title={title?.trim() || 'Note'}
        actions={moreActions}
        onClose={() => setMenuVisible(false)}
      />

      {/* AI assistant (styled bottom sheet) */}
      <ActionSheet
        visible={aiMenuVisible}
        title="AI assistant"
        actions={aiActions}
        onClose={() => setAiMenuVisible(false)}
      />

      {/* AI summary */}
      <Modal
        visible={summaryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSummaryVisible(false)}>
        <Pressable style={styles.tagBackdrop} onPress={() => setSummaryVisible(false)} />
        <View style={styles.tagSheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.tagSheet,
              { paddingBottom: sheetLayout.paddingBottom, maxHeight: sheetLayout.maxHeight(0.7) },
            ]}>
            <View style={styles.tagGrabber} />
            <View style={styles.tagSheetHeader}>
              <Text style={styles.tagSheetTitle}>Summary</Text>
              <TouchableOpacity
                onPress={() => setSummaryVisible(false)}
                hitSlop={10}
                activeOpacity={0.7}
                accessibilityLabel="Close summary">
                <Ionicons name="close" size={24} color={Palette.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.summaryText}>{summaryText}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* AI suggested tags */}
      <Modal
        visible={suggestVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSuggestVisible(false)}>
        <Pressable style={styles.tagBackdrop} onPress={() => setSuggestVisible(false)} />
        <View style={styles.tagSheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.tagSheet,
              { paddingBottom: sheetLayout.paddingBottom, maxHeight: sheetLayout.maxHeight(0.6) },
            ]}>
            <View style={styles.tagGrabber} />
            <View style={styles.tagSheetHeader}>
              <Text style={styles.tagSheetTitle}>Suggested tags</Text>
              <TouchableOpacity
                onPress={() => setSuggestVisible(false)}
                hitSlop={10}
                activeOpacity={0.7}
                accessibilityLabel="Close suggestions">
                <Ionicons name="close" size={24} color={Palette.mutedForeground} />
              </TouchableOpacity>
            </View>
            {suggestedTags.length === 0 ? (
              <Text style={styles.tagSheetEmpty}>No suggestions for this note.</Text>
            ) : (
              <>
                <Text style={styles.suggHint}>Tap a tag to add it to this note.</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.suggWrap}>
                    {suggestedTags.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={styles.suggChip}
                        activeOpacity={0.7}
                        onPress={() => addSuggestedTag(name)}>
                        <Ionicons name="add" size={15} color={Palette.primary} />
                        <Text style={styles.suggChipText}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Share modal (owner only) */}
      {isOwner ? (
        <ShareModal
          visible={shareVisible}
          noteId={id}
          onClose={() => setShareVisible(false)}
        />
      ) : null}

      {/* Email-this-note modal (Gmail via connected Google account) */}
      <Modal
        visible={emailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailVisible(false)}>
        <Pressable style={styles.tagBackdrop} onPress={() => setEmailVisible(false)} />
        <View style={styles.emailWrap} pointerEvents="box-none">
          <View style={styles.emailDialog}>
            <Text style={styles.emailTitle}>Email this note</Text>
            <TextInput
              style={styles.emailInput}
              value={emailTo}
              onChangeText={setEmailTo}
              placeholder="Recipient email"
              placeholderTextColor={Palette.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
              editable={!emailSending}
            />
            <TextInput
              style={styles.emailInput}
              value={emailSubject}
              onChangeText={setEmailSubject}
              placeholder="Subject"
              placeholderTextColor={Palette.mutedForeground}
              editable={!emailSending}
            />
            <View style={styles.emailActions}>
              <TouchableOpacity
                style={styles.emailCancel}
                onPress={() => setEmailVisible(false)}
                disabled={emailSending}
                activeOpacity={0.7}>
                <Text style={styles.emailCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emailSend}
                onPress={handleSendEmail}
                disabled={emailSending || !emailTo.trim()}
                activeOpacity={0.85}>
                {emailSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.emailSendText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled">
                  {availableTags.length === 0 ? (
                    <Text style={styles.tagSheetEmpty}>
                      All your tags are already on this note. Create a new one
                      below.
                    </Text>
                  ) : (
                    availableTags.map((tag) => (
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
                    ))
                  )}

                  {/* Create a new tag inline, then attach it to this note. */}
                  <View style={styles.tagCreateRow}>
                    <View
                      style={[styles.tagCreateDot, { backgroundColor: newTagColor }]}
                    />
                    <TextInput
                      style={styles.tagCreateInput}
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
                        style={styles.tagCreateBtn}
                        activeOpacity={0.85}
                        hitSlop={5}
                        onPress={handleCreateTag}
                        disabled={creatingTag}>
                        {creatingTag ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.tagCreateBtnText}>Add</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.tagColorPicker}>
                    {TAG_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setNewTagColor(c)}
                        hitSlop={9}
                        activeOpacity={0.7}
                        accessibilityLabel={`Pick color ${c}`}
                        style={[
                          styles.tagColorSwatch,
                          { backgroundColor: c },
                          newTagColor === c && styles.tagColorSwatchActive,
                        ]}
                      />
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
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
  wordCount: {
    fontSize: 12,
    color: Palette.mutedForeground,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  editor: { flex: 1, paddingHorizontal: 6 },

  toolbar: {
    backgroundColor: Palette.muted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
    paddingHorizontal: 4,
  },
  toolbarLabel: { fontSize: 16, fontWeight: '700' },
  toolbarDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: Palette.border,
  },

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

  // Inline tag creation (inside the tag picker)
  tagCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    marginTop: 6,
  },
  tagCreateDot: { width: 16, height: 16, borderRadius: 8 },
  tagCreateInput: {
    flex: 1,
    fontSize: 16,
    color: Palette.foreground,
    paddingVertical: 6,
  },
  tagCreateBtn: {
    backgroundColor: Palette.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  tagCreateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tagColorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingLeft: 28,
    paddingTop: 8,
  },
  tagColorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tagColorSwatchActive: { borderColor: Palette.foreground },

  // Email-this-note modal
  emailWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emailDialog: {
    width: '100%',
    backgroundColor: Palette.background,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  emailTitle: { fontSize: 17, fontWeight: '800', color: Palette.foreground },
  emailInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: Palette.foreground,
  },
  emailActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  emailCancel: {
    paddingHorizontal: 16,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  emailCancelText: { fontSize: 15, fontWeight: '600', color: Palette.mutedForeground },
  emailSend: {
    paddingHorizontal: 20,
    height: 42,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Palette.primary,
  },
  emailSendText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // AI summary + suggested tags
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: Palette.foreground,
    paddingBottom: 8,
  },
  suggHint: { fontSize: 13, color: Palette.mutedForeground, marginBottom: 10 },
  suggWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  suggChipText: { fontSize: 14, fontWeight: '600', color: Palette.primary },
});
