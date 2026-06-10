import { Ionicons } from '@expo/vector-icons';
import { AxiosError } from 'axios';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';

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
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const [loggingOut, setLoggingOut] = useState(false);

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
                <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
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
