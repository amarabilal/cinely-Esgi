import { Ionicons } from '@expo/vector-icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import type { NoteShare, SharePermission } from '@/lib/types';

interface ShareModalProps {
  visible: boolean;
  noteId: string;
  onClose: () => void;
}

/** Pull a human-friendly message out of an axios error. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

export function ShareModal({ visible, noteId, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('READ');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Share id currently being mutated (permission toggle / revoke). */
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<NoteShare[]>(`/notes/${noteId}/shares`);
      setShares(data);
    } catch {
      // keep whatever we had; the list just stays as-is
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    void loadShares();
  }, [visible, loadShares]);

  const handleShare = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setFormError('Enter an email address.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(`/notes/${noteId}/shares`, {
        email: trimmed,
        permission,
      });
      setEmail('');
      setPermission('READ');
      await loadShares();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not share this note.'));
    } finally {
      setSubmitting(false);
    }
  }, [email, permission, noteId, loadShares]);

  const handleTogglePermission = useCallback(
    async (share: NoteShare) => {
      const next: SharePermission = share.permission === 'WRITE' ? 'READ' : 'WRITE';
      setBusyId(share.id);
      // optimistic
      setShares((prev) =>
        prev.map((s) => (s.id === share.id ? { ...s, permission: next } : s)),
      );
      try {
        await api.patch(`/notes/${noteId}/shares/${share.id}`, { permission: next });
      } catch {
        // revert on failure
        setShares((prev) =>
          prev.map((s) =>
            s.id === share.id ? { ...s, permission: share.permission } : s,
          ),
        );
        Alert.alert('Could not update', 'Please try again.');
      } finally {
        setBusyId(null);
      }
    },
    [noteId],
  );

  const handleRevoke = useCallback(
    (share: NoteShare) => {
      Alert.alert(
        'Remove access',
        `Remove ${share.sharedWith.email} from this note?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setBusyId(share.id);
              try {
                await api.delete(`/notes/${noteId}/shares/${share.id}`);
                setShares((prev) => prev.filter((s) => s.id !== share.id));
              } catch {
                Alert.alert('Could not remove', 'Please try again.');
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [noteId],
  );

  const displayName = (s: NoteShare) => {
    const full = `${s.sharedWith.firstName ?? ''} ${s.sharedWith.lastName ?? ''}`.trim();
    return full || s.sharedWith.email;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheetWrap} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Share note</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel="Close share">
                <Ionicons name="close" size={24} color={Palette.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Invite by email */}
            <View style={styles.inviteRow}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (formError) setFormError(null);
                }}
                placeholder="Invite by email"
                placeholderTextColor={Palette.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!submitting}
                onSubmitEditing={handleShare}
              />
            </View>

            <View style={styles.permissionRow}>
              <View style={styles.segment}>
                {(['READ', 'WRITE'] as const).map((p) => {
                  const active = permission === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      activeOpacity={0.8}
                      onPress={() => setPermission(p)}>
                      <Text
                        style={[
                          styles.segmentText,
                          active && styles.segmentTextActive,
                        ]}>
                        {p === 'READ' ? 'Can view' : 'Can edit'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.shareBtn, submitting && styles.shareBtnDisabled]}
                activeOpacity={0.85}
                onPress={handleShare}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.shareBtnText}>Share</Text>
                )}
              </TouchableOpacity>
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            {/* Current collaborators */}
            <Text style={[styles.sectionTitle, styles.sectionGap]}>
              People with access
            </Text>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={Palette.primary} />
              </View>
            ) : shares.length === 0 ? (
              <Text style={styles.emptyText}>Not shared with anyone yet</Text>
            ) : (
              <ScrollView
                style={styles.list}
                showsVerticalScrollIndicator={false}>
                {shares.map((s) => (
                  <View key={s.id} style={styles.shareRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(displayName(s)[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.shareInfo}>
                      <Text style={styles.shareName} numberOfLines={1}>
                        {displayName(s)}
                      </Text>
                      <Text style={styles.shareEmail} numberOfLines={1}>
                        {s.sharedWith.email}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.permPill}
                      activeOpacity={0.7}
                      onPress={() => handleTogglePermission(s)}
                      disabled={busyId === s.id}>
                      <Text style={styles.permPillText}>
                        {s.permission === 'WRITE' ? 'Editor' : 'Viewer'}
                      </Text>
                      <Ionicons
                        name="swap-vertical"
                        size={13}
                        color={Palette.mutedForeground}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => handleRevoke(s)}
                      disabled={busyId === s.id}
                      accessibilityLabel={`Remove ${s.sharedWith.email}`}>
                      {busyId === s.id ? (
                        <ActivityIndicator size="small" color={Palette.mutedForeground} />
                      ) : (
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color={Palette.destructive}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Palette.foreground },
  inviteRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Palette.foreground,
    backgroundColor: Palette.background,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Palette.muted,
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: Palette.background },
  segmentText: { fontSize: 14, fontWeight: '600', color: Palette.mutedForeground },
  segmentTextActive: { color: Palette.foreground },
  shareBtn: {
    backgroundColor: Palette.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  formError: {
    color: Palette.destructive,
    fontSize: 13,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionGap: { marginTop: 20 },
  center: { paddingVertical: 24, alignItems: 'center' },
  list: { maxHeight: 280 },
  emptyText: { fontSize: 14, color: Palette.mutedForeground, paddingVertical: 8 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: Palette.foreground },
  shareInfo: { flex: 1 },
  shareName: { fontSize: 15, fontWeight: '600', color: Palette.foreground },
  shareEmail: { fontSize: 12, color: Palette.mutedForeground },
  permPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Palette.muted,
  },
  permPillText: { fontSize: 13, fontWeight: '600', color: Palette.foreground },
});
