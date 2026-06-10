import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoteCard } from '@/components/note-card';
import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Note } from '@/lib/types';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  /** True once a search has run, so we can show "No results" instead of the
   * initial prompt. */
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await api.get<Note[]>('/notes/search', {
          params: { q: trimmed },
        });
        if (active) {
          setResults(data);
          setSearched(true);
        }
      } catch {
        if (active) {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const inputRef = useRef<TextInput>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={18}
            color={Palette.mutedForeground}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search your notes"
            placeholderTextColor={Palette.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search">
              <Ionicons
                name="close-circle"
                size={18}
                color={Palette.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(n) => n.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/note/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={searched ? 'document-text-outline' : 'search'}
                size={48}
                color={Palette.border}
              />
              <Text style={styles.emptyTitle}>
                {searched ? 'No results' : 'Search your notes'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searched
                  ? 'Try a different keyword.'
                  : 'Find notes by title or content.'}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Palette.foreground },
  searchBarWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.muted,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    color: Palette.foreground,
    paddingVertical: 0,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  emptySubtitle: { fontSize: 14, color: Palette.mutedForeground },
});
