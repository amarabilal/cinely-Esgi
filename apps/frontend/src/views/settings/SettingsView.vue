<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import { settingsApi, type SubscriptionStatus } from '@/api/settings.api';
import { useAppLock } from '@/composables/useAppLock';
import { isNative } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MobileAppCard from '@/components/settings/MobileAppCard.vue';

const store = useSettingsStore();

const appLock = useAppLock();
const appLockEnabled = ref(appLock.isEnabled());
async function toggleAppLock(value: boolean) {
  await appLock.setEnabled(value);
  appLockEnabled.value = appLock.isEnabled();
}

type SettingsTab = 'profile' | 'security' | 'subscription' | 'sessions' | 'google';
const activeTab = ref<SettingsTab>('profile');
const settingsTabs: Array<[SettingsTab, string]> = [
  ['profile', 'Profile'],
  ['security', 'Security'],
  ['subscription', 'Subscription'],
  ['sessions', 'Sessions'],
  ['google', 'Google'],
];

const firstName = ref('');
const lastName = ref('');
const profileSuccess = ref('');
const profileError = ref('');
const profileLoading = ref(false);

const currentPassword = ref('');
const newPassword = ref('');
const passwordSuccess = ref('');
const passwordError = ref('');
const passwordLoading = ref(false);

const totpStep = ref<'idle' | 'setup' | 'confirm'>('idle');
const qrDataUrl = ref('');
const totpSecret = ref('');
const totpCode = ref('');
const totpError = ref('');
const totpSuccess = ref('');
const recoveryCodes = ref<string[]>([]);

const disableCode = ref('');
const disableError = ref('');

const googleConnected = ref(false);
const googleEmail = ref('');
const googleLoading = ref(false);

const subscription = ref<SubscriptionStatus | null>(null);
const subscriptionLoading = ref(false);
const subscriptionError = ref('');
const subscriptionMessage = ref('');

async function fetchSubscription(sessionId?: string) {
  subscriptionLoading.value = true;
  subscriptionError.value = '';
  try {
    const { data } = await settingsApi.getSubscription(sessionId);
    subscription.value = data;
    if (sessionId && !isSubscriptionActive(data.status)) {
      sessionStorage.removeItem('stripeCheckoutSessionId');
    }
  } catch (error: any) {
    subscriptionError.value = error.response?.data?.message || 'Failed to load subscription details.';
  } finally {
    subscriptionLoading.value = false;
  }
}

async function startSubscriptionCheckout() {
  subscriptionLoading.value = true;
  subscriptionError.value = '';
  try {
    const { data } = await settingsApi.createSubscriptionCheckout();
    window.location.assign(data.url);
  } catch (error: any) {
    subscriptionError.value = error.response?.data?.message || 'Failed to start Stripe Checkout.';
    subscriptionLoading.value = false;
  }
}

function formatPlanPrice(status: SubscriptionStatus | null): string {
  if (!status?.plan || status.plan.amount == null) return 'Price unavailable';
  const value = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: status.plan.currency.toUpperCase(),
  }).format(status.plan.amount / 100);
  return status.plan.interval ? `${value} / ${status.plan.interval}` : value;
}

function isSubscriptionActive(status?: string): boolean {
  return status === 'active' || status === 'trialing';
}

async function checkGoogleStatus() {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const res = await fetch('/api/google/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      googleConnected.value = data.connected;
      googleEmail.value = data.email || '';
    }
  } catch (err) {
    console.error('Failed to get Google status', err);
  }
}

function connectGoogle() {
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  window.location.href = `/api/google/auth?token=${encodeURIComponent(token)}`;
}

async function disconnectGoogle() {
  googleLoading.value = true;
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch('/api/google/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      googleConnected.value = false;
      googleEmail.value = '';
    }
  } catch (err) {
    console.error('Failed to disconnect Google', err);
  } finally {
    googleLoading.value = false;
  }
}

onMounted(async () => {
  await store.fetchProfile();
  await store.fetchSessions();
  if (store.profile) {
    firstName.value = store.profile.firstName;
    lastName.value = store.profile.lastName;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('google_connected') === 'success') {
    activeTab.value = 'google';
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const subscriptionResult = params.get('subscription');
  const checkoutSessionId = params.get('session_id') || sessionStorage.getItem('stripeCheckoutSessionId') || undefined;
  if (subscriptionResult) {
    activeTab.value = 'subscription';
    if (subscriptionResult === 'success' && params.get('session_id')) {
      sessionStorage.setItem('stripeCheckoutSessionId', params.get('session_id')!);
      subscriptionMessage.value = 'Stripe test subscription completed successfully.';
    } else if (subscriptionResult === 'canceled') {
      subscriptionMessage.value = 'Checkout was canceled. No payment was made.';
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  await fetchSubscription(checkoutSessionId);

  await checkGoogleStatus();
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

      <header class="mb-8">
        <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Account</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
      </header>

      <div class="flex gap-1 mb-8 bg-muted rounded-xl p-1 overflow-x-auto">
        <button v-for="[key, label] in settingsTabs"
          :key="key"
          @click="activeTab = key"
          class="flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="activeTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
          {{ label }}
        </button>
      </div>

      <div v-if="activeTab === 'subscription'" class="space-y-6">
        <div class="bg-card border border-border rounded-xl p-6 space-y-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-semibold text-foreground">Subscription</h2>
                <Badge variant="secondary">Stripe test mode</Badge>
              </div>
              <p class="text-sm text-muted-foreground mt-1">
                Test the complete hosted Stripe subscription checkout without making a real charge.
              </p>
            </div>
            <Badge :variant="isSubscriptionActive(subscription?.status) ? 'default' : 'outline'">
              {{ isSubscriptionActive(subscription?.status) ? subscription?.status : 'Inactive' }}
            </Badge>
          </div>

          <div v-if="subscriptionLoading && !subscription" class="py-10 text-center text-sm text-muted-foreground">
            Loading subscription…
          </div>

          <template v-else>
            <div class="rounded-xl border border-border bg-background p-5">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-lg font-semibold text-foreground">{{ subscription?.plan?.name || 'Cinely Pro' }}</p>
                  <p class="mt-1 text-2xl font-bold tracking-tight text-foreground">{{ formatPlanPrice(subscription) }}</p>
                  <p v-if="subscription?.customerEmail" class="mt-1 text-xs text-muted-foreground">
                    Test subscription for {{ subscription.customerEmail }}
                  </p>
                </div>
                <Button
                  :disabled="subscriptionLoading || !subscription?.configured || isSubscriptionActive(subscription?.status)"
                  @click="startSubscriptionCheckout">
                  <template v-if="subscriptionLoading">Opening Stripe…</template>
                  <template v-else-if="isSubscriptionActive(subscription?.status)">Test subscription active</template>
                  <template v-else>Subscribe with Stripe</template>
                </Button>
              </div>

              <ul class="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <li>✓ Hosted Stripe Checkout</li>
                <li>✓ Recurring test subscription</li>
                <li>✓ No real payment is charged</li>
                <li>✓ Checkout verified by the API</li>
              </ul>
            </div>

            <div v-if="!subscription?.configured" class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
              Stripe test mode is not configured. Add an <code>sk_test_…</code> secret key and a recurring test Price ID to the backend environment.
            </div>
            <p v-if="subscriptionMessage" class="text-sm text-primary">{{ subscriptionMessage }}</p>
            <p v-if="subscriptionError" class="text-sm text-destructive">{{ subscriptionError }}</p>
          </template>
        </div>

        <div class="bg-card border border-border rounded-xl p-6 space-y-2">
          <h3 class="text-sm font-semibold text-foreground">Test payment details</h3>
          <p class="text-sm text-muted-foreground">
            In Stripe Checkout, use card <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">4242 4242 4242 4242</code>, any future expiry date, and any three-digit CVC. Never enter a real card in this demo.
          </p>
        </div>
      </div>

      <div v-if="activeTab === 'profile'" class="space-y-6">
        <div class="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 class="text-base font-semibold text-foreground">Personal Information</h2>
          <p v-if="store.profile" class="text-sm text-muted-foreground">{{ store.profile.email }}</p>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground">First name</label>
              <input v-model="firstName" type="text"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground">Last name</label>
              <input v-model="lastName" type="text"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
            </div>
          </div>

          <p v-if="profileSuccess" class="text-sm text-primary">{{ profileSuccess }}</p>
          <p v-if="profileError" class="text-sm text-destructive">{{ profileError }}</p>

          <Button :disabled="profileLoading" @click="saveProfile">
            {{ profileLoading ? 'Saving…' : 'Save changes' }}
          </Button>
        </div>

        <MobileAppCard />
      </div>

      <div v-if="activeTab === 'security'" class="space-y-6">

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

        <div class="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 class="text-base font-semibold text-foreground">Change Password</h2>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">Current password</label>
            <input v-model="currentPassword" type="password"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">New password</label>
            <input v-model="newPassword" type="password" minlength="8"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>

          <p v-if="passwordSuccess" class="text-sm text-primary">{{ passwordSuccess }}</p>
          <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>

          <Button :disabled="passwordLoading" @click="changePassword">
            {{ passwordLoading ? 'Updating…' : 'Update password' }}
          </Button>
        </div>

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

          <div v-if="recoveryCodes.length > 0" class="bg-muted border border-border rounded-xl p-4 space-y-3">
            <p class="text-sm font-semibold text-foreground">Save your recovery codes</p>
            <p class="text-xs text-muted-foreground">Store these codes safely. Each code can only be used once if you lose access to your authenticator app.</p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm text-center tracking-widest shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
              </div>
              <p v-if="totpError" class="text-sm text-destructive">{{ totpError }}</p>
              <div class="flex gap-2">
                <Button class="flex-1" @click="enableTotp">Confirm &amp; Enable</Button>
                <Button variant="outline" class="flex-1" @click="cancelTotpSetup">Cancel</Button>
              </div>
            </div>
          </template>

          <template v-if="store.profile?.totpEnabled">
            <div class="space-y-3">
              <p class="text-sm text-muted-foreground">Enter your current 2FA code to disable it.</p>
              <input v-model="disableCode" type="text" maxlength="6" placeholder="000000"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm text-center tracking-widest shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
              <p v-if="disableError" class="text-sm text-destructive">{{ disableError }}</p>
              <Button variant="destructive" @click="disableTotp">Disable 2FA</Button>
            </div>
          </template>
        </div>
      </div>

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

      <div v-if="activeTab === 'google'" class="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          <h2 class="text-base font-semibold text-foreground">Google Integration</h2>
          <p class="text-sm text-muted-foreground mt-0.5">
            Connect your Google Account to automatically sync notes as calendar events, export documents directly to Google Drive, and send emails via Gmail.
          </p>
        </div>

        <div class="flex items-center justify-between py-4 border-y border-border">
          <div class="flex items-center gap-3">
            <svg class="h-6 w-6 text-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.3 0.64 4.5 1.84l2.42-2.42C17.38 1.75 14.93 1 12.24 1 6.57 1 2 5.57 2 11.24s4.57 10.24 10.24 10.24c5.79 0 10.24-4.11 10.24-10.24 0-.69-.08-1.35-.22-1.95H12.24z"/>
            </svg>
            <div>
              <p class="text-sm font-semibold text-foreground">
                {{ googleConnected ? 'Google Account Connected' : 'Google Account Not Connected' }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ googleConnected ? `Linked as ${googleEmail}` : 'Connect your account to enable features.' }}
              </p>
            </div>
          </div>
          <Badge :variant="googleConnected ? 'default' : 'secondary'">
            {{ googleConnected ? 'Connected' : 'Disconnected' }}
          </Badge>
        </div>

        <div class="flex gap-2">
          <Button v-if="!googleConnected" @click="connectGoogle">
            Connect Google Account
          </Button>
          <Button v-else variant="destructive" :disabled="googleLoading" @click="disconnectGoogle">
            {{ googleLoading ? 'Disconnecting…' : 'Disconnect Google Account' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
