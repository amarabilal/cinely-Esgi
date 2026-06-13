# Capacitor Android Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Vue 3 frontend in a Capacitor Android shell that boots, lets a user log in, stays logged in across app restarts, and runs realtime sync against the live `https://cinely.fr` backend.

**Architecture:** Capacitor is added *into* `apps/frontend` (`webDir: dist`); the same `npm run build` feeds web and app. Mobile behaviour is gated at runtime by `Capacitor.isNativePlatform()`. The access token stays in `localStorage` (synchronous, persists in the WebView); the refresh token moves to `@capacitor/preferences` on native and is sent in the request body (the web cookie path is unchanged). The backend gains a body/cookie-tolerant refresh and a CORS allow-list that includes the Capacitor origins.

**Tech Stack:** Capacitor 6 (`@capacitor/core`, `/cli`, `/android`, `/app`, `/status-bar`, `/splash-screen`, `/preferences`, `/network`), Vue 3 + Vite, Vitest (new, for frontend unit tests), NestJS + Jest (backend tests).

**Prerequisites (operator, one-time):** Android Studio + Android SDK + JDK 17 installed; an Android emulator (e.g. Pixel 6, API 34) or a physical device with USB debugging. Node 20+.

---

## File map

**Frontend — create**
- `apps/frontend/capacitor.config.ts` — Capacitor app config (appId, webDir, plugin config)
- `apps/frontend/src/lib/platform.ts` — runtime platform + URL selection
- `apps/frontend/src/lib/tokenStore.ts` — access token (localStorage) + refresh token (Preferences on native)
- `apps/frontend/src/composables/useNativeShell.ts` — splash hide, status-bar theming, hardware back button
- `apps/frontend/src/composables/useNetwork.ts` — online/offline state (Capacitor Network + browser fallback)
- `apps/frontend/src/components/app/OfflineBanner.vue` — offline indicator
- `apps/frontend/vitest.config.ts` — Vitest config
- `apps/frontend/src/lib/__tests__/platform.spec.ts`, `tokenStore.spec.ts` — unit tests
- `apps/frontend/android/` — generated native project (do not hand-edit beyond noted files)

**Frontend — modify**
- `apps/frontend/package.json` — deps + `test:unit` script
- `apps/frontend/index.html` — `viewport-fit=cover`
- `apps/frontend/src/api/client.ts` — absolute base URL + native refresh path + client header
- `apps/frontend/src/api/auth.api.ts` — refresh/logout payloads (read it first; see Task 6)
- `apps/frontend/src/stores/auth.store.ts` — capture/clear refresh token on native
- `apps/frontend/src/composables/useNoteSync.ts:77` — `io(SOCKET_URL, …)`
- `apps/frontend/src/composables/useColorMode.ts` — emit theme so the status bar can follow
- `apps/frontend/src/App.vue` — mount native shell + offline banner
- `apps/frontend/src/router/index.ts` — native entry redirect (marketing → app)
- `apps/frontend/src/components/app/AppLayout.vue:61` — `dvh` + safe-area for FAB
- `apps/frontend/src/assets/main.css` — safe-area helpers

**Backend — create**
- `apps/backend/src/modules/auth/application/dto/refresh-token.dto.ts` — optional `refreshToken`
- `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts` — controller unit test

**Backend — modify**
- `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.ts` — body/cookie refresh + native body echo
- `apps/backend/src/main.ts:25-29` — CORS origin array
- `apps/backend/src/modules/notes/infrastructure/gateways/notes.gateway.ts:31-36` — socket CORS origin array

---

## Task 1: Install Capacitor and add the Android platform

**Files:**
- Create: `apps/frontend/capacitor.config.ts`
- Modify: `apps/frontend/package.json` (deps added by npm)
- Create: `apps/frontend/android/` (generated)

- [ ] **Step 1: Install Capacitor packages**

Run from `apps/frontend`:
```bash
npm install @capacitor/core@^6 @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences @capacitor/network
npm install -D @capacitor/cli@^6 @capacitor/android@^6
```

- [ ] **Step 2: Create the Capacitor config**

Create `apps/frontend/capacitor.config.ts`:
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.cinely.app',
  appName: 'Cinely',
  webDir: 'dist',
  android: {
    // Use https scheme so the WebView origin is https://localhost (secure context:
    // required for crypto/subtle, service workers, and SameSite handling).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: false, // we hide it from useNativeShell once the app is ready
      backgroundColor: '#0a0a0a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
```

- [ ] **Step 3: Build the web app, then add the Android platform**

Run from `apps/frontend`:
```bash
npm run build
npx cap add android
npx cap sync android
```
Expected: `android/` directory created; `cap sync` ends with "Sync finished".

- [ ] **Step 4: Ignore generated native build artifacts**

Append to `apps/frontend/.gitignore` (create the lines if absent):
```gitignore
# Capacitor / Android native build artifacts
/android/.gradle
/android/build
/android/app/build
/android/app/src/main/assets/public
/android/app/src/main/assets/capacitor.config.json
/android/app/src/main/res/raw
/android/capacitor-cordova-android-plugins
.DS_Store
```
Note: commit the rest of `android/` (the project scaffold) so the native project is reproducible.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/package.json apps/frontend/package-lock.json apps/frontend/capacitor.config.ts apps/frontend/.gitignore apps/frontend/android
git commit -m "feat(mobile): add Capacitor + Android platform to frontend"
```

---

## Task 2: Add Vitest to the frontend

**Files:**
- Create: `apps/frontend/vitest.config.ts`
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Install Vitest**

Run from `apps/frontend`:
```bash
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `apps/frontend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 3: Add the test script**

In `apps/frontend/package.json`, add to `scripts`:
```json
"test:unit": "vitest run"
```

- [ ] **Step 4: Verify the runner starts (no tests yet)**

Run: `npm run test:unit`
Expected: exits 0 with "No test files found" (acceptable — tests arrive in Task 3).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/package.json apps/frontend/package-lock.json apps/frontend/vitest.config.ts
git commit -m "test(frontend): add Vitest runner"
```

---

## Task 3: Runtime platform + URL selection (`platform.ts`)

**Files:**
- Create: `apps/frontend/src/lib/platform.ts`
- Test: `apps/frontend/src/lib/__tests__/platform.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/lib/__tests__/platform.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

function loadPlatform(native: boolean, envUrl?: string) {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
  vi.stubEnv('VITE_API_BASE_URL', envUrl ?? '');
  return import('../platform');
}

describe('platform', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('uses relative /api and same-origin socket on web', async () => {
    const p = await loadPlatform(false);
    expect(p.isNative).toBe(false);
    expect(p.API_BASE_URL).toBe('/api');
    expect(p.SOCKET_URL).toBeUndefined();
  });

  it('uses the live backend origin on native by default', async () => {
    const p = await loadPlatform(true);
    expect(p.isNative).toBe(true);
    expect(p.API_BASE_URL).toBe('https://cinely.fr/api');
    expect(p.SOCKET_URL).toBe('https://cinely.fr');
  });

  it('honours VITE_API_BASE_URL on native', async () => {
    const p = await loadPlatform(true, 'http://10.0.2.2:3000');
    expect(p.API_BASE_URL).toBe('http://10.0.2.2:3000/api');
    expect(p.SOCKET_URL).toBe('http://10.0.2.2:3000');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '../platform'`.

- [ ] **Step 3: Implement `platform.ts`**

Create `apps/frontend/src/lib/platform.ts`:
```typescript
import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor native shell (Android/iOS). */
export const isNative = Capacitor.isNativePlatform();

/** Header value the backend uses to identify native clients (token-in-body refresh). */
export const CLIENT_PLATFORM_HEADER = 'X-Client-Platform';
export const CLIENT_PLATFORM_VALUE = 'capacitor';

/**
 * Where the backend lives.
 * - Web: same origin via Traefik → relative `/api`, same-origin socket.
 * - Native: absolute origin (env override, else the live cluster).
 */
const BACKEND_ORIGIN = isNative
  ? (import.meta.env.VITE_API_BASE_URL || 'https://cinely.fr')
  : '';

/** Axios baseURL. `/api` on web, `https://cinely.fr/api` on native. */
export const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

/** socket.io URL. `undefined` on web (same-origin), absolute origin on native. */
export const SOCKET_URL = isNative ? BACKEND_ORIGIN : undefined;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/platform.ts apps/frontend/src/lib/__tests__/platform.spec.ts
git commit -m "feat(mobile): platform-aware API/socket URL selection"
```

---

## Task 4: Token store (`tokenStore.ts`)

**Files:**
- Create: `apps/frontend/src/lib/tokenStore.ts`
- Test: `apps/frontend/src/lib/__tests__/tokenStore.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/lib/__tests__/tokenStore.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prefs: Record<string, string> = {};

function loadStore(native: boolean) {
  vi.resetModules();
  for (const k of Object.keys(prefs)) delete prefs[k];
  vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
  vi.doMock('@capacitor/preferences', () => ({
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: prefs[key] ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { prefs[key] = value; },
      remove: async ({ key }: { key: string }) => { delete prefs[key]; },
    },
  }));
  return import('../tokenStore');
}

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the access token in localStorage on every platform', async () => {
    const s = await loadStore(false);
    s.setAccessToken('abc');
    expect(s.getAccessToken()).toBe('abc');
    expect(localStorage.getItem('accessToken')).toBe('abc');
    s.clearAccessToken();
    expect(s.getAccessToken()).toBeNull();
  });

  it('does not persist a refresh token on web (cookie handles it)', async () => {
    const s = await loadStore(false);
    await s.setRefreshToken('r1');
    expect(await s.getRefreshToken()).toBeNull();
  });

  it('persists the refresh token in Preferences on native', async () => {
    const s = await loadStore(true);
    await s.setRefreshToken('r1');
    expect(await s.getRefreshToken()).toBe('r1');
    await s.clearRefreshToken();
    expect(await s.getRefreshToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '../tokenStore'`. (Vitest provides a `localStorage` in jsdom; if it is undefined under the node environment, change `vitest.config.ts` `environment` to `'jsdom'` and `npm i -D jsdom`.)

- [ ] **Step 3: Implement `tokenStore.ts`**

Create `apps/frontend/src/lib/tokenStore.ts`:
```typescript
import { isNative } from './platform';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

// --- Access token: synchronous localStorage on all platforms ---------------
// (Used in the axios request interceptor on every call; must stay sync.
//  The Android WebView persists localStorage across app restarts.)
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}

// --- Refresh token: async, native-only -------------------------------------
// On web the refresh token is an httpOnly cookie and never touches JS.
// On native there is no cookie, so we persist it via Capacitor Preferences
// and send it in the refresh request body.
export async function getRefreshToken(): Promise<string | null> {
  if (!isNative) return null;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: REFRESH_KEY });
  return value;
}
export async function setRefreshToken(token: string): Promise<void> {
  if (!isNative) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: REFRESH_KEY, value: token });
}
export async function clearRefreshToken(): Promise<void> {
  if (!isNative) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: REFRESH_KEY });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: PASS (all tokenStore + platform tests).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/tokenStore.ts apps/frontend/src/lib/__tests__/tokenStore.spec.ts apps/frontend/vitest.config.ts apps/frontend/package.json apps/frontend/package-lock.json
git commit -m "feat(mobile): platform-aware token store (access in localStorage, refresh in Preferences on native)"
```

---

## Task 5: Backend — body/cookie-tolerant refresh + CORS allow-list

**Files:**
- Create: `apps/backend/src/modules/auth/application/dto/refresh-token.dto.ts`
- Create: `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.ts`
- Modify: `apps/backend/src/main.ts:25-29`
- Modify: `apps/backend/src/modules/notes/infrastructure/gateways/notes.gateway.ts:31-36`

- [ ] **Step 1: Write the failing controller test**

Create `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/services/auth.service';
import type { Response, Request } from 'express';

describe('AuthController (native refresh)', () => {
  let controller: AuthController;
  const authService = {
    refresh: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' }),
  };

  beforeEach(async () => {
    authService.refresh.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  function mockRes() {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
  }

  it('reads the refresh token from the cookie (web) and does NOT echo it in the body', async () => {
    const req = { cookies: { refreshToken: 'cookie-rt' }, headers: {}, body: {} } as unknown as Request;
    const res = mockRes();
    const out = await controller.refresh(req, res, {});
    expect(authService.refresh).toHaveBeenCalledWith('cookie-rt');
    expect(out).toEqual({ accessToken: 'AT' });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'RT', expect.any(Object));
  });

  it('reads the refresh token from the body and echoes it back for native clients', async () => {
    const req = {
      cookies: {},
      headers: { 'x-client-platform': 'capacitor' },
      body: { refreshToken: 'body-rt' },
    } as unknown as Request;
    const res = mockRes();
    const out = await controller.refresh(req, res, { refreshToken: 'body-rt' });
    expect(authService.refresh).toHaveBeenCalledWith('body-rt');
    expect(out).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `apps/backend`: `npm test -- auth.controller`
Expected: FAIL — compilation error (`controller.refresh` signature mismatch / DTO missing).

- [ ] **Step 3: Create the refresh DTO**

Create `apps/backend/src/modules/auth/application/dto/refresh-token.dto.ts`:
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token for native clients (web uses the httpOnly cookie)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
```

- [ ] **Step 4: Update the auth controller**

In `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.ts`:

Add the import at the top with the other DTO imports:
```typescript
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto';
```

Add this helper inside the `AuthController` class (above the route methods):
```typescript
  /** Native clients (Capacitor) send this header and store the refresh token themselves. */
  private isNativeClient(req: Request): boolean {
    return req.headers['x-client-platform'] === 'capacitor';
  }

  /** Web gets only the access token (refresh lives in the cookie). Native also gets the refresh token. */
  private tokenResponse(req: Request, accessToken: string, refreshToken: string) {
    return this.isNativeClient(req) ? { accessToken, refreshToken } : { accessToken };
  }
```

Replace the `register`, `login`, `verify2fa`, `logout`, and `refresh` methods with:
```typescript
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const result = await this.authService.login(dto, ip);

    if ('twoFactorRequired' in result && result.twoFactorRequired) {
      return { twoFactorRequired: true, tempToken: result.tempToken };
    }

    const { accessToken, refreshToken } = result as { accessToken: string; refreshToken: string };
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  async verify2fa(@Body() dto: Verify2faDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.verify2fa(dto.tempToken, dto.code);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: RefreshTokenDto) {
    await this.authService.logout(req.cookies?.refreshToken ?? body?.refreshToken);
    res.clearCookie('refreshToken', { path: '/' });
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: RefreshTokenDto) {
    const presented = req.cookies?.refreshToken ?? body?.refreshToken;
    const { accessToken, refreshToken } = await this.authService.refresh(presented);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }
```

Note: `register` previously had no `@Req()` — the new signature adds it. The test calls `controller.refresh(req, res, body)`; the parameter order above (req, res, body) matches.

- [ ] **Step 5: Run the test to verify it passes**

Run from `apps/backend`: `npm test -- auth.controller`
Expected: PASS (2 tests).

- [ ] **Step 6: Widen CORS to the Capacitor origins**

In `apps/backend/src/main.ts`, replace the `app.enableCors({...})` block (lines ~25-29) with:
```typescript
  const corsOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://localhost',      // Capacitor Android (https scheme)
    'capacitor://localhost',  // Capacitor iOS
    'http://localhost',       // Capacitor Android (legacy/http scheme)
  ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
```

- [ ] **Step 7: Widen socket-gateway CORS the same way**

In `apps/backend/src/modules/notes/infrastructure/gateways/notes.gateway.ts`, replace the `@WebSocketGateway({...})` decorator (lines ~31-36) with:
```typescript
@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://localhost',
      'capacitor://localhost',
      'http://localhost',
    ],
    credentials: true,
  },
})
```

- [ ] **Step 8: Run the full backend unit suite (no regressions)**

Run from `apps/backend`: `npm test`
Expected: PASS (existing 59 specs + the 2 new ones).

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/auth/application/dto/refresh-token.dto.ts apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.ts apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts apps/backend/src/main.ts apps/backend/src/modules/notes/infrastructure/gateways/notes.gateway.ts
git commit -m "feat(auth): body/cookie-tolerant refresh + CORS for Capacitor origins"
```

---

## Task 6: Frontend — wire the absolute URL, native refresh, and token capture

**Files:**
- Read first: `apps/frontend/src/api/auth.api.ts` (confirm the `login`/`logout`/`refresh` response shapes; the steps below assume `logout()` posts to `/auth/logout` and the login/register/verify responses carry `accessToken` and optionally `refreshToken`).
- Modify: `apps/frontend/src/api/client.ts`
- Modify: `apps/frontend/src/stores/auth.store.ts`
- Modify: `apps/frontend/src/composables/useNoteSync.ts:77`

- [ ] **Step 1: Point axios at the absolute base URL and send the client header**

In `apps/frontend/src/api/client.ts`, replace the top `axios.create` + request interceptor region:
```typescript
import axios from 'axios';
import { API_BASE_URL, isNative, CLIENT_PLATFORM_HEADER, CLIENT_PLATFORM_VALUE } from '@/lib/platform';
import {
  getAccessToken, setAccessToken, clearAccessToken,
  getRefreshToken, setRefreshToken, clearRefreshToken,
} from '@/lib/tokenStore';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

if (isNative) {
  client.defaults.headers.common[CLIENT_PLATFORM_HEADER] = CLIENT_PLATFORM_VALUE;
}
```

- [ ] **Step 2: Use the token store in the request interceptor**

Replace the request interceptor:
```typescript
client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

- [ ] **Step 3: Branch the refresh path for native vs web**

Replace the response interceptor's refresh block (the `try { ... }` that calls `/api/auth/refresh`) with:
```typescript
    original._retry = true;
    isRefreshing = true;

    try {
      let data: { accessToken: string; refreshToken?: string };
      if (isNative) {
        const refreshToken = await getRefreshToken();
        const resp = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { [CLIENT_PLATFORM_HEADER]: CLIENT_PLATFORM_VALUE } },
        );
        data = resp.data;
        if (data.refreshToken) await setRefreshToken(data.refreshToken);
      } else {
        const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        data = resp.data;
      }
      setAccessToken(data.accessToken);
      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return client(original);
    } catch (err) {
      processQueue(err, null);
      clearAccessToken();
      await clearRefreshToken();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
```

- [ ] **Step 4: Capture the refresh token after auth, clear it on logout (auth.store.ts)**

In `apps/frontend/src/stores/auth.store.ts`:

Replace the imports + token helpers region at the top of the store factory:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type User } from '@/api/auth.api';
import { getAccessToken, setAccessToken, clearAccessToken, setRefreshToken, clearRefreshToken } from '@/lib/tokenStore';
```

Replace `const accessToken = ref(localStorage.getItem('accessToken'));` with:
```typescript
  const accessToken = ref<string | null>(getAccessToken());
```

Replace `setToken` and `clearAuth`:
```typescript
  async function setToken(token: string, refreshToken?: string) {
    accessToken.value = token;
    setAccessToken(token);
    if (refreshToken) await setRefreshToken(refreshToken); // no-op on web
  }

  async function clearAuth() {
    user.value = null;
    accessToken.value = null;
    pendingTwoFactor.value = null;
    clearAccessToken();
    await clearRefreshToken(); // no-op on web
  }
```

Update the three call sites to pass the refresh token and await:
```typescript
  // in register():
    await setToken(data.accessToken, data.refreshToken);
  // in login() (non-2FA branch):
    await setToken(data.accessToken!, data.refreshToken);
  // in verifyTwoFactor():
    await setToken(data.accessToken, data.refreshToken);
```

Note: `clearAuth` is now async — update its callers. In `AppLayout.vue:29` change `await auth.fetchMe().catch(() => auth.clearAuth())` to `await auth.fetchMe().catch(() => { void auth.clearAuth(); })`. `logout()` already `await`s; ensure it `await auth.clearAuth()` (it calls `clearAuth()` — make it `await clearAuth()`).

- [ ] **Step 5: Confirm the auth API types expose `refreshToken?`**

Open `apps/frontend/src/api/auth.api.ts`. Ensure the login/register/verify response interfaces include an optional `refreshToken?: string`. If the responses are strongly typed without it, add `refreshToken?: string;` to those interfaces so `data.refreshToken` type-checks. (No runtime change — the field is simply now read on native.)

- [ ] **Step 6: Point the socket at the absolute URL**

In `apps/frontend/src/composables/useNoteSync.ts`, add the import near the top:
```typescript
import { SOCKET_URL } from '@/lib/platform';
```
Replace line 77 `socket = io({ transports: ['websocket'], auth: { token } });` with:
```typescript
  socket = SOCKET_URL
    ? io(SOCKET_URL, { transports: ['websocket'], auth: { token } })
    : io({ transports: ['websocket'], auth: { token } });
```

- [ ] **Step 7: Type-check the web build (no regressions)**

Run from `apps/frontend`: `npm run build`
Expected: `vue-tsc` passes, `vite build` produces `dist/`.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/api/client.ts apps/frontend/src/stores/auth.store.ts apps/frontend/src/composables/useNoteSync.ts apps/frontend/src/api/auth.api.ts apps/frontend/src/components/app/AppLayout.vue
git commit -m "feat(mobile): absolute API/socket URL + native refresh-token flow"
```

---

## Task 7: Native shell — splash, status bar, hardware back button

**Files:**
- Create: `apps/frontend/src/composables/useNativeShell.ts`
- Modify: `apps/frontend/src/composables/useColorMode.ts`
- Modify: `apps/frontend/src/App.vue`

- [ ] **Step 1: Expose the current theme mode from useColorMode**

In `apps/frontend/src/composables/useColorMode.ts`, the module-level `const mode = ref<Mode>('dark')` already exists. Export a getter so the native shell can react. Add after the `useColorMode` function:
```typescript
/** Read-only access to the current color mode for non-component consumers (e.g. native status bar). */
export function currentMode() {
  return mode;
}
```

- [ ] **Step 2: Implement the native shell composable**

Create `apps/frontend/src/composables/useNativeShell.ts`:
```typescript
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { isNative } from '@/lib/platform';
import { currentMode } from '@/composables/useColorMode';

/**
 * Wires native-shell behaviour. No-op on web. Call once from App.vue.
 * - hides the splash screen once Vue has mounted
 * - themes the status bar to match light/dark and reacts to toggles
 * - routes the Android hardware back button (history back, else exit at root)
 */
export function useNativeShell() {
  if (!isNative) return;
  const router = useRouter();

  void (async () => {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { App } = await import('@capacitor/app');

    const applyStatusBar = async (mode: 'light' | 'dark') => {
      try {
        // Style.Dark = light text (for dark backgrounds); Style.Light = dark text.
        await StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: mode === 'dark' ? '#0a0a0a' : '#ffffff' });
      } catch { /* status bar not available (e.g. tablet) */ }
    };

    const mode = currentMode();
    await applyStatusBar(mode.value);
    watch(mode, (m) => { void applyStatusBar(m); });

    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        router.back();
      } else {
        void App.exitApp();
      }
    });

    await SplashScreen.hide();
  })();
}
```

- [ ] **Step 3: Mount it in App.vue**

In `apps/frontend/src/App.vue`, update the `<script setup>`:
```vue
<script setup lang="ts">
import { useColorMode } from '@/composables/useColorMode';
import { useNativeShell } from '@/composables/useNativeShell';
import CookieConsent from '@/components/CookieConsent.vue';
import OfflineBanner from '@/components/app/OfflineBanner.vue';

useColorMode();
useNativeShell(); // no-op on web
</script>
```
And update the template to include the banner (the `OfflineBanner` component is built in Task 9):
```vue
<template>
  <router-view />
  <OfflineBanner />
  <CookieConsent />
</template>
```

- [ ] **Step 4: Type-check**

Run from `apps/frontend`: `npm run build`
Expected: passes. (If `OfflineBanner` does not exist yet, do Task 9 before this build, or temporarily comment the banner import/tag and restore it in Task 9.)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/composables/useNativeShell.ts apps/frontend/src/composables/useColorMode.ts apps/frontend/src/App.vue
git commit -m "feat(mobile): native shell — splash, status-bar theming, back button"
```

---

## Task 8: Safe areas + viewport-fit + dvh

**Files:**
- Modify: `apps/frontend/index.html:5`
- Modify: `apps/frontend/src/assets/main.css`
- Modify: `apps/frontend/src/components/app/AppLayout.vue`

- [ ] **Step 1: Enable safe-area insets via the viewport meta**

In `apps/frontend/index.html`, replace line 5 with:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 2: Add safe-area utility classes**

Append to `apps/frontend/src/assets/main.css` inside the `@layer utilities { ... }` block (add the block if it does not already exist):
```css
@layer utilities {
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
  .pt-safe { padding-top: env(safe-area-inset-top); }
  .inset-safe-b { bottom: calc(1rem + env(safe-area-inset-bottom)); }
  .inset-safe-r { right: calc(1rem + env(safe-area-inset-right)); }
}
```

- [ ] **Step 3: Use dvh and safe-area for the app shell + FAB**

In `apps/frontend/src/components/app/AppLayout.vue`:

Replace the main flex container class `h-[calc(100vh-3rem)]` (line 61) with:
```
class="flex h-[calc(100dvh-3rem)] min-h-0"
```

Replace the FAB classes (line 93) `class="fixed bottom-4 right-4 z-30 shadow-lg md:hidden"` with:
```
class="fixed inset-safe-b inset-safe-r z-30 shadow-lg md:hidden"
```

- [ ] **Step 4: Safe-area for the cookie banner**

In `apps/frontend/src/components/CookieConsent.vue`, find the `fixed bottom-4` (or `bottom-0`) wrapper and add `pb-safe` to its class list so it clears the home indicator. (If it uses `bottom-4`, change to `bottom-0 pb-safe` to avoid double spacing.)

- [ ] **Step 5: Type-check + web smoke**

Run from `apps/frontend`: `npm run build`
Expected: passes. The web layout is visually unchanged (env() insets are 0 on desktop).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/index.html apps/frontend/src/assets/main.css apps/frontend/src/components/app/AppLayout.vue apps/frontend/src/components/CookieConsent.vue
git commit -m "feat(mobile): safe-area insets + dvh for notched devices"
```

---

## Task 9: Offline banner

**Files:**
- Create: `apps/frontend/src/composables/useNetwork.ts`
- Create: `apps/frontend/src/components/app/OfflineBanner.vue`

- [ ] **Step 1: Network state composable**

Create `apps/frontend/src/composables/useNetwork.ts`:
```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { isNative } from '@/lib/platform';

const online = ref(true);

export function useNetwork() {
  let removeListener: (() => void) | null = null;

  onMounted(async () => {
    if (isNative) {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      online.value = status.connected;
      const handle = await Network.addListener('networkStatusChange', (s) => {
        online.value = s.connected;
      });
      removeListener = () => { void handle.remove(); };
    } else {
      online.value = navigator.onLine;
      const on = () => { online.value = true; };
      const off = () => { online.value = false; };
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      removeListener = () => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      };
    }
  });

  onUnmounted(() => removeListener?.());

  return { online };
}
```

- [ ] **Step 2: Offline banner component**

Create `apps/frontend/src/components/app/OfflineBanner.vue`:
```vue
<script setup lang="ts">
import { useNetwork } from '@/composables/useNetwork';
const { online } = useNetwork();
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-200"
    enter-from-class="-translate-y-full"
    leave-active-class="transition-transform duration-200"
    leave-to-class="-translate-y-full"
  >
    <div
      v-if="!online"
      class="fixed inset-x-0 top-0 z-50 pt-safe bg-destructive text-destructive-foreground text-center text-sm py-2"
      role="status"
      aria-live="polite"
    >
      You're offline — changes can't be saved until you reconnect.
    </div>
  </Transition>
</template>
```

- [ ] **Step 3: Verify it is mounted in App.vue**

Confirm Task 7 Step 3 added `<OfflineBanner />` and its import to `App.vue`. If Task 7 was skipped/commented, add them now.

- [ ] **Step 4: Type-check**

Run from `apps/frontend`: `npm run build`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/composables/useNetwork.ts apps/frontend/src/components/app/OfflineBanner.vue apps/frontend/src/App.vue
git commit -m "feat(mobile): offline banner via Capacitor Network"
```

---

## Task 10: Native entry — redirect marketing routes into the app

**Files:**
- Modify: `apps/frontend/src/router/index.ts`

- [ ] **Step 1: Add a native entry guard**

In `apps/frontend/src/router/index.ts`, add the import:
```typescript
import { isNative } from '@/lib/platform';
```
Add this set above the `router.beforeEach(...)` guard:
```typescript
// On native, the marketing pages are not part of the app — entering one
// (including the default '/' landing) bounces to the app, which the auth
// guard then resolves to '/notes' or '/login'.
const MARKETING_PATHS = new Set(['/', '/features', '/security', '/contact']);
```
Update the existing `router.beforeEach` to:
```typescript
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (isNative && MARKETING_PATHS.has(to.path)) {
    return auth.isAuthenticated ? '/notes' : '/login';
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login';
  if (to.meta.guest && auth.isAuthenticated) return '/notes';
});
```
Note: legal routes (`/legal/*`) are intentionally NOT redirected — they stay reachable from Settings links.

- [ ] **Step 2: Unit-safe check via build**

Run from `apps/frontend`: `npm run build`
Expected: passes. (Web behaviour unchanged — `isNative` is false in the browser.)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/router/index.ts
git commit -m "feat(mobile): redirect marketing routes to the app on native"
```

---

## Task 11: Build, sync, and verify on Android (manual)

**Files:** none (operator verification). This task has no automated tests — Capacitor native behaviour must be observed on a device/emulator. Record results in the PR description.

- [ ] **Step 1: Rebuild web assets and sync into the native project**

Run from `apps/frontend`:
```bash
npm run build
npx cap sync android
```
Expected: "Sync finished".

- [ ] **Step 2: Open and run in Android Studio**

```bash
npx cap open android
```
In Android Studio: select a device (Pixel 6 / API 34 emulator, or a USB device), press Run.
Expected: app installs and launches; the splash screen shows briefly, then hides.

- [ ] **Step 3: Verify the verification checklist**

Observe and tick each:
- [ ] App lands on `/login` (not the marketing home).
- [ ] Log in with a real cinely.fr account → lands on `/notes`; the notes list loads (proves absolute `/api` + CORS + Bearer).
- [ ] Open a note, type → "Saved" indicator; open the same note on `https://cinely.fr` in a browser → edits appear live (proves socket against the absolute URL + socket CORS).
- [ ] **Fully close the app (swipe from recents) and relaunch** → still logged in, notes load without re-login (proves access-token persistence + silent refresh via the body path).
- [ ] Status bar text/background matches the theme; toggle dark/light in Settings → status bar follows.
- [ ] On a notched/gesture device, the FAB and any bottom bar clear the home indicator (safe areas).
- [ ] Android hardware/gesture back navigates within the app; at the notes root it backgrounds/exits rather than showing a white screen.
- [ ] Toggle airplane mode → offline banner appears; restore → it disappears.

- [ ] **Step 4: Verify the web app is unaffected**

Run from `apps/frontend`: `npx playwright test`
Expected: the existing e2e suite passes (web auth unchanged).

- [ ] **Step 5: Commit any native config tweaks discovered during verification**

```bash
git add -A apps/frontend/android
git commit -m "chore(mobile): android project config after first-run verification"
```

---

## Task 12: App icon & splash assets (optional polish — non-blocking)

**Files:**
- Create: `apps/frontend/resources/icon.png`, `apps/frontend/resources/splash.png`
- Generated: `android/app/src/main/res/**`

Android ships a default launcher icon, so this does not block a runnable app. Do it before any store release.

- [ ] **Step 1: Provide source art**

Place a 1024×1024 `apps/frontend/resources/icon.png` (the Cinely logo on the brand background) and a 2732×2732 `apps/frontend/resources/splash.png` (logo centered on `#0a0a0a`). If no logo exists yet, export one from the web app's existing brand mark; a solid-background wordmark is acceptable for v1.

- [ ] **Step 2: Generate native assets**

Run from `apps/frontend`:
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```
Expected: launcher icons + splash images written under `android/app/src/main/res/`.

- [ ] **Step 3: Sync + re-run**

```bash
npx cap sync android
npx cap open android
```
Expected: the new icon shows in the launcher; the branded splash shows on cold start.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/resources apps/frontend/android/app/src/main/res apps/frontend/package.json apps/frontend/package-lock.json
git commit -m "feat(mobile): branded app icon + splash screen"
```

---

## Self-review

**Spec coverage (foundation portion of the spec):**
- §4 Architecture (wrap into apps/frontend, runtime gating, token split) → Tasks 1, 3, 4, 6 ✓
- §5.1 body/cookie refresh → Task 5 ✓ | §5.2 CORS for Capacitor origins → Task 5 (HTTP + socket) ✓
- §6 native chrome (splash, icon, status bar, back button, safe areas, native entry) → Tasks 7, 8, 10, 12 ✓
- §10 offline banner + socket reconnect → Task 9 (banner); socket reconnect is socket.io's default behaviour against `SOCKET_URL`, verified in Task 11 ✓
- §5.3 (image upload) and §5.4 (push), §7 (UX polish), §8 features 2-5 → **out of scope for this plan** (separate plans: UX-polish, biometric+share, camera, push, release). Called out in the plan intro.

**Placeholder scan:** No "TBD/TODO/handle appropriately". The one judgement call (icon art) has a concrete fallback. Task 6 Step 5 asks the engineer to read `auth.api.ts` and add an optional field — concrete and bounded.

**Type/name consistency:** `getAccessToken/setAccessToken/clearAccessToken` (sync) and `getRefreshToken/setRefreshToken/clearRefreshToken` (async) are used identically across Tasks 4 and 6. `isNative`, `API_BASE_URL`, `SOCKET_URL`, `CLIENT_PLATFORM_HEADER`, `CLIENT_PLATFORM_VALUE` from `platform.ts` match their consumers. `setToken(token, refreshToken?)` and async `clearAuth()` are consistent between Task 6 Step 4 and its callers. Controller `refresh(req, res, body)` parameter order matches the Task 5 test.

**Known follow-ups (documented, not gaps):** refresh token sits in `localStorage`/`Preferences` (JS-accessible) — the biometric plan hardens it into secure storage. `clearAuth()` becoming async requires touching its callers (noted in Task 6 Step 4).
