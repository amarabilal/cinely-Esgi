import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { relativeTime, stripHtml } from '@/lib/format';
import type { Note } from '@/lib/types';

export function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const title = note.title?.trim() ? note.title : 'Untitled';
  const preview = stripHtml(note.content ?? '');

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
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
      <Text style={styles.timestamp}>{relativeTime(note.updatedAt)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
});
