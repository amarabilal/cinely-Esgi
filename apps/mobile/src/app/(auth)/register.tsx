import { AxiosError } from 'axios';
import { Link, useRouter } from 'expo-router';
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

/** Pulls a server-provided validation message out of an axios error, if any. */
function serverMessage(err: unknown): string | null {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message[0] : data.message;
    }
  }
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      router.replace('/(tabs)');
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      if (status === 409) {
        setError('That email is already in use.');
      } else {
        setError(serverMessage(err) ?? 'Could not create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !loading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.wordmark}>Cinely</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={Palette.mutedForeground}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={Palette.mutedForeground}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Palette.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Palette.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!loading}
              onSubmitEditing={handleCreate}
              returnKeyType="go"
            />

            <Text style={styles.hint}>
              At least 12 characters, with letters, digits, and symbols.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={!canSubmit}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.link}>
                  Already have an account? <Text style={styles.linkStrong}>Sign in</Text>
                </Text>
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
  hint: {
    fontSize: 13,
    color: Palette.mutedForeground,
    textAlign: 'center',
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
    color: Palette.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  linkStrong: { color: Palette.primary, fontWeight: '600' },
});
