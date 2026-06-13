import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import {
  addNoteToNotebook,
  chatNotebook,
  generateGuide,
  getNotebook,
  getNotebookMessages,
  removeNoteFromNotebook,
  type GuideType,
} from '@/lib/notebooks';
import { useSheetLayout } from '@/lib/sheet';
import type { Note, Notebook, NotebookMessage } from '@/lib/types';

const GUIDE_TYPES: { type: GuideType; label: string }[] = [
  { type: 'briefing', label: 'Briefing doc' },
  { type: 'study-guide', label: 'Study guide' },
  { type: 'faq', label: 'FAQ' },
  { type: 'timeline', label: 'Timeline' },
  { type: 'report', label: 'Report' },
];

export default function NotebookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sheetLayout = useSheetLayout();
  const listRef = useRef<FlatList<NotebookMessage>>(null);

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [messages, setMessages] = useState<NotebookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Add-source picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Guide generation
  const [guideVisible, setGuideVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [guide, setGuide] = useState<{ title: string; content: string } | null>(null);

  const sources = notebook?.notes ?? [];
  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);

  const load = useCallback(async () => {
    try {
      const [nb, msgs] = await Promise.all([
        getNotebook(id),
        getNotebookMessages(id),
      ]);
      setNotebook(nb);
      setMessages(msgs);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || sending) return;
    if (sourceIds.length === 0) {
      Alert.alert('Add a source', 'Add at least one note as a source before chatting.');
      return;
    }
    setInput('');
    setSending(true);
    // Optimistic user bubble.
    const optimistic: NotebookMessage = {
      id: `tmp-${Date.now()}`,
      notebookId: id,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToEnd();
    try {
      const { userMessage, assistantMessage } = await chatNotebook(id, query, sourceIds);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        userMessage,
        assistantMessage,
      ]);
      scrollToEnd();
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert(
        'Could not get a response',
        e?.response?.data?.message || 'Please try again.',
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, sourceIds, id, scrollToEnd]);

  // --- Sources ---------------------------------------------------------------
  const openPicker = useCallback(async () => {
    setPickerVisible(true);
    setNotesLoading(true);
    try {
      const { data } = await api.get<Note[]>('/notes');
      setAllNotes(data);
    } catch {
      // empty list
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const handleAddSource = useCallback(
    async (note: Note) => {
      setPickerVisible(false);
      try {
        const nb = await addNoteToNotebook(id, note.id);
        setNotebook(nb);
      } catch {
        Alert.alert('Could not add source', 'Please try again.');
      }
    },
    [id],
  );

  const handleRemoveSource = useCallback(
    (note: Note) => {
      Alert.alert('Remove source', `Remove "${note.title?.trim() || 'Untitled'}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const nb = await removeNoteFromNotebook(id, note.id);
              setNotebook(nb);
            } catch {
              Alert.alert('Could not remove', 'Please try again.');
            }
          },
        },
      ]);
    },
    [id],
  );

  const availableNotes = useMemo(
    () => allNotes.filter((n) => !sourceIds.includes(n.id)),
    [allNotes, sourceIds],
  );

  // --- Guides ----------------------------------------------------------------
  const runGenerate = useCallback(
    async (type: GuideType) => {
      if (sourceIds.length === 0) {
        Alert.alert('Add a source', 'Add at least one note before generating.');
        return;
      }
      setGuideVisible(true);
      setGuide(null);
      setGenerating(true);
      try {
        const result = await generateGuide(id, type, sourceIds);
        setGuide(result);
      } catch (e: any) {
        setGuideVisible(false);
        Alert.alert('Could not generate', e?.response?.data?.message || 'Please try again.');
      } finally {
        setGenerating(false);
      }
    },
    [id, sourceIds],
  );

  const chooseGuide = useCallback(() => {
    Alert.alert('Generate', 'Choose what to generate from your sources.', [
      ...GUIDE_TYPES.map((g) => ({ text: g.label, onPress: () => void runGenerate(g.type) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [runGenerate]);

  const saveGuideAsNote = useCallback(async () => {
    if (!guide) return;
    try {
      const { data } = await api.post<Note>('/notes', {
        title: guide.title,
        content: `<div>${guide.content.replace(/\n/g, '<br/>')}</div>`,
      });
      setGuideVisible(false);
      router.push(`/note/${data.id}`);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    }
  }, [guide, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={Palette.foreground} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {notebook?.title ?? 'Notebook'}
          </Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={chooseGuide}
            activeOpacity={0.7}
            accessibilityLabel="Generate guide">
            <Ionicons name="sparkles" size={20} color={Palette.primary} />
          </TouchableOpacity>
        </View>

        {/* Sources */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sourceBar}
          contentContainerStyle={styles.sourceBarContent}
          keyboardShouldPersistTaps="handled">
          {sources.map((s) => (
            <View key={s.id} style={styles.sourceChip}>
              <Ionicons name="document-text-outline" size={13} color={Palette.mutedForeground} />
              <Text style={styles.sourceText} numberOfLines={1}>
                {s.title?.trim() || 'Untitled'}
              </Text>
              <TouchableOpacity
                hitSlop={10}
                onPress={() => handleRemoveSource(s)}
                accessibilityLabel="Remove source">
                <Ionicons name="close" size={14} color={Palette.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addSource} activeOpacity={0.7} onPress={openPicker}>
            <Ionicons name="add" size={16} color={Palette.primary} />
            <Text style={styles.addSourceText}>Source</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Chat */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <View style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.userText}>{item.content}</Text>
              </View>
            ) : (
              <View style={[styles.bubble, styles.aiBubble]}>
                <Markdown style={markdownStyles}>{item.content}</Markdown>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={44} color={Palette.border} />
              <Text style={styles.emptyTitle}>
                {error ? 'Couldn’t load this notebook' : 'Ask your notes anything'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Add note sources above, then ask a question below.
              </Text>
            </View>
          }
        />

        {sending ? (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={Palette.primary} />
            <Text style={styles.thinkingText}>Thinking…</Text>
          </View>
        ) : null}

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: sheetLayout.paddingBottom }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your sources…"
            placeholderTextColor={Palette.mutedForeground}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Add-source picker */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              { paddingBottom: sheetLayout.paddingBottom, maxHeight: sheetLayout.maxHeight(0.75) },
            ]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Add a source</Text>
            {notesLoading ? (
              <View style={styles.sheetCenter}>
                <ActivityIndicator color={Palette.primary} />
              </View>
            ) : availableNotes.length === 0 ? (
              <Text style={styles.sheetEmpty}>No more notes to add.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {availableNotes.map((n) => (
                  <TouchableOpacity
                    key={n.id}
                    style={styles.pickRow}
                    activeOpacity={0.7}
                    onPress={() => handleAddSource(n)}>
                    <Ionicons name="document-text-outline" size={18} color={Palette.mutedForeground} />
                    <Text style={styles.pickLabel} numberOfLines={1}>
                      {n.title?.trim() || 'Untitled'}
                    </Text>
                    <Ionicons name="add" size={20} color={Palette.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Generated guide */}
      <Modal
        visible={guideVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGuideVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGuideVisible(false)} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              { paddingBottom: sheetLayout.paddingBottom, maxHeight: sheetLayout.maxHeight(0.85) },
            ]}>
            <View style={styles.grabber} />
            <View style={styles.guideHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {guide?.title ?? 'Generating…'}
              </Text>
              <TouchableOpacity onPress={() => setGuideVisible(false)} hitSlop={10} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={Palette.mutedForeground} />
              </TouchableOpacity>
            </View>
            {generating ? (
              <View style={styles.sheetCenter}>
                <ActivityIndicator color={Palette.primary} />
                <Text style={styles.thinkingText}>Generating…</Text>
              </View>
            ) : guide ? (
              <>
                <ScrollView style={styles.guideScroll} showsVerticalScrollIndicator={false}>
                  <Markdown style={markdownStyles}>{guide.content}</Markdown>
                </ScrollView>
                <TouchableOpacity style={styles.saveBtn} onPress={saveGuideAsNote} activeOpacity={0.85}>
                  <Ionicons name="save-outline" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save as note</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: { color: Palette.foreground, fontSize: 15, lineHeight: 22 },
  heading1: { color: Palette.foreground, fontSize: 20, fontWeight: '700' as const, marginTop: 8 },
  heading2: { color: Palette.foreground, fontSize: 17, fontWeight: '700' as const, marginTop: 8 },
  bullet_list: { marginVertical: 4 },
  code_inline: {
    backgroundColor: Palette.muted,
    color: Palette.foreground,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: { backgroundColor: Palette.muted, borderRadius: 8, padding: 10 },
  link: { color: Palette.primary },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: Palette.foreground, textAlign: 'center' },
  sourceBar: { flexGrow: 0, maxHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  sourceBarContent: { gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Palette.muted,
    maxWidth: 170,
  },
  sourceText: { fontSize: 13, fontWeight: '600', color: Palette.foreground, flexShrink: 1 },
  addSource: {
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
  addSourceText: { fontSize: 13, fontWeight: '600', color: Palette.primary },
  chatContent: { padding: 16, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Palette.primary },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.muted,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: {
    fontSize: 14,
    color: Palette.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  thinkingText: { fontSize: 13, color: Palette.mutedForeground },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
    backgroundColor: Palette.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: Palette.foreground,
    backgroundColor: Palette.card,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Palette.border },
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
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
  },
  sheetTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: Palette.foreground },
  sheetCenter: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  sheetEmpty: { fontSize: 14, color: Palette.mutedForeground, paddingVertical: 12 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 6,
  },
  pickLabel: { flex: 1, fontSize: 16, color: Palette.foreground },
  guideHeader: { flexDirection: 'row', alignItems: 'center' },
  guideScroll: { flexGrow: 0 },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
