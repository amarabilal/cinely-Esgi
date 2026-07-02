import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { relativeTime, stripHtml } from '@/lib/format';
import type { Note } from '@/lib/types';

export function NoteCard({
  note,
  onPress,
  onLongPress,
}: {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const title = note.title?.trim() ? note.title : 'Untitled';
  const preview = stripHtml(note.content ?? '');

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}>
      <View style={styles.iconSquare}>
        <Ionicons
          name="document-text-outline"
          size={22}
          color={Palette.mutedForeground}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          {note.isPinned ? (
            <Ionicons
              name="pin"
              size={13}
              color={Palette.primary}
              style={styles.pinIcon}
            />
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.cardPreview} numberOfLines={2}>
          {preview.length > 0 ? preview : 'No additional text'}
        </Text>
      </View>
      <View style={styles.right}>
        {note.isFavorite ? (
          <Ionicons name="star" size={13} color={Palette.primary} />
        ) : null}
        <Text style={styles.timestamp}>{relativeTime(note.updatedAt)}</Text>
      </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  pinIcon: { marginRight: 4 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Palette.foreground },
  cardPreview: {
    fontSize: 13,
    color: Palette.mutedForeground,
    marginTop: 2,
    lineHeight: 18,
  },
  right: { alignItems: 'flex-end', gap: 4 },
  timestamp: { fontSize: 12, color: Palette.mutedForeground },
});
