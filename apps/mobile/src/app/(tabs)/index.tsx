import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadNotes = useCallback(async () => {
    const { data } = await api.get<Note[]>('/notes');
    setNotes(data);
  }, []);

  // Reload whenever the screen gains focus (e.g. coming back from the editor).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data } = await api.get<Note[]>('/notes');
          if (active) setNotes(data);
        } catch {
          // leave existing list; pull-to-refresh can retry
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotes();
    } catch {
      // ignore; keep current list
    } finally {
      setRefreshing(false);
    }
  }, [loadNotes]);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const { data } = await api.post<Note>('/notes', {});
      router.push(`/note/${data.id}`);
    } catch {
      // no-op; could surface a toast later
    } finally {
      setCreating(false);
    }
  }

  function renderItem({ item }: { item: Note }) {
    const title = item.title?.trim() ? item.title : 'Untitled';
    const preview = stripHtml(item.content ?? '');

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/note/${item.id}`)}>
        <View style={styles.iconSquare}>
          <Ionicons
            name="document-text-outline"
            size={22}
            color={Palette.mutedForeground}
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.cardPreview} numberOfLines={2}>
            {preview.length > 0 ? preview : 'No additional text'}
          </Text>
        </View>
        <Text style={styles.timestamp}>{relativeTime(item.updatedAt)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All notes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}>
          {creating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Ionicons name="add" size={26} color="#ffffff" />
          )}
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
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={Palette.border}
              />
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap + to create your first note.
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Palette.foreground },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardBody: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Palette.foreground },
  cardPreview: {
    fontSize: 13,
    color: Palette.mutedForeground,
    marginTop: 2,
    lineHeight: 18,
  },
  timestamp: { fontSize: 12, color: Palette.mutedForeground },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: { fontSize: 14, color: Palette.mutedForeground },
});
