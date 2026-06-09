<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useAppLock } from '@/composables/useAppLock';
import { isNative } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const store = useSettingsStore();

// Biometric app lock (native only; toggle hidden unless hardware is available).
const appLock = useAppLock();
const appLockEnabled = ref(appLock.isEnabled());
async function toggleAppLock(value: boolean) {
  await appLock.setEnabled(value);
  appLockEnabled.value = appLock.isEnabled();
}

const activeTab = ref<'profile' | 'security' | 'sessions'>('profile');

// Profile
const firstName = ref('');
const lastName = ref('');
const profileSuccess = ref('');
const profileError = ref('');
const profileLoading = ref(false);

// Password
const currentPassword = ref('');
const newPassword = ref('');
const passwordSuccess = ref('');
const passwordError = ref('');
const passwordLoading = ref(false);

// 2FA setup state
const totpStep = ref<'idle' | 'setup' | 'confirm'>('idle');
const qrDataUrl = ref('');
const totpSecret = ref('');
const totpCode = ref('');
const totpError = ref('');
const totpSuccess = ref('');
const recoveryCodes = ref<string[]>([]);

// Disable 2FA
const disableCode = ref('');
const disableError = ref('');

onMounted(async () => {
  await store.fetchProfile();
  await store.fetchSessions();
  if (store.profile) {
    firstName.value = store.profile.firstName;
    lastName.value = store.profile.lastName;
  }
});

async function saveProfile() {
  profileError.value = '';
  profileSuccess.value = '';
  profileLoading.value = true;
  try {
    await store.updateProfile(firstName.value, lastName.value);
    profileSuccess.value = 'Profile updated.';
  } catch {
    profileError.value = 'Failed to update profile.';
  } finally {
    profileLoading.value = false;
  }
}

async function changePassword() {
  passwordError.value = '';
  passwordSuccess.value = '';
  passwordLoading.value = true;
  try {
    await store.changePassword(currentPassword.value, newPassword.value);
    passwordSuccess.value = 'Password changed.';
    currentPassword.value = '';
    newPassword.value = '';
  } catch (e: any) {
    passwordError.value = e.response?.data?.message || 'Failed to change password.';
  } finally {
    passwordLoading.value = false;
  }
}

async function startTotpSetup() {
  totpError.value = '';
  const { secret, qrDataUrl: url } = await store.setupTotp();
  qrDataUrl.value = url;
  totpSecret.value = secret;
  totpStep.value = 'setup';
}

async function enableTotp() {
  totpError.value = '';
  try {
    const codes = await store.enableTotp(totpCode.value);
    totpStep.value = 'idle';
    totpCode.value = '';
    totpSuccess.value = '2FA enabled successfully.';
    if (codes?.length) recoveryCodes.value = codes;
  } catch (e: any) {
    totpError.value = e.response?.data?.message || 'Invalid code.';
  }
}

function cancelTotpSetup() {
  totpStep.value = 'idle';
  totpCode.value = '';
  totpError.value = '';
  qrDataUrl.value = '';
  totpSecret.value = '';
}

async function disableTotp() {
  disableError.value = '';
  try {
    await store.disableTotp(disableCode.value);
    disableCode.value = '';
    totpSuccess.value = '2FA disabled.';
  } catch (e: any) {
    disableError.value = e.response?.data?.message || 'Invalid code.';
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-background text-foreground">
    <div class="mx-auto max-w-4xl px-6 py-8">
      <!-- Page header -->
      <header class="mb-8">
        <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Account</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
      </header>

      <!-- Tabs -->
      <div class="flex gap-1 mb-8 bg-muted rounded-xl p-1 max-w-md">
        <button v-for="[key, label] in [['profile', 'Profile'], ['security', 'Security'], ['sessions', 'Sessions']]"
          :key="key"
          @click="activeTab = key as any"
          class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="activeTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
          {{ label }}
        </button>
      </div>

      <!-- Profile Tab -->
      <div v-if="activeTab === 'profile'" class="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 class="text-base font-semibold text-foreground">Personal Information</h2>
        <p v-if="store.profile" class="text-sm text-muted-foreground">{{ store.profile.email }}</p>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">First name</label>
            <input v-model="firstName" type="text"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">Last name</label>
            <input v-model="lastName" type="text"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>
        </div>

        <p v-if="profileSuccess" class="text-sm text-primary">{{ profileSuccess }}</p>
        <p v-if="profileError" class="text-sm text-destructive">{{ profileError }}</p>

        <Button :disabled="profileLoading" @click="saveProfile">
          {{ profileLoading ? 'Saving…' : 'Save changes' }}
        </Button>
      </div>

      <!-- Security Tab -->
      <div v-if="activeTab === 'security'" class="space-y-6">
        <!-- App Lock (native + biometric hardware available only) -->
        <div v-if="isNative && appLock.available.value" class="bg-card border border-border rounded-xl p-6 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-base font-semibold text-foreground">App Lock</h2>
              <p class="text-sm text-muted-foreground mt-0.5">Require Face ID / fingerprint to open the app.</p>
            </div>
            <label class="relative inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                class="peer sr-only"
                :checked="appLockEnabled"
                @change="toggleAppLock(($event.target as HTMLInputElement).checked)" />
              <span
                class="h-6 w-11 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"></span>
              <span
                class="absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5"></span>
            </label>
          </div>
        </div>

        <!-- Change Password -->
        <div class="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 class="text-base font-semibold text-foreground">Change Password</h2>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">Current password</label>
            <input v-model="currentPassword" type="password"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">New password</label>
            <input v-model="newPassword" type="password" minlength="8"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>

          <p v-if="passwordSuccess" class="text-sm text-primary">{{ passwordSuccess }}</p>
          <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>

          <Button :disabled="passwordLoading" @click="changePassword">
            {{ passwordLoading ? 'Updating…' : 'Update password' }}
          </Button>
        </div>

        <!-- 2FA -->
        <div class="bg-card border border-border rounded-xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-foreground">Two-Factor Authentication</h2>
              <p class="text-sm text-muted-foreground mt-0.5">Add an extra layer of security to your account.</p>
            </div>
            <Badge :variant="store.profile?.totpEnabled ? 'default' : 'secondary'">
              {{ store.profile?.totpEnabled ? 'Enabled' : 'Disabled' }}
            </Badge>
          </div>

          <p v-if="totpSuccess" class="text-sm text-primary">{{ totpSuccess }}</p>

          <!-- Recovery codes (shown once after enabling) -->
          <div v-if="recoveryCodes.length > 0" class="bg-muted border border-border rounded-xl p-4 space-y-3">
            <p class="text-sm font-semibold text-foreground">Save your recovery codes</p>
            <p class="text-xs text-muted-foreground">Store these codes safely. Each code can only be used once if you lose access to your authenticator app.</p>
            <div class="grid grid-cols-2 gap-2">
              <code v-for="code in recoveryCodes" :key="code"
                class="bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground text-center">
                {{ code }}
              </code>
            </div>
            <button @click="recoveryCodes = []"
              class="text-xs text-muted-foreground hover:text-foreground underline">
              I have saved my codes
            </button>
          </div>

          <!-- Setup flow -->
          <template v-if="!store.profile?.totpEnabled">
            <div v-if="totpStep === 'idle'">
              <Button @click="startTotpSetup">Enable 2FA</Button>
            </div>

            <div v-if="totpStep === 'setup'" class="space-y-4">
              <p class="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
                then enter the 6-digit code to confirm.
              </p>
              <div class="flex justify-center">
                <img :src="qrDataUrl" alt="QR Code" class="w-48 h-48 border border-border rounded-lg" />
              </div>
              <p class="text-xs text-muted-foreground text-center break-all">Manual entry key: {{ totpSecret }}</p>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Verification code</label>
                <input v-model="totpCode" type="text" maxlength="6" placeholder="000000"
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-widest shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
              </div>
              <p v-if="totpError" class="text-sm text-destructive">{{ totpError }}</p>
              <div class="flex gap-2">
                <Button class="flex-1" @click="enableTotp">Confirm &amp; Enable</Button>
                <Button variant="outline" class="flex-1" @click="cancelTotpSetup">Cancel</Button>
              </div>
            </div>
          </template>

          <!-- Disable flow -->
          <template v-if="store.profile?.totpEnabled">
            <div class="space-y-3">
              <p class="text-sm text-muted-foreground">Enter your current 2FA code to disable it.</p>
              <input v-model="disableCode" type="text" maxlength="6" placeholder="000000"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-widest shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
              <p v-if="disableError" class="text-sm text-destructive">{{ disableError }}</p>
              <Button variant="destructive" @click="disableTotp">Disable 2FA</Button>
            </div>
          </template>
        </div>
      </div>

      <!-- Sessions Tab -->
      <div v-if="activeTab === 'sessions'" class="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 class="text-base font-semibold text-foreground">Active Sessions</h2>
        <p class="text-sm text-muted-foreground">These are the devices currently signed in to your account.</p>

        <div v-if="store.sessions.length === 0" class="text-sm text-muted-foreground text-center py-4">
          No active sessions found.
        </div>

        <div v-for="session in store.sessions" :key="session.id"
          class="flex items-center justify-between py-3 border-b border-border last:border-0">
          <div>
            <div class="text-sm text-foreground font-medium">Session</div>
            <div class="text-xs text-muted-foreground">Created {{ formatDate(session.createdAt) }} · Expires {{ formatDate(session.expiresAt) }}</div>
          </div>
          <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="store.revokeSession(session.id)">
            Revoke
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
