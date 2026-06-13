import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
} from '@/lib/notebooks';
import { useSheetLayout } from '@/lib/sheet';
import type { Notebook } from '@/lib/types';

export default function NotebooksScreen() {
  const router = useRouter();
  const sheetLayout = useSheetLayout();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listNotebooks();
      setNotebooks(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (creating) return;
    setCreating(true);
    try {
      const nb = await createNotebook(title || 'Untitled Notebook');
      setCreateVisible(false);
      setNewTitle('');
      router.push(`/notebook/${nb.id}`);
    } catch {
      Alert.alert('Could not create notebook', 'Please try again.');
    } finally {
      setCreating(false);
    }
  }, [newTitle, creating, router]);

  const confirmDelete = useCallback(
    (nb: Notebook) => {
      Alert.alert('Delete notebook', `Delete "${nb.title}"? Your notes are kept.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setNotebooks((prev) => prev.filter((n) => n.id !== nb.id));
            try {
              await deleteNotebook(nb.id);
            } catch {
              Alert.alert('Could not delete', 'Please try again.');
              void load();
            }
          },
        },
      ]);
    },
    [load],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notebooks</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setCreateVisible(true)}
          hitSlop={4}
          activeOpacity={0.8}
          accessibilityLabel="Create notebook">
          <Ionicons name="add" size={26} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={notebooks}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
              colors={[Palette.primary]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/notebook/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={300}>
              <View style={styles.cardIcon}>
                <Ionicons name="sparkles-outline" size={22} color={Palette.primary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  Updated {relativeTime(item.updatedAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Palette.mutedForeground} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={48} color={Palette.border} />
              <Text style={styles.emptyTitle}>
                {error ? 'Couldn’t load notebooks' : 'No notebooks yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? 'Pull down to retry.'
                  : 'Create a notebook to chat with your notes using AI.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={createVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateVisible(false)} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              { paddingBottom: sheetLayout.paddingBottom },
            ]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>New notebook</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Notebook title"
              placeholderTextColor={Palette.mutedForeground}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              editable={!creating}
            />
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}>
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  cardIcon: {
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
  cardMeta: { fontSize: 12, color: Palette.mutedForeground, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: {
    fontSize: 14,
    color: Palette.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
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
    gap: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Palette.foreground },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Palette.foreground,
  },
  createBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
