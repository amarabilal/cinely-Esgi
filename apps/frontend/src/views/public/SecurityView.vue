<script setup lang="ts">
import PublicLayout from '@/components/layout/PublicLayout.vue';

const measures = [
  {
    category: 'Authentication',
    items: [
      { label: 'Password hashing', detail: 'Argon2id — resistant to GPU and side-channel attacks' },
      { label: 'Access tokens', detail: 'JWT with 15-minute expiry, signed with RS256 secret' },
      { label: 'Refresh tokens', detail: 'Opaque tokens stored in HttpOnly cookies, hashed with SHA-256 in database' },
      { label: 'Account lockout', detail: '5 failed attempts → 15-minute lockout' },
      { label: 'Password expiry', detail: 'Mandatory renewal every 60 days' },
      { label: 'Password complexity', detail: 'Minimum 12 characters, requires uppercase, lowercase, number and symbol' },
    ],
  },
  {
    category: 'Two-Factor Authentication',
    items: [
      { label: 'TOTP implementation', detail: 'RFC 6238 compliant — built from scratch without external library (Node.js crypto + HMAC-SHA1)' },
      { label: 'Time window', detail: '30-second steps with ±1 step tolerance to handle clock drift' },
      { label: 'Recovery codes', detail: '8 single-use recovery codes generated on 2FA activation, stored as SHA-256 hashes' },
      { label: 'QR code', detail: 'Generated server-side as base64 data URL — compatible with Google Authenticator, Authy, etc.' },
    ],
  },
  {
    category: 'Infrastructure',
    items: [
      { label: 'Transport', detail: 'HTTPS everywhere with TLS via Let\'s Encrypt (auto-renewal)' },
      { label: 'HTTP headers', detail: 'Helmet.js — HSTS, X-Frame-Options, X-Content-Type-Options, CSP' },
      { label: 'Rate limiting', detail: 'Global 100 req/min limit; stricter limits on /auth/login (5/min) and /auth/forgot-password (3/hour)' },
      { label: 'CORS', detail: 'Restricted to configured frontend origin only' },
      { label: 'Container security', detail: 'Non-root user in all Docker images (production stage)' },
      { label: 'Reverse proxy', detail: 'Traefik on K3s cluster with strict routing rules' },
    ],
  },
  {
    category: 'Data Protection',
    items: [
      { label: 'Input validation', detail: 'class-validator with whitelist mode — unknown fields are rejected' },
      { label: 'SQL injection', detail: 'TypeORM parameterized queries; validated with SQLMap' },
      { label: 'Password reset tokens', detail: 'UUID tokens hashed with SHA-256; invalidated on use and on new request' },
      { label: 'Email verification', detail: 'Token-based, 24-hour expiry' },
      { label: 'Session revocation', detail: 'Logout and explicit session management revoke tokens immediately' },
    ],
  },
];
</script>

<template>
  <PublicLayout>
    <div class="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <h1 class="text-4xl font-bold tracking-tight text-foreground">Security</h1>
      <p class="mt-4 text-lg text-muted-foreground">
        Security is built into every layer of the application — from password hashing
        to infrastructure hardening and GDPR-compliant data handling.
      </p>

      <div class="mt-14 space-y-10">
        <div v-for="group in measures" :key="group.category">
          <h2 class="mb-4 text-lg font-semibold text-foreground">{{ group.category }}</h2>
          <div class="divide-y divide-border rounded-2xl border border-border bg-card">
            <div
              v-for="item in group.items"
              :key="item.label"
              class="flex flex-col gap-2 px-6 py-4 sm:flex-row"
            >
              <span class="w-full sm:w-52 shrink-0 text-sm font-medium text-foreground">{{ item.label }}</span>
              <span class="text-sm text-muted-foreground">{{ item.detail }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PublicLayout>
</template>
