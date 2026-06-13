import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { NotesStats } from '@/lib/types';

interface StatCardConfig {
  key: keyof Pick<
    NotesStats,
    'totalNotes' | 'favoriteNotes' | 'archivedNotes' | 'sharedByMe' | 'sharedWithMe'
  >;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STAT_CARDS: StatCardConfig[] = [
  { key: 'totalNotes', label: 'Total notes', icon: 'document-text-outline' },
  { key: 'favoriteNotes', label: 'Favorites', icon: 'star-outline' },
  { key: 'archivedNotes', label: 'Archived', icon: 'archive-outline' },
  { key: 'sharedByMe', label: 'Shared by me', icon: 'share-social-outline' },
  { key: 'sharedWithMe', label: 'Shared with me', icon: 'people-outline' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<NotesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    const { data } = await api.get<NotesStats>('/notes/stats');
    setStats(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        try {
          const { data } = await api.get<NotesStats>('/notes/stats');
          if (active) {
            setStats(data);
            setLoadError(false);
          }
        } catch {
          // keep any previous stats; pull-to-refresh can retry
          if (active) setLoadError(true);
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
      await fetchStats();
      setLoadError(false);
    } catch {
      // keep current view
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchStats]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      {loading && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
              colors={[Palette.primary]}
            />
          }>
          {loadError ? (
            <Text style={styles.errorText}>
              Couldn’t load stats. Pull down to retry.
            </Text>
          ) : null}

          {/* Stat cards grid */}
          <View style={styles.grid}>
            {STAT_CARDS.map((card) => (
              <View key={card.key} style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name={card.icon} size={18} color={Palette.primary} />
                </View>
                <Text style={styles.statNumber}>{stats?.[card.key] ?? 0}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent notes */}
          <Text style={styles.sectionTitle}>Recent</Text>
          <View style={styles.sectionCard}>
            {stats && stats.recentNotes.length > 0 ? (
              stats.recentNotes.map((note, index) => (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.recentRow, index > 0 && styles.rowDivider]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/note/${note.id}`)}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={Palette.mutedForeground}
                    style={styles.recentIcon}
                  />
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {note.title?.trim() ? note.title : 'Untitled'}
                  </Text>
                  <Text style={styles.recentTime}>
                    {relativeTime(note.updatedAt)}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent notes yet.</Text>
            )}
          </View>

          {/* Top tags */}
          <Text style={styles.sectionTitle}>Top tags</Text>
          {stats && stats.topTags.length > 0 ? (
            <View style={styles.tagWrap}>
              {stats.topTags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <View
                    style={[styles.tagDot, { backgroundColor: tag.color || Palette.primary }]}
                  />
                  <Text style={styles.tagName}>{tag.name}</Text>
                  <Text style={styles.tagCount}>{tag.noteCount}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.emptyText}>No tags yet.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Palette.foreground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    // two columns: half the row minus the 12px gap
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: Palette.foreground },
  statLabel: { fontSize: 13, color: Palette.mutedForeground, marginTop: 2 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: Palette.border },
  recentIcon: { marginRight: 12 },
  recentTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.foreground,
    marginRight: 10,
  },
  recentTime: { fontSize: 12, color: Palette.mutedForeground },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.muted,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tagDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  tagName: { fontSize: 14, fontWeight: '600', color: Palette.foreground },
  tagCount: {
    fontSize: 13,
    color: Palette.mutedForeground,
    marginLeft: 6,
    fontWeight: '600',
  },

  emptyText: {
    fontSize: 14,
    color: Palette.mutedForeground,
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 14,
    color: Palette.destructive,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
