/**
 * "Continue with Google" button for the auth screens. Owns its own loading
 * state, runs the OAuth sign-in via the auth store, and on success navigates
 * to the app. Renders an "or" divider above itself, mirroring the web login.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';

type Props = { onError: (message: string) => void; disabled?: boolean };

export function GoogleSignInButton({ onError, disabled }: Props) {
  const router = useRouter();
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [loading, setLoading] = useState(false);

  const isDisabled = disabled || loading;

  async function handlePress() {
    if (isDisabled) return;
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.status === 'success') {
        router.replace('/(tabs)');
      } else if (result.status === 'error') {
        onError(result.message);
      }
      // 'cancelled' → silently re-enable, no error shown.
    } catch {
      // establishSession can reject after tokens persist (e.g. the /auth/me
      // fetch fails); surface it instead of an unhandled rejection.
      onError('Sign-in failed, please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.button, isDisabled && styles.buttonDisabled]}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.85}>
        {loading ? (
          <ActivityIndicator color={Palette.foreground} />
        ) : (
          <View style={styles.content}>
            <Text style={styles.mark}>G</Text>
            <Text style={styles.buttonText}>Continue with Google</Text>
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Palette.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: Palette.mutedForeground,
  },
  button: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285f4',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.foreground,
  },
});
