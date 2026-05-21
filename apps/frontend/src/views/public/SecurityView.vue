<script setup lang="ts">
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
  <div class="min-h-screen bg-white">
    <nav class="border-b border-gray-100 px-6 py-4 flex items-center gap-6 max-w-6xl mx-auto">
      <router-link to="/" class="text-xl font-bold text-primary-600">Notes</router-link>
      <router-link to="/features" class="text-sm text-gray-500 hover:text-gray-900">Features</router-link>
      <div class="ml-auto flex gap-3">
        <router-link to="/login" class="text-sm text-gray-600 hover:text-gray-900">Login</router-link>
        <router-link to="/register"
          class="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
          Get started
        </router-link>
      </div>
    </nav>

    <div class="max-w-4xl mx-auto py-16 px-6">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">Security</h1>
      <p class="text-lg text-gray-500 mb-16">
        Security is built into every layer of the application — from password hashing
        to infrastructure hardening and GDPR-compliant data handling.
      </p>

      <div class="space-y-10">
        <div v-for="group in measures" :key="group.category">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ group.category }}</h2>
          <div class="border border-gray-100 rounded-2xl divide-y divide-gray-50">
            <div v-for="item in group.items" :key="item.label" class="px-6 py-4 flex flex-col sm:flex-row gap-2">
              <span class="text-sm font-medium text-gray-800 w-52 shrink-0">{{ item.label }}</span>
              <span class="text-sm text-gray-500">{{ item.detail }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="border-t border-gray-100 py-6 px-6 text-center">
      <div class="flex justify-center gap-6">
        <router-link to="/legal/cgu" class="text-sm text-gray-400 hover:text-gray-600">CGU</router-link>
        <router-link to="/legal/politique-confidentialite" class="text-sm text-gray-400 hover:text-gray-600">Privacy</router-link>
        <router-link to="/contact" class="text-sm text-gray-400 hover:text-gray-600">Contact</router-link>
      </div>
    </footer>
  </div>
</template>
