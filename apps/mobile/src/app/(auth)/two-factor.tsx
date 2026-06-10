import { Link, useLocalSearchParams } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';

export default function TwoFactorScreen() {
  const router = useRouter();
  const verify2fa = useAuthStore((s) => s.verify2fa);
  const params = useLocalSearchParams<{ tempToken?: string }>();
  const tempToken = params.tempToken ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (loading) return;
    setError(null);

    if (!tempToken) {
      setError('Your session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      await verify2fa(tempToken, code.trim());
      router.replace('/(tabs)');
    } catch {
      setError('That code did not work. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = code.trim().length > 0 && tempToken.length > 0 && !loading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.wordmark}>Cinely</Text>
          <Text style={styles.subtitle}>Enter your authentication code</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="6-digit or recovery code"
              placeholderTextColor={Palette.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="one-time-code"
              editable={!loading}
              onSubmitEditing={handleVerify}
              returnKeyType="go"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!canSubmit}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.link}>Cancel</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  wordmark: {
    fontSize: 40,
    fontWeight: '800',
    color: Palette.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Palette.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  form: { gap: 14 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Palette.foreground,
    backgroundColor: Palette.card,
  },
  error: {
    color: Palette.destructive,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  link: {
    fontSize: 14,
    color: Palette.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
