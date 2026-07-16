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

import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const challenge = await login(email.trim(), password);
      if (challenge) {
        router.push({
          pathname: '/(auth)/two-factor',
          params: { tempToken: challenge.tempToken },
        });
        return;
      }
      router.replace('/(tabs)');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.wordmark}>Cinely</Text>
          <Text style={styles.subtitle}>Sign in to your notes</Text>

          <View style={styles.form}>
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
              autoComplete="password"
              editable={!loading}
              onSubmitEditing={handleSignIn}
              returnKeyType="go"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={!canSubmit}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <GoogleSignInButton onError={setError} disabled={loading} />

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.linkStrong}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.link}>
                  Don&apos;t have an account?{' '}
                  <Text style={styles.linkStrong}>Create account</Text>
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
  linkStrong: {
    fontSize: 14,
    color: Palette.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
