<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/stores/settings.store';

const router = useRouter();
const store = useSettingsStore();

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
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
      <button @click="router.push('/notes')" class="text-gray-400 hover:text-gray-600 transition-colors">
        ← Notes
      </button>
      <h1 class="text-lg font-semibold text-gray-900">Settings</h1>
      <div class="ml-auto">
        <button @click="router.push('/dashboard')"
          class="text-sm text-primary-600 hover:text-primary-800 transition-colors">
          Dashboard
        </button>
      </div>
    </div>

    <div class="max-w-2xl mx-auto py-8 px-4">
      <!-- Tabs -->
      <div class="flex gap-1 mb-8 bg-gray-100 rounded-xl p-1">
        <button v-for="[key, label] in [['profile', 'Profile'], ['security', 'Security'], ['sessions', 'Sessions']]"
          :key="key"
          @click="activeTab = key as any"
          class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
          {{ label }}
        </button>
      </div>

      <!-- Profile Tab -->
      <div v-if="activeTab === 'profile'" class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h2 class="text-base font-semibold text-gray-900">Personal Information</h2>
        <p v-if="store.profile" class="text-sm text-gray-500">{{ store.profile.email }}</p>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input v-model="firstName" type="text"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input v-model="lastName" type="text"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        <p v-if="profileSuccess" class="text-sm text-green-600">{{ profileSuccess }}</p>
        <p v-if="profileError" class="text-sm text-red-600">{{ profileError }}</p>

        <button @click="saveProfile" :disabled="profileLoading"
          class="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {{ profileLoading ? 'Saving…' : 'Save changes' }}
        </button>
      </div>

      <!-- Security Tab -->
      <div v-if="activeTab === 'security'" class="space-y-6">
        <!-- Change Password -->
        <div class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 class="text-base font-semibold text-gray-900">Change Password</h2>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input v-model="currentPassword" type="password"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input v-model="newPassword" type="password" minlength="8"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <p v-if="passwordSuccess" class="text-sm text-green-600">{{ passwordSuccess }}</p>
          <p v-if="passwordError" class="text-sm text-red-600">{{ passwordError }}</p>

          <button @click="changePassword" :disabled="passwordLoading"
            class="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {{ passwordLoading ? 'Updating…' : 'Update password' }}
          </button>
        </div>

        <!-- 2FA -->
        <div class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-gray-900">Two-Factor Authentication</h2>
              <p class="text-sm text-gray-500 mt-0.5">Add an extra layer of security to your account.</p>
            </div>
            <span class="text-xs px-2 py-1 rounded-full font-medium"
              :class="store.profile?.totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ store.profile?.totpEnabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>

          <p v-if="totpSuccess" class="text-sm text-green-600">{{ totpSuccess }}</p>

          <!-- Recovery codes (shown once after enabling) -->
          <div v-if="recoveryCodes.length > 0" class="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p class="text-sm font-semibold text-amber-800">Save your recovery codes</p>
            <p class="text-xs text-amber-700">Store these codes safely. Each code can only be used once if you lose access to your authenticator app.</p>
            <div class="grid grid-cols-2 gap-2">
              <code v-for="code in recoveryCodes" :key="code"
                class="bg-white border border-amber-200 rounded px-3 py-1.5 text-xs font-mono text-amber-900 text-center">
                {{ code }}
              </code>
            </div>
            <button @click="recoveryCodes = []"
              class="text-xs text-amber-600 hover:text-amber-800 underline">
              I have saved my codes
            </button>
          </div>

          <!-- Setup flow -->
          <template v-if="!store.profile?.totpEnabled">
            <div v-if="totpStep === 'idle'">
              <button @click="startTotpSetup"
                class="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-700 transition-colors">
                Enable 2FA
              </button>
            </div>

            <div v-if="totpStep === 'setup'" class="space-y-4">
              <p class="text-sm text-gray-600">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
                then enter the 6-digit code to confirm.
              </p>
              <div class="flex justify-center">
                <img :src="qrDataUrl" alt="QR Code" class="w-48 h-48 border border-gray-200 rounded-lg" />
              </div>
              <p class="text-xs text-gray-400 text-center break-all">Manual entry key: {{ totpSecret }}</p>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
                <input v-model="totpCode" type="text" maxlength="6" placeholder="000000"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <p v-if="totpError" class="text-sm text-red-600">{{ totpError }}</p>
              <div class="flex gap-2">
                <button @click="enableTotp"
                  class="flex-1 bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 transition-colors">
                  Confirm & Enable
                </button>
                <button @click="cancelTotpSetup"
                  class="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </template>

          <!-- Disable flow -->
          <template v-if="store.profile?.totpEnabled">
            <div class="space-y-3">
              <p class="text-sm text-gray-600">Enter your current 2FA code to disable it.</p>
              <input v-model="disableCode" type="text" maxlength="6" placeholder="000000"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p v-if="disableError" class="text-sm text-red-600">{{ disableError }}</p>
              <button @click="disableTotp"
                class="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors">
                Disable 2FA
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Sessions Tab -->
      <div v-if="activeTab === 'sessions'" class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h2 class="text-base font-semibold text-gray-900">Active Sessions</h2>
        <p class="text-sm text-gray-500">These are the devices currently signed in to your account.</p>

        <div v-if="store.sessions.length === 0" class="text-sm text-gray-400 text-center py-4">
          No active sessions found.
        </div>

        <div v-for="session in store.sessions" :key="session.id"
          class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
          <div>
            <div class="text-sm text-gray-700 font-medium">Session</div>
            <div class="text-xs text-gray-400">Created {{ formatDate(session.createdAt) }} · Expires {{ formatDate(session.expiresAt) }}</div>
          </div>
          <button @click="store.revokeSession(session.id)"
            class="text-xs text-red-500 hover:text-red-700 transition-colors">
            Revoke
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
