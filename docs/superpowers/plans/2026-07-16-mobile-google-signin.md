# Mobile Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Sign in with Google" to the mobile app's login and register screens, backed by a minimal additive mobile branch in the backend's Google sign-in flow.

**Architecture:** The app opens `GET /api/google/login?platform=mobile` in a system auth browser. The backend encodes `state="login|mobile"`, and its existing callback deep-links `cinely://auth?code=<60s JWT>` instead of redirecting to the web. The app POSTs that code to a new `POST /api/auth/google/exchange`, receives `{accessToken, refreshToken}` over HTTPS, and establishes a session through the store's existing `establishSession` seam. The web sign-in path is untouched.

**Tech Stack:** NestJS + `@nestjs/jwt` (already injected in `GoogleController`), Jest (backend); Expo/React Native, `expo-web-browser`, zustand (mobile — both deps already installed).

**Spec:** `docs/superpowers/specs/2026-07-16-mobile-google-signin-design.md`

## Global Constraints

- **The web Google sign-in flow must not change.** `state === 'login'` (no suffix) keeps setting the refresh cookie and redirecting to `${FRONTEND_URL}/login?google_login=success&token=…`. A regression test proves it (Task 3).
- **Do not touch `apps/frontend` at all.** Zero files.
- Deep link the backend emits: `cinely://auth?google_login=success&code=<jwt>` / `cinely://auth?google_login=error&message=<encoded>`.
- Exchange code claims, exactly: `{ sub: <userId>, purpose: 'google-exchange' }`, `expiresIn: '60s'`, secret `process.env.JWT_ACCESS_SECRET`.
- **No refresh token may ever appear in a `cinely://` URL.**
- Mobile: no test framework exists in `apps/mobile` (no jest, no test script) — **do not add one**. Mobile tasks are verified by `npx tsc --noEmit` and the emulator run in Task 7.
- Backend tests run with `npm --prefix apps/backend test` (jest, `*.spec.ts`, `rootDir: src`). Follow the mocking style in `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts`.
- All commands are **Git Bash**, foreground only, quoted paths (space in "Projet anuel"). Never `run_in_background`.
- Branch `feat/mobile-google-signin`; stage only the files each task names (never `git add -A`); every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `platform` reaches the auth URL state

**Files:**
- Modify: `apps/backend/src/modules/google/google.service.ts:45-47` (`getLoginAuthUrl`)
- Modify: `apps/backend/src/modules/google/google.controller.ts:36-41` (`loginRedirect`)
- Create: `apps/backend/src/modules/google/google.controller.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getLoginAuthUrl(platform?: string)` → state `'login'` (default/web) or `'login|mobile'`. Task 3 parses that state.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/google/google.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { Note } from '../notes/domain/entities/note.entity';
import type { Response } from 'express';

describe('GoogleController (mobile sign-in)', () => {
  let controller: GoogleController;
  const googleService = {
    getLoginAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=x'),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('CODE'), verify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [GoogleController],
      providers: [
        { provide: GoogleService, useValue: googleService },
        { provide: JwtService, useValue: jwtService },
        { provide: getRepositoryToken(Note), useValue: {} },
      ],
    }).compile();
    controller = moduleRef.get(GoogleController);
  });

  function mockRes() {
    return { redirect: jest.fn(), cookie: jest.fn() } as unknown as Response;
  }

  it('asks for the plain web login URL when no platform is given', async () => {
    await controller.loginRedirect(undefined as unknown as string, mockRes());
    expect(googleService.getLoginAuthUrl).toHaveBeenCalledWith(undefined);
  });

  it('passes platform=mobile through to the service', async () => {
    await controller.loginRedirect('mobile', mockRes());
    expect(googleService.getLoginAuthUrl).toHaveBeenCalledWith('mobile');
  });
});
```

- [ ] **Step 2: Run it — must fail**

```bash
npm --prefix apps/backend test -- google.controller.spec
```

Expected: FAIL — `loginRedirect` currently takes only `(res)`, so the `platform` assertion fails (or TS arity error).

- [ ] **Step 3: Implement**

`google.service.ts` — replace lines 45-47:

```ts
  /**
   * Auth URL for the sign-in flow. `platform` is encoded into `state` so the
   * callback knows whether to redirect to the web app or deep-link into the
   * mobile app — same `|mobile` convention the connect flow uses.
   */
  getLoginAuthUrl(platform?: string): string {
    return this.getAuthUrl(platform === 'mobile' ? 'login|mobile' : 'login');
  }
```

`google.controller.ts` — replace lines 36-41:

```ts
  @ApiOperation({ summary: 'Redirects to Google OAuth page for login' })
  @Get('login')
  async loginRedirect(@Query('platform') platform: string, @Res() res: Response) {
    const url = this.googleService.getLoginAuthUrl(platform);
    return res.redirect(url);
  }
```

(`Query` is already imported — it is used by `auth()` at line 46.)

- [ ] **Step 4: Run tests — must pass**

```bash
npm --prefix apps/backend test -- google.controller.spec
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/google/google.service.ts apps/backend/src/modules/google/google.controller.ts apps/backend/src/modules/google/google.controller.spec.ts
git commit -m "feat(backend): encode platform in Google sign-in state

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `userId` surfaces from the login callback; tokens mintable for a user

**Files:**
- Modify: `apps/backend/src/modules/auth/application/services/auth.service.ts:217-263` (`loginOAuth`, + new `issueTokensForUser`)
- Modify: `apps/backend/src/modules/google/google.service.ts:49` (`handleLoginCallback` signature)
- Modify: `apps/backend/src/modules/auth/application/services/auth.service.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AuthService.loginOAuth(...)` → `Promise<{ accessToken: string; refreshToken: string; userId: string }>` (**additive** — existing destructuring of the first two keeps working).
  - `AuthService.issueTokensForUser(userId: string)` → `Promise<{ accessToken: string; refreshToken: string }>`; throws `UnauthorizedException` when the user is missing. Task 4 calls it.
  - `GoogleService.handleLoginCallback(code)` → same object incl. `userId`. Task 3 uses `userId`.

- [ ] **Step 1: Note the repository seam**

`AuthService` injects `USER_REPOSITORY` (`IUserRepository`), which already declares `findById(id: string): Promise<User | null>` at `apps/backend/src/modules/auth/domain/repositories/user.repository.interface.ts:7` — use it as-is; no interface change is needed.

- [ ] **Step 2: Write the failing tests**

Append to `apps/backend/src/modules/auth/application/services/auth.service.spec.ts` (match the file's existing setup/mocks — read it first; adapt the mock names below to whatever that file already defines):

```ts
  describe('OAuth token issuing', () => {
    it('loginOAuth returns the userId alongside the token pair', async () => {
      const out = await service.loginOAuth('g@example.com', 'G', 'U', { accessToken: 'ga' });
      expect(out).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          userId: expect.any(String),
        }),
      );
    });

    it('issueTokensForUser mints a pair for an existing user', async () => {
      const out = await service.issueTokensForUser('user-1');
      expect(out.accessToken).toEqual(expect.any(String));
      expect(out.refreshToken).toEqual(expect.any(String));
    });

    it('issueTokensForUser rejects an unknown user', async () => {
      await expect(service.issueTokensForUser('nope')).rejects.toThrow();
    });
  });
```

- [ ] **Step 3: Run — must fail**

```bash
npm --prefix apps/backend test -- auth.service.spec
```

Expected: FAIL — `issueTokensForUser` is not a function; `loginOAuth` lacks `userId`.

- [ ] **Step 4: Implement**

In `auth.service.ts`, change `loginOAuth`'s final line (currently `return this.createTokenPair(user.id, user.email);` at line 262) to:

```ts
    const tokens = await this.createTokenPair(user.id, user.email);
    return { ...tokens, userId: user.id };
```

And add a public method next to `createTokenPair`:

```ts
  /**
   * Mints a fresh token pair for an existing user. Used by the mobile Google
   * sign-in exchange, which holds a verified userId but no credentials.
   */
  async issueTokensForUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.createTokenPair(user.id, user.email);
  }
```

Ensure `UnauthorizedException` is imported from `@nestjs/common`.

In `google.service.ts`, widen the `handleLoginCallback` return annotation (line 49) — the body already tail-returns `loginOAuth`, so no body change:

```ts
  async handleLoginCallback(code: string): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
```

- [ ] **Step 5: Run — must pass**

```bash
npm --prefix apps/backend test -- auth.service.spec
```

Expected: all green, including the file's pre-existing tests.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/auth/application/services/auth.service.ts apps/backend/src/modules/auth/application/services/auth.service.spec.ts apps/backend/src/modules/google/google.service.ts
git commit -m "feat(backend): expose userId from loginOAuth; add issueTokensForUser

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Callback deep-links the mobile app

**Files:**
- Modify: `apps/backend/src/modules/google/google.controller.ts:187-203` (sign-in branch of `callback`)
- Modify: `apps/backend/src/modules/google/google.controller.spec.ts`

**Interfaces:**
- Consumes: Task 1's `state` format; Task 2's `userId`.
- Produces: `cinely://auth?google_login=success&code=<jwt>` for mobile; web behavior unchanged. Task 5 consumes the deep link.

- [ ] **Step 1: Write the failing tests**

Add to `google.controller.spec.ts` (extend the `googleService` mock with `handleLoginCallback: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT', userId: 'u1' })`):

```ts
  it('web sign-in still sets the refresh cookie and redirects to the frontend', async () => {
    process.env.FRONTEND_URL = 'https://cinely.fr';
    const res = mockRes();
    await controller.callback('code', 'login', res);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'RT', expect.any(Object));
    expect(res.redirect).toHaveBeenCalledWith('https://cinely.fr/login?google_login=success&token=AT');
  });

  it('mobile sign-in deep-links an exchange code and sets no cookie', async () => {
    const res = mockRes();
    await controller.callback('code', 'login|mobile', res);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenCalledWith(
      { sub: 'u1', purpose: 'google-exchange' },
      expect.objectContaining({ expiresIn: '60s' }),
    );
    expect(res.redirect).toHaveBeenCalledWith('cinely://auth?google_login=success&code=CODE');
  });

  it('never puts a refresh token in the deep link', async () => {
    const res = mockRes();
    await controller.callback('code', 'login|mobile', res);
    expect((res.redirect as jest.Mock).mock.calls[0][0]).not.toContain('RT');
  });

  it('deep-links an error when the mobile callback fails', async () => {
    googleService.handleLoginCallback.mockRejectedValueOnce(new Error('boom'));
    const res = mockRes();
    await controller.callback('code', 'login|mobile', res);
    expect(res.redirect).toHaveBeenCalledWith('cinely://auth?google_login=error&message=boom');
  });
```

- [ ] **Step 2: Run — must fail**

```bash
npm --prefix apps/backend test -- google.controller.spec
```

Expected: the mobile tests FAIL (today `state === 'login'` is false for `'login|mobile'`, so it falls into the connect branch); the web test PASSES already (that is the regression baseline).

- [ ] **Step 3: Implement**

In `callback`, replace the `if (state === 'login') {` line and its body's redirect section. The branch condition becomes a split, and the mobile path is added — everything else in the web path stays byte-identical:

```ts
    const [stateKind, statePlatform] = state.split('|');

    if (stateKind === 'login') {
      const isMobile = statePlatform === 'mobile';
      try {
        const tokens = await this.googleService.handleLoginCallback(code);

        if (isMobile) {
          // Native clients can't read the httpOnly refresh cookie, so we hand
          // back a short-lived, single-purpose code instead of tokens: the app
          // exchanges it over HTTPS at POST /auth/google/exchange. Keeping the
          // refresh token out of the cinely:// URL is the point.
          const code_ = this.jwtService.sign(
            { sub: tokens.userId, purpose: 'google-exchange' },
            { expiresIn: '60s', secret: process.env.JWT_ACCESS_SECRET },
          );
          return res.redirect(`cinely://auth?google_login=success&code=${code_}`);
        }

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/',
        };

        res.cookie('refreshToken', tokens.refreshToken, cookieOptions);
        return res.redirect(`${frontendUrl}/login?google_login=success&token=${tokens.accessToken}`);
      } catch (error) {
        const message = encodeURIComponent(error.message);
        return res.redirect(
          isMobile
            ? `cinely://auth?google_login=error&message=${message}`
            : `${frontendUrl}/login?google_login=error&message=${message}`,
        );
      }
    } else {
```

Note: the connect branch below (`const [userId, platform] = state.split('|')`) stays exactly as-is — do not merge it with the new split.

Known, accepted cost (state it in your report, do not "fix" it): on the mobile path `handleLoginCallback` still mints a token pair that goes unused, leaving one dormant `Session` row that expires on its own. Avoiding it would mean restructuring `loginOAuth`, which the web path depends on; the spec chose the additive route.

- [ ] **Step 4: Run — must pass**

```bash
npm --prefix apps/backend test -- google.controller.spec
```

Expected: 6 passed (2 from Task 1 + 4 here), including the untouched web redirect.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/google/google.controller.ts apps/backend/src/modules/google/google.controller.spec.ts
git commit -m "feat(backend): deep-link an exchange code for mobile Google sign-in

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `POST /auth/google/exchange`

**Files:**
- Create: `apps/backend/src/modules/auth/application/dto/google-exchange.dto.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts`

**Interfaces:**
- Consumes: Task 2's `issueTokensForUser`; Task 3's code format.
- Produces: `POST /api/auth/google/exchange` body `{ code }` → `200 { accessToken, refreshToken }`; `401` otherwise. Task 5 calls it.

- [ ] **Step 1: Write the failing tests**

Add to `auth.controller.spec.ts`. The controller currently injects only `AuthService`, so the suite's module must also provide `JwtService` after this task — update the existing `Test.createTestingModule` in that file to add `{ provide: JwtService, useValue: jwtService }` with `const jwtService = { verify: jest.fn() };` and import `JwtService` from `@nestjs/jwt`:

```ts
  describe('google exchange', () => {
    it('exchanges a valid code for both tokens', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1', purpose: 'google-exchange' });
      authService.issueTokensForUser = jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' });
      const res = mockRes();
      const out = await controller.googleExchange({ code: 'c' }, res);
      expect(authService.issueTokensForUser).toHaveBeenCalledWith('u1');
      expect(out).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
    });

    it('rejects a code with the wrong purpose (e.g. a real access token)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1', email: 'a@b.c' });
      await expect(controller.googleExchange({ code: 'c' }, mockRes())).rejects.toThrow();
    });

    it('rejects an expired or tampered code', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      await expect(controller.googleExchange({ code: 'c' }, mockRes())).rejects.toThrow();
    });
  });
```

- [ ] **Step 2: Run — must fail**

```bash
npm --prefix apps/backend test -- auth.controller.spec
```

Expected: FAIL — `controller.googleExchange` is not a function.

- [ ] **Step 3: Implement**

Create `apps/backend/src/modules/auth/application/dto/google-exchange.dto.ts` (match the style of a sibling DTO — read `refresh-token.dto.ts` first and mirror its decorators/imports):

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleExchangeDto {
  @ApiProperty({ description: 'One-time code from the cinely://auth deep link' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
```

In `auth.controller.ts`: import `JwtService` from `@nestjs/jwt`, `UnauthorizedException` from `@nestjs/common`, and the DTO; add `private readonly jwtService: JwtService` to the constructor (line 28); add the route:

```ts
  @ApiOperation({ summary: 'Exchange a mobile Google sign-in code for tokens' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google/exchange')
  @HttpCode(200)
  async googleExchange(@Body() dto: GoogleExchangeDto, @Res({ passthrough: true }) res: Response) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = this.jwtService.verify(dto.code, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }
    if (payload.purpose !== 'google-exchange') {
      throw new UnauthorizedException('Invalid sign-in code');
    }

    const { accessToken, refreshToken } = await this.authService.issueTokensForUser(payload.sub);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    // Always both tokens: only native clients reach this route, and they cannot
    // read the cookie (see tokenResponse's rule).
    return { accessToken, refreshToken };
  }
```

Verify `AuthModule` already imports `JwtModule` (the service uses `JwtService`); if the controller cannot resolve it, note that in your report rather than restructuring modules.

- [ ] **Step 4: Run — must pass**

```bash
npm --prefix apps/backend test -- auth.controller.spec
```

Expected: all green (the file's 2 pre-existing native-refresh tests + 3 new).

- [ ] **Step 5: Full backend suite (no regressions anywhere)**

```bash
npm --prefix apps/backend test
```

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/auth/application/dto/google-exchange.dto.ts apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.ts apps/backend/src/modules/auth/infrastructure/controllers/auth.controller.spec.ts
git commit -m "feat(backend): POST /auth/google/exchange for mobile sign-in codes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Mobile sign-in client + store method

**Files:**
- Create: `apps/mobile/src/lib/googleAuth.ts`
- Modify: `apps/mobile/src/stores/auth.ts`

**Interfaces:**
- Consumes: Tasks 1-4's endpoints.
- Produces:
  - `signInWithGoogle(): Promise<GoogleSignInResult>`, exported from `@/lib/googleAuth`, where
    `GoogleSignInResult = { status: 'success'; tokens: AuthTokens } | { status: 'error'; message: string } | { status: 'cancelled' }`
    (shape mirrors `ConnectResult` in `lib/google.ts`, plus the tokens the store needs).
  - `useAuthStore`'s `loginWithGoogle: () => Promise<GoogleSignInResult>` — same union, so Task 6 branches on `status` only and never touches `tokens`.
  - `AuthTokens` is already exported from `@/lib/types:11` (and imported by `stores/auth.ts:14`) — import it, don't redefine it.

- [ ] **Step 1: Read the precedents**

Read `apps/mobile/src/lib/google.ts:1-44` (connect flow: `openAuthSessionAsync` + manual `split('?')[1]` + `URLSearchParams` parsing) and `apps/mobile/src/stores/auth.ts` in full (note `establishSession(tokens, set)` at line 48 and how `login`/`register` use it, plus the `AuthState` interface at lines 22-40).

- [ ] **Step 2: Implement `apps/mobile/src/lib/googleAuth.ts`**

```ts
/**
 * Google SIGN-IN (authentication). Distinct from lib/google.ts, which links an
 * already-signed-in account to Drive/Calendar/Gmail.
 *
 * The backend can't hand a native client the httpOnly refresh cookie, so it
 * deep-links a 60s single-purpose code and we exchange it over HTTPS. No
 * refresh token ever rides in the cinely:// URL.
 */
import * as WebBrowser from 'expo-web-browser';

import { api } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import type { AuthTokens } from '@/lib/types';

/** Deep-link the backend redirects to after a mobile Google sign-in. */
const RETURN_URL = 'cinely://auth';

export type GoogleSignInResult =
  | { status: 'success'; tokens: AuthTokens }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const authUrl = `${API_BASE}/google/login?platform=mobile`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);

  if (result.type !== 'success' || !result.url) {
    return { status: 'cancelled' };
  }

  // result.url looks like cinely://auth?google_login=success&code=<jwt>
  const params = new URLSearchParams(result.url.split('?')[1] ?? '');
  if (params.get('google_login') !== 'success') {
    return { status: 'error', message: params.get('message') || 'Google sign-in failed' };
  }

  const code = params.get('code');
  if (!code) return { status: 'error', message: 'Google sign-in failed' };

  try {
    const { data } = await api.post<AuthTokens>('/auth/google/exchange', { code });
    return { status: 'success', tokens: data };
  } catch {
    return { status: 'error', message: 'Sign-in expired, please try again.' };
  }
}
```

If `AuthTokens` is not exported from `@/lib/types`, import it from wherever `stores/auth.ts` gets it (read that file's imports) — do not duplicate the type.

- [ ] **Step 3: Add `loginWithGoogle` to the store**

In `apps/mobile/src/stores/auth.ts`: declare it in the `AuthState` interface next to `login`, and implement it beside `login` using the existing `establishSession` seam:

```ts
  loginWithGoogle: async () => {
    const result = await signInWithGoogle();
    if (result.status === 'success') {
      await establishSession(result.tokens, set);
    }
    return result;
  },
```

Interface line (mirroring `login`'s doc-comment style):

```ts
  /** Runs the Google OAuth sign-in; establishes the session on success. */
  loginWithGoogle: () => Promise<GoogleSignInResult>;
```

- [ ] **Step 4: Typecheck**

```bash
cd "apps/mobile" && npx tsc --noEmit
```

Expected: no errors. (If expo-router's generated types complain about unrelated routes, run `CI=1 npx expo start` once to regenerate `.expo/types/router.d.ts`, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/googleAuth.ts apps/mobile/src/stores/auth.ts
git commit -m "feat(mobile): Google sign-in client + auth store method

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: The button on login and register

**Files:**
- Create: `apps/mobile/src/components/GoogleSignInButton.tsx`
- Modify: `apps/mobile/src/app/(auth)/login.tsx`
- Modify: `apps/mobile/src/app/(auth)/register.tsx`

**Interfaces:**
- Consumes: Task 5's `useAuthStore().loginWithGoogle`.
- Produces: the user-visible feature.

- [ ] **Step 1: Read both screens**

Read `apps/mobile/src/app/(auth)/login.tsx` (181 lines) and `register.tsx` in full. Match their existing `Palette` tokens, `StyleSheet` idiom, `TouchableOpacity activeOpacity={0.85}`, 50px control height, 12px radius, and error-text pattern (`styles.error`). Check whether `apps/mobile/src/components/` exists; if the repo puts shared components elsewhere, follow that location instead and say so in your report.

- [ ] **Step 2: Implement `GoogleSignInButton.tsx`**

A self-contained component: outlined button (`borderColor: Palette.border`, `backgroundColor: Palette.card`) with a "G" mark and the label "Continue with Google", height 50, radius 12. It owns its own loading state, calls `useAuthStore((s) => s.loginWithGoogle)`, and on success navigates with `router.replace('/(tabs)')` — the same destination `login.tsx:40` uses.

```tsx
type Props = { onError: (message: string) => void; disabled?: boolean };
```

Behavior: while in-flight show `<ActivityIndicator />` and disable; `status === 'cancelled'` → silently re-enable (no error); `status === 'error'` → `onError(result.message)`; `status === 'success'` → `router.replace('/(tabs)')`.

Also render a divider above it — a hairline with a centered "or" — matching the web's login layout, using `Palette.border` and `Palette.mutedForeground`.

- [ ] **Step 3: Mount on both screens**

In `login.tsx`, inside `styles.form`, after the "Sign in" `TouchableOpacity` (line 98) and before the "Forgot password?" `Link` (line 100):

```tsx
            <GoogleSignInButton onError={setError} disabled={loading} />
```

Do the same in `register.tsx` at the equivalent position (after its primary submit button, before its footer links), wiring `onError` to that screen's error setter and `disabled` to its loading flag. Add the import to both.

- [ ] **Step 4: Typecheck + lint**

```bash
cd "apps/mobile" && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/GoogleSignInButton.tsx apps/mobile/src/app/\(auth\)/login.tsx apps/mobile/src/app/\(auth\)/register.tsx
git commit -m "feat(mobile): 'Continue with Google' on login and register

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Verification

**Files:** none.

- [ ] **Step 1: Backend suite + build**

```bash
npm --prefix apps/backend test
npm --prefix apps/backend run build
```

Expected: all suites pass; nest build succeeds.

- [ ] **Step 2: Mobile typecheck**

```bash
cd "apps/mobile" && npx tsc --noEmit
```

- [ ] **Step 3: Confirm the frontend is untouched**

```bash
git diff --stat main..HEAD -- apps/frontend
```

Expected: **empty output** (global constraint).

- [ ] **Step 4: Confirm no refresh token can reach a deep link**

```bash
grep -rn "cinely://auth" apps/backend/src
```

Expected: only the two redirects from Task 3 — neither interpolates `refreshToken`.

- [ ] **Step 5: Report**

Summarize test counts, the four checks above, and hand off. Note for the human: this needs a **merge + backend deploy**, then an **APK v1.0.2 build** (per `apps/mobile/RELEASING.md`, with `EXPO_PUBLIC_API_URL="https://cinely.fr"`), before the emulator can exercise the real Google flow end-to-end.
