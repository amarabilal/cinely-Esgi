import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterSheet } from '@/components/filter-sheet';
import { NoteCard } from '@/components/note-card';
import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Note } from '@/lib/types';

type FilterKind = 'all' | 'favorites' | 'shared' | 'archived' | 'folder' | 'tag';

interface ActiveFilter {
  kind: FilterKind;
  /** Folder/tag id when kind is 'folder' | 'tag'. */
  id?: string;
  /** Display name for folder/tag. */
  name?: string;
}

/** Build the request URL for the current filter. */
function filterToRequest(filter: ActiveFilter): string {
  switch (filter.kind) {
    case 'favorites':
      return '/notes?favorite=true';
    case 'shared':
      return '/notes/shared';
    case 'archived':
      return '/notes?archived=true';
    case 'folder':
      return `/notes?folderId=${filter.id}`;
    case 'tag':
      return `/notes?tagId=${filter.id}`;
    case 'all':
    default:
      return '/notes';
  }
}

/** Header title for the current filter. */
function filterToTitle(filter: ActiveFilter): string {
  switch (filter.kind) {
    case 'favorites':
      return 'Favorites';
    case 'shared':
      return 'Shared with me';
    case 'archived':
      return 'Archived';
    case 'folder':
      return filter.name ?? 'Folder';
    case 'tag':
      return `#${filter.name ?? 'tag'}`;
    case 'all':
    default:
      return 'All notes';
  }
}

const CHIPS: { kind: FilterKind; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'favorites', label: 'Favorites', icon: 'star' },
  { kind: 'shared', label: 'Shared' },
  { kind: 'archived', label: 'Archived' },
];

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<ActiveFilter>({ kind: 'all' });
  const [sheetVisible, setSheetVisible] = useState(false);

  const loadNotes = useCallback(async (active?: ActiveFilter) => {
    const target = active ?? filter;
    const { data } = await api.get<Note[]>(filterToRequest(target));
    setNotes(data);
  }, [filter]);

  // Reload whenever the screen gains focus or the filter changes.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        try {
          const { data } = await api.get<Note[]>(filterToRequest(filter));
          if (active) {
            setNotes(data);
            setLoadError(false);
          }
        } catch {
          // leave existing list; pull-to-refresh can retry
          if (active) setLoadError(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [filter]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotes();
      setLoadError(false);
    } catch {
      // keep current list
      setLoadError(true);
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

  const isChipActive = (kind: FilterKind) => filter.kind === kind;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {filterToTitle(filter)}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreate}
          disabled={creating}
          hitSlop={4}
          activeOpacity={0.8}
          accessibilityLabel="Create note">
          {creating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Ionicons name="add" size={26} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {CHIPS.map((chip) => {
            const active = isChipActive(chip.kind);
            return (
              <TouchableOpacity
                key={chip.kind}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
                onPress={() => setFilter({ kind: chip.kind })}>
                {chip.icon ? (
                  <Ionicons
                    name={chip.icon}
                    size={14}
                    color={active ? '#ffffff' : Palette.foreground}
                    style={styles.chipIcon}
                  />
                ) : null}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Folder/tag active chip, if any */}
          {(filter.kind === 'folder' || filter.kind === 'tag') && (
            <View style={[styles.chip, styles.chipActive]}>
              <Ionicons
                name={filter.kind === 'folder' ? 'folder' : 'pricetag'}
                size={14}
                color="#ffffff"
                style={styles.chipIcon}
              />
              <Text style={[styles.chipText, styles.chipTextActive]}>
                {filter.kind === 'tag' ? `#${filter.name}` : filter.name}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.chip}
            activeOpacity={0.8}
            onPress={() => setSheetVisible(true)}>
            <Ionicons
              name="options-outline"
              size={14}
              color={Palette.foreground}
              style={styles.chipIcon}
            />
            <Text style={styles.chipText}>Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/note/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
              colors={[Palette.primary]}
            />
          }
          ListHeaderComponent={
            loadError ? (
              <Text style={styles.errorText}>
                Couldn’t load notes. Pull down to retry.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            loadError ? null : (
              <View style={styles.empty}>
                <Ionicons
                  name="document-text-outline"
                  size={48}
                  color={Palette.border}
                />
                <Text style={styles.emptyTitle}>No notes here</Text>
                <Text style={styles.emptySubtitle}>
                  {filter.kind === 'all'
                    ? 'Tap + to create your first note.'
                    : 'Nothing matches this filter yet.'}
                </Text>
              </View>
            )
          }
        />
      )}

      <FilterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelectFolder={(id, name) => {
          setFilter({ kind: 'folder', id, name });
          setSheetVisible(false);
        }}
        onSelectTag={(id, name) => {
          setFilter({ kind: 'tag', id, name });
          setSheetVisible(false);
        }}
      />
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
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: Palette.foreground,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRowWrap: { marginBottom: 4 },
  chipRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.muted,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipIcon: { marginRight: 6 },
  chipText: { fontSize: 14, fontWeight: '600', color: Palette.foreground },
  chipTextActive: { color: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: { fontSize: 14, color: Palette.mutedForeground },
  errorText: {
    fontSize: 14,
    color: Palette.destructive,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
