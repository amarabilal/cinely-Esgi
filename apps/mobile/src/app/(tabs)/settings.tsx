import { Ionicons } from '@expo/vector-icons';
import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import {
  connectGoogle,
  disconnectGoogle,
  getGoogleStatus,
} from '@/lib/google';
import { registerForPush, type PushResult } from '@/lib/push';
import type { GoogleStatus, User } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';

/** GET /settings/profile shape (includes the 2FA flag /auth/me omits). */
interface SettingsProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  totpEnabled: boolean;
}

/** POST /settings/2fa/setup response. */
interface TotpSetupResponse {
  secret: string;
  /** data-URL PNG of the otpauth QR. */
  qrDataUrl: string;
}

/** POST /settings/2fa/enable response. */
interface TotpEnableResponse {
  message: string;
  recoveryCodes: string[];
}

/** Pull a human-readable message out of an axios error. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  return fallback;
}

const PASSWORD_HINT =
  'At least 12 characters, including letters, digits and symbols.';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const [loggingOut, setLoggingOut] = useState(false);

  // --- Google integration state ---
  const [google, setGoogle] = useState<GoogleStatus>({ connected: false });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // --- Profile edit state ---
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // --- Change password state ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // --- 2FA state ---
  const [totpEnabled, setTotpEnabled] = useState(false);
  /** Active setup payload (QR + secret) once "Set up 2FA" is tapped. */
  const [totpSetup, setTotpSetup] = useState<TotpSetupResponse | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  /** Drives the "Disable 2FA" code prompt. */
  const [disablingTotp, setDisablingTotp] = useState(false);

  // --- Push notifications state ---
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushResult['status'] | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  // Fetch the 2FA flag (the /auth/me user object doesn't carry it).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get<SettingsProfile>('/settings/profile');
        if (active) setTotpEnabled(data.totpEnabled);
      } catch {
        // leave as-is; 2FA card still renders a "Set up" affordance
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load Google connection status on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await getGoogleStatus();
        if (active) setGoogle(status);
      } catch {
        // leave disconnected
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleConnectGoogle() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const result = await connectGoogle();
      if (result.status === 'success') {
        setGoogle(await getGoogleStatus());
      } else if (result.status === 'error') {
        setGoogleError(result.message);
      }
      // 'cancelled' -> silently do nothing
    } catch {
      setGoogleError('Could not connect Google.');
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleDisconnectGoogle() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      await disconnectGoogle();
      setGoogle({ connected: false });
    } catch {
      setGoogleError('Could not disconnect Google.');
    } finally {
      setGoogleBusy(false);
    }
  }

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

  function startEditing() {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setProfileError(null);
    setProfileSaved(false);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setProfileError(null);
  }

  async function handleSaveProfile() {
    if (savingProfile) return;
    setProfileError(null);
    setProfileSaved(false);

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First and last name are required.');
      return;
    }

    setSavingProfile(true);
    try {
      const { data } = await api.put<User>('/settings/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setUser(data);
      setEditing(false);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(errorMessage(err, 'Could not update your profile.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleUpdatePassword() {
    if (savingPassword) return;
    setPasswordError(null);
    setPasswordSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/settings/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(errorMessage(err, 'Could not update your password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  // --- 2FA handlers ---
  async function handleSetupTotp() {
    if (totpBusy) return;
    setTotpError(null);
    setRecoveryCodes(null);
    setTotpCode('');
    setTotpBusy(true);
    try {
      const { data } = await api.post<TotpSetupResponse>('/settings/2fa/setup');
      setTotpSetup(data);
    } catch (err) {
      setTotpError(errorMessage(err, 'Could not start 2FA setup.'));
    } finally {
      setTotpBusy(false);
    }
  }

  async function handleEnableTotp() {
    if (totpBusy) return;
    setTotpError(null);
    if (totpCode.trim().length !== 6) {
      setTotpError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setTotpBusy(true);
    try {
      const { data } = await api.post<TotpEnableResponse>('/settings/2fa/enable', {
        code: totpCode.trim(),
      });
      setRecoveryCodes(data.recoveryCodes ?? []);
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode('');
    } catch (err) {
      setTotpError(errorMessage(err, 'Could not enable 2FA. Check the code.'));
    } finally {
      setTotpBusy(false);
    }
  }

  async function handleDisableTotp() {
    if (totpBusy) return;
    setTotpError(null);
    if (totpCode.trim().length !== 6) {
      setTotpError('Enter a current 6-digit code to disable 2FA.');
      return;
    }
    setTotpBusy(true);
    try {
      await api.post('/settings/2fa/disable', { code: totpCode.trim() });
      setTotpEnabled(false);
      setDisablingTotp(false);
      setTotpCode('');
      setRecoveryCodes(null);
    } catch (err) {
      setTotpError(errorMessage(err, 'Could not disable 2FA. Check the code.'));
    } finally {
      setTotpBusy(false);
    }
  }

  function cancelTotp() {
    setTotpSetup(null);
    setDisablingTotp(false);
    setTotpCode('');
    setTotpError(null);
  }

  // --- Push handler ---
  async function handleEnablePush() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMessage(null);
    try {
      const result = await registerForPush();
      setPushStatus(result.status);
      if (result.status === 'registered') {
        setPushMessage('Notifications enabled on this device.');
      } else if (result.status === 'denied') {
        setPushMessage('Permission denied. Enable notifications in system settings.');
      } else {
        // Graceful no-op path (Expo Go / no Firebase / emulator).
        setPushMessage(result.reason);
      }
    } catch {
      // registerForPush never throws, but stay defensive.
      setPushStatus('unavailable');
      setPushMessage('Push needs a production build with Firebase.');
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Settings</Text>

          {/* User card */}
          {user ? (
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') || '?'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {user.firstName} {user.lastName}
                </Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
          ) : null}

          {/* Profile section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Profile</Text>
              {!editing ? (
                <TouchableOpacity
                  onPress={startEditing}
                  activeOpacity={0.7}
                  hitSlop={12}>
                  <Text style={styles.editLink}>Edit profile</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {editing ? (
              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor={Palette.mutedForeground}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  editable={!savingProfile}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Last name"
                  placeholderTextColor={Palette.mutedForeground}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  editable={!savingProfile}
                />
                {profileError ? (
                  <Text style={styles.error}>{profileError}</Text>
                ) : null}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={cancelEditing}
                    disabled={savingProfile}
                    activeOpacity={0.85}>
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={handleSaveProfile}
                    disabled={savingProfile}
                    activeOpacity={0.85}>
                    {savingProfile ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.buttonPrimaryText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>
                    {user ? `${user.firstName} ${user.lastName}` : '—'}
                  </Text>
                </View>
                <View style={[styles.infoRow, styles.rowDivider]}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {user?.email ?? '—'}
                  </Text>
                </View>
                {profileSaved ? (
                  <Text style={styles.success}>Profile updated.</Text>
                ) : null}
              </View>
            )}
          </View>

          {/* Account info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <View style={[styles.infoRow, styles.accountRow]}>
              <Text style={styles.infoLabel}>Email status</Text>
              <View
                style={[
                  styles.badge,
                  user?.isEmailVerified ? styles.badgeOk : styles.badgeWarn,
                ]}>
                <Ionicons
                  name={
                    user?.isEmailVerified
                      ? 'checkmark-circle'
                      : 'alert-circle-outline'
                  }
                  size={14}
                  color={user?.isEmailVerified ? '#16a34a' : '#b45309'}
                  style={styles.badgeIcon}
                />
                <Text
                  style={[
                    styles.badgeText,
                    user?.isEmailVerified
                      ? styles.badgeTextOk
                      : styles.badgeTextWarn,
                  ]}>
                  {user?.isEmailVerified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            </View>
          </View>

          {/* Change password */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change password</Text>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={Palette.mutedForeground}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!savingPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={Palette.mutedForeground}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!savingPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={Palette.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!savingPassword}
              />
              <Text style={styles.hint}>{PASSWORD_HINT}</Text>
              {passwordError ? (
                <Text style={styles.error}>{passwordError}</Text>
              ) : null}
              {passwordSaved ? (
                <Text style={styles.success}>Password updated.</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.fullButton, styles.buttonPrimary]}
                onPress={handleUpdatePassword}
                disabled={savingPassword}
                activeOpacity={0.85}>
                {savingPassword ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Update password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Two-factor authentication */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Two-factor authentication</Text>
              <View
                style={[
                  styles.badge,
                  totpEnabled ? styles.badgeOk : styles.badgeWarn,
                ]}>
                <Text
                  style={[
                    styles.badgeText,
                    totpEnabled ? styles.badgeTextOk : styles.badgeTextWarn,
                  ]}>
                  {totpEnabled ? 'On' : 'Off'}
                </Text>
              </View>
            </View>

            {/* Recovery codes shown right after enabling. */}
            {recoveryCodes ? (
              <View style={styles.totpBlock}>
                <Text style={styles.success}>
                  2FA enabled. Save these recovery codes somewhere safe — each
                  works once if you lose your authenticator.
                </Text>
                <View style={styles.codeGrid}>
                  {recoveryCodes.map((c) => (
                    <Text key={c} style={styles.code} selectable>
                      {c}
                    </Text>
                  ))}
                </View>
                <Text style={styles.hint}>
                  Long-press a code to copy it.
                </Text>
              </View>
            ) : totpSetup ? (
              /* Setup in progress: show QR + secret + confirm code input. */
              <View style={styles.totpBlock}>
                <Text style={styles.hint}>
                  Scan this QR with Google Authenticator (or any TOTP app), then
                  enter the 6-digit code to confirm.
                </Text>
                <View style={styles.qrWrap}>
                  <Image
                    source={{ uri: totpSetup.qrDataUrl }}
                    style={styles.qr}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.secretLabel}>Or enter this key manually:</Text>
                <Text style={styles.code} selectable>
                  {totpSetup.secret}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor={Palette.mutedForeground}
                  value={totpCode}
                  onChangeText={setTotpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!totpBusy}
                />
                {totpError ? <Text style={styles.error}>{totpError}</Text> : null}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={cancelTotp}
                    disabled={totpBusy}
                    activeOpacity={0.85}>
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={handleEnableTotp}
                    disabled={totpBusy}
                    activeOpacity={0.85}>
                    {totpBusy ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.buttonPrimaryText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : disablingTotp ? (
              /* Disable flow: confirm with a current code. */
              <View style={styles.totpBlock}>
                <Text style={styles.hint}>
                  Enter a current 6-digit code to turn off 2FA.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor={Palette.mutedForeground}
                  value={totpCode}
                  onChangeText={setTotpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!totpBusy}
                />
                {totpError ? <Text style={styles.error}>{totpError}</Text> : null}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={cancelTotp}
                    disabled={totpBusy}
                    activeOpacity={0.85}>
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonDestructive]}
                    onPress={handleDisableTotp}
                    disabled={totpBusy}
                    activeOpacity={0.85}>
                    {totpBusy ? (
                      <ActivityIndicator color={Palette.destructive} />
                    ) : (
                      <Text style={styles.buttonDestructiveText}>Disable</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Idle: show the enable / disable entry point. */
              <View style={styles.totpBlock}>
                <Text style={styles.hint}>
                  {totpEnabled
                    ? 'Your account is protected with an authenticator app.'
                    : 'Add a second step at login using an authenticator app.'}
                </Text>
                {totpError ? <Text style={styles.error}>{totpError}</Text> : null}
                {totpEnabled ? (
                  <TouchableOpacity
                    style={[styles.fullButton, styles.buttonSecondary]}
                    onPress={() => {
                      setTotpError(null);
                      setTotpCode('');
                      setDisablingTotp(true);
                    }}
                    activeOpacity={0.85}>
                    <Text style={styles.buttonDestructiveText}>Disable 2FA</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.fullButton, styles.buttonPrimary]}
                    onPress={handleSetupTotp}
                    disabled={totpBusy}
                    activeOpacity={0.85}>
                    {totpBusy ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.buttonPrimaryText}>Set up 2FA</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Push notifications */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <Switch
                value={pushStatus === 'registered'}
                onValueChange={(v) => {
                  if (v) void handleEnablePush();
                }}
                disabled={pushBusy || pushStatus === 'registered'}
                trackColor={{ true: Palette.primary, false: Palette.border }}
              />
            </View>
            <Text style={styles.hint}>
              Get push notifications for shared notes and updates. Delivery
              requires a production/dev build with Firebase configured; in Expo
              Go this is a no-op.
            </Text>
            {pushBusy ? (
              <ActivityIndicator
                color={Palette.primary}
                style={styles.pushSpinner}
              />
            ) : null}
            {pushMessage ? (
              <Text
                style={
                  pushStatus === 'registered' ? styles.success : styles.hint
                }>
                {pushMessage}
              </Text>
            ) : null}
          </View>

          {/* Google integration */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Google</Text>
              <View
                style={[
                  styles.badge,
                  google.connected ? styles.badgeOk : styles.badgeWarn,
                ]}>
                <Text
                  style={[
                    styles.badgeText,
                    google.connected ? styles.badgeTextOk : styles.badgeTextWarn,
                  ]}>
                  {google.connected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
            <Text style={styles.hint}>
              {google.connected
                ? `Connected as ${google.email ?? 'your Google account'}. Export notes to Drive, sync to Calendar, and send via Gmail.`
                : 'Connect your Google account to export notes to Drive, sync to Calendar, and send via Gmail.'}
            </Text>
            {googleError ? <Text style={styles.error}>{googleError}</Text> : null}

            {google.connected ? (
              <View style={styles.googleActions}>
                <TouchableOpacity
                  style={[styles.fullButton, styles.buttonSecondary]}
                  onPress={() => router.push('/calendar')}
                  activeOpacity={0.85}>
                  <Text style={styles.buttonSecondaryText}>Open Calendar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fullButton, styles.buttonDestructive]}
                  onPress={handleDisconnectGoogle}
                  disabled={googleBusy}
                  activeOpacity={0.85}>
                  {googleBusy ? (
                    <ActivityIndicator color={Palette.destructive} />
                  ) : (
                    <Text style={styles.buttonDestructiveText}>Disconnect</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.fullButton, styles.buttonPrimary, styles.googleConnect]}
                onPress={handleConnectGoogle}
                disabled={googleBusy}
                activeOpacity={0.85}>
                {googleBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={16} color="#ffffff" />
                    <Text style={styles.buttonPrimaryText}>Connect Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Log out */}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: Palette.foreground },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.muted,
    borderRadius: 14,
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: Palette.foreground },
  userEmail: { fontSize: 14, color: Palette.mutedForeground, marginTop: 2 },

  card: {
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Palette.foreground },
  editLink: { fontSize: 14, fontWeight: '600', color: Palette.primary },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  accountRow: { paddingBottom: 0 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Palette.border },
  infoLabel: { fontSize: 14, color: Palette.mutedForeground },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.foreground,
    marginLeft: 16,
    flexShrink: 1,
    textAlign: 'right',
  },

  form: { gap: 12, marginTop: 14 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Palette.foreground,
    backgroundColor: Palette.card,
  },
  hint: { fontSize: 12, color: Palette.mutedForeground, lineHeight: 16 },
  error: { color: Palette.destructive, fontSize: 14 },
  success: { color: '#16a34a', fontSize: 14, marginTop: 10, fontWeight: '600' },

  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  fullButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: Palette.primary },
  buttonPrimaryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  buttonSecondary: {
    backgroundColor: Palette.muted,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  buttonSecondaryText: {
    color: Palette.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDestructive: {
    backgroundColor: Palette.muted,
    borderWidth: 1,
    borderColor: Palette.destructive,
  },
  buttonDestructiveText: {
    color: Palette.destructive,
    fontSize: 15,
    fontWeight: '600',
  },

  // 2FA
  totpBlock: { gap: 12, marginTop: 14 },
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  qr: { width: 180, height: 180 },
  secretLabel: { fontSize: 13, color: Palette.mutedForeground },
  codeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 14,
    fontWeight: '700',
    color: Palette.foreground,
    backgroundColor: Palette.muted,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pushSpinner: { marginTop: 10, alignSelf: 'flex-start' },
  googleActions: { gap: 10, marginTop: 14 },
  googleConnect: { flexDirection: 'row', gap: 8, marginTop: 14 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
  },
  badgeIcon: { marginRight: 4 },
  badgeOk: { backgroundColor: '#dcfce7' },
  badgeWarn: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 13, fontWeight: '600' },
  badgeTextOk: { color: '#16a34a' },
  badgeTextWarn: { color: '#b45309' },

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
