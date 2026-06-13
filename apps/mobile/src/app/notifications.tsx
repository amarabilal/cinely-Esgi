import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/lib/types';
import { useNotificationsStore } from '@/stores/notifications';

const ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  SHARE: 'person-add-outline',
  EDIT: 'create-outline',
  SYSTEM: 'information-circle-outline',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const unread = useNotificationsStore((s) => s.unread);
  const load = useNotificationsStore((s) => s.load);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);

  useEffect(() => {
    void load();
  }, [load]);

  const onPress = useCallback(
    (n: AppNotification) => {
      if (!n.read) void markRead(n.id);
      const noteId = n.metadata?.noteId;
      if (noteId) router.push(`/note/${noteId}`);
    },
    [markRead, router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={Palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          style={styles.markAll}
          onPress={() => markAllRead()}
          disabled={unread === 0}
          hitSlop={6}
          activeOpacity={0.7}>
          <Text
            style={[styles.markAllText, unread === 0 && styles.markAllDisabled]}>
            Mark all
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={Palette.primary}
            colors={[Palette.primary]}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.rowUnread]}
            activeOpacity={0.7}
            onPress={() => onPress(item)}>
            <View style={styles.rowIcon}>
              <Ionicons
                name={ICON[item.type] ?? 'notifications-outline'}
                size={20}
                color={Palette.primary}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowMessage} numberOfLines={3}>
                {item.message}
              </Text>
              <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
            </View>
            {!item.read ? <View style={styles.unreadDot} /> : null}
            <TouchableOpacity
              style={styles.deleteBtn}
              hitSlop={8}
              activeOpacity={0.7}
              onPress={() => remove(item.id)}
              accessibilityLabel="Dismiss notification">
              <Ionicons name="close" size={18} color={Palette.mutedForeground} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={Palette.border}
            />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              You’ll see shares and updates to your notes here.
            </Text>
          </View>
        }
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
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: Palette.foreground },
  markAll: { paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  markAllText: { fontSize: 14, fontWeight: '600', color: Palette.primary },
  markAllDisabled: { color: Palette.mutedForeground },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    padding: 14,
  },
  rowUnread: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1, marginRight: 8 },
  rowMessage: { fontSize: 14, color: Palette.foreground, lineHeight: 19 },
  rowTime: { fontSize: 12, color: Palette.mutedForeground, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginRight: 8,
  },
  deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 90, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: {
    fontSize: 14,
    color: Palette.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
