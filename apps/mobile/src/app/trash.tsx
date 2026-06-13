import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import { relativeTime, stripHtml } from '@/lib/format';
import type { Note } from '@/lib/types';

export default function TrashScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Note[]>('/notes/trash');
      setNotes(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = useCallback(
    async (note: Note) => {
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      try {
        await api.patch(`/notes/${note.id}/restore`);
      } catch {
        Alert.alert('Could not restore', 'Please try again.');
        void load();
      }
    },
    [load],
  );

  const handleDeleteForever = useCallback((note: Note) => {
    Alert.alert(
      'Delete forever',
      `Permanently delete "${note.title?.trim() || 'Untitled'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
            try {
              await api.delete(`/notes/${note.id}/permanent`);
            } catch {
              Alert.alert('Could not delete', 'Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const handleEmpty = useCallback(() => {
    if (notes.length === 0) return;
    Alert.alert(
      'Empty trash',
      'Permanently delete all trashed notes? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty trash',
          style: 'destructive',
          onPress: async () => {
            setNotes([]);
            try {
              await api.delete('/notes/trash');
            } catch {
              Alert.alert('Could not empty trash', 'Please try again.');
              void load();
            }
          },
        },
      ],
    );
  }, [notes.length, load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={Palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Trash</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleEmpty}
          disabled={notes.length === 0}
          activeOpacity={0.7}
          accessibilityLabel="Empty trash">
          <Ionicons
            name="trash-outline"
            size={22}
            color={notes.length === 0 ? Palette.border : Palette.destructive}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title?.trim() || 'Untitled'}
                </Text>
                <Text style={styles.cardPreview} numberOfLines={1}>
                  {stripHtml(item.content ?? '') || 'No additional text'}
                </Text>
                <Text style={styles.cardMeta}>
                  Deleted {relativeTime(item.deletedAt ?? item.updatedAt)}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.restoreBtn}
                  activeOpacity={0.8}
                  onPress={() => handleRestore(item)}>
                  <Ionicons name="arrow-undo-outline" size={16} color={Palette.primary} />
                  <Text style={styles.restoreText}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  activeOpacity={0.8}
                  hitSlop={6}
                  onPress={() => handleDeleteForever(item)}
                  accessibilityLabel="Delete forever">
                  <Ionicons name="trash" size={18} color={Palette.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trash-outline" size={48} color={Palette.border} />
              <Text style={styles.emptyTitle}>
                {error ? 'Couldn’t load trash' : 'Trash is empty'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? 'Go back and try again.'
                  : 'Deleted notes appear here and can be restored.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: Palette.foreground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12, paddingTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    padding: 14,
  },
  cardBody: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Palette.foreground },
  cardPreview: { fontSize: 13, color: Palette.mutedForeground, marginTop: 2 },
  cardMeta: { fontSize: 11, color: Palette.mutedForeground, marginTop: 4 },
  actions: { alignItems: 'flex-end', gap: 8 },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  restoreText: { fontSize: 13, fontWeight: '700', color: Palette.primary },
  deleteBtn: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: {
    fontSize: 14,
    color: Palette.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
