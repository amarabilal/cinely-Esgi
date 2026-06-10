import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // The AuthGate redirects to login once status becomes unauthenticated.
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        {user ? (
          <View style={styles.userCard}>
            <Text style={styles.userName}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.85}>
          {loggingOut ? (
            <ActivityIndicator color={Palette.destructive} />
          ) : (
            <Text style={styles.logoutText}>Log out</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', color: Palette.foreground },
  userCard: {
    backgroundColor: Palette.muted,
    borderRadius: 14,
    padding: 16,
  },
  userName: { fontSize: 16, fontWeight: '700', color: Palette.foreground },
  userEmail: { fontSize: 14, color: Palette.mutedForeground, marginTop: 2 },
  logoutButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: Palette.destructive, fontSize: 16, fontWeight: '600' },
});
