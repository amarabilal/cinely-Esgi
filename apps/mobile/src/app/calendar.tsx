import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { listCalendarEvents } from '@/lib/google';
import type { CalendarEvent } from '@/lib/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function eventStart(e: CalendarEvent): Date | null {
  const iso = e.start?.dateTime ?? e.start?.date;
  return iso ? new Date(iso) : null;
}

export default function CalendarScreen() {
  const router = useRouter();
  // {year, month} of the visible month.
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = new Date(cursor.year, cursor.month, 1);
      const end = new Date(cursor.year, cursor.month + 1, 0, 23, 59, 59);
      const data = await listCalendarEvents(start.toISOString(), end.toISOString());
      setEvents(data);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'Could not load calendar. Make sure Google is connected.',
      );
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const shift = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  // Group events by day-of-month.
  const grouped = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of events) {
      const d = eventStart(e);
      if (!d) continue;
      const day = d.getDate();
      const arr = map.get(day) ?? [];
      arr.push(e);
      map.set(day, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [events]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={Palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTHS[cursor.month]} {cursor.year}
        </Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={22} color={Palette.foreground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={Palette.border} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={44} color={Palette.border} />
          <Text style={styles.emptyText}>No events this month.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {grouped.map(([day, dayEvents]) => (
            <View key={day} style={styles.dayBlock}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayNum}>{day}</Text>
              </View>
              <View style={styles.dayEvents}>
                {dayEvents.map((e) => {
                  const s = eventStart(e);
                  const time = e.start?.dateTime
                    ? s?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'All day';
                  return (
                    <View key={e.id} style={styles.eventRow}>
                      <View style={styles.eventDot} />
                      <View style={styles.eventBody}>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                          {e.summary || '(no title)'}
                        </Text>
                        <Text style={styles.eventTime}>{time}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
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
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  monthLabel: { fontSize: 18, fontWeight: '700', color: Palette.foreground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { fontSize: 14, color: Palette.mutedForeground, textAlign: 'center' },
  emptyText: { fontSize: 15, color: Palette.mutedForeground },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 16, paddingTop: 4 },
  dayBlock: { flexDirection: 'row', gap: 12 },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 18, fontWeight: '800', color: Palette.foreground },
  dayEvents: { flex: 1, gap: 8 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    padding: 12,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginRight: 10,
  },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: Palette.foreground },
  eventTime: { fontSize: 12, color: Palette.mutedForeground, marginTop: 2 },
});
