# Design: "Sign in with Google" on mobile

**Date:** 2026-07-16
**Status:** Approved (brainstorming session)
**Branch:** `feat/mobile-google-signin` (off `main` @ 0bb6922)

## Goal

Let users authenticate with Google from the mobile app's login/register screens, matching the web. Today the RN app has Google *connect* (Settings → link Calendar/Drive/Gmail for an already-authenticated user) but no Google *sign-in*.

## Why it's missing today

The backend has two distinct Google flows (`apps/backend/src/modules/google/google.controller.ts`):

| Flow | Entry | `state` | Callback behavior |
|---|---|---|---|
| **Connect** (link Google to an existing account) | `GET /google/auth?token=…&platform=mobile` (L44) | `"<userId>"` or `"<userId>\|mobile"` (L61) | Deep-links `cinely://google?…` when mobile (L212-223) — **mobile-aware** |
| **Sign-in** (authenticate into the app) | `GET /google/login` (L37) | `"login"` (service `getLoginAuthUrl`) | Always redirects to the **web** frontend (L200) — **no mobile branch** |

So there is nothing server-side for a mobile app to call. The June web-parity round ported the connect flow only.

## Why a backend change is unavoidable

A mobile-only implementation was evaluated and rejected — it cannot work, for two independent reasons:

1. **The app cannot capture the callback's redirect.** The sign-in branch ends at a web URL (`${FRONTEND_URL}/login?…`, L200). An Android app can intercept that only via a custom-scheme deep link (a backend change) or verified App Links (which needs `.well-known/assetlinks.json` hosted on cinely.fr — a frontend change). The third option, an embedded WebView, is blocked by Google for OAuth (`disallowed_useragent`).
2. **The refresh token is unreachable.** It is set as an **httpOnly cookie** (L199), which lives in the Custom Tab's browser jar. A native client cannot read it, so the session would expire at the access token's TTL with no way to refresh. This is exactly the case `auth.controller.ts:35` already legislates for native clients — a rule the Google path never implemented.

The change is therefore scoped to the smallest additive surface that satisfies both, and extends the convention the connect flow already established (`state = "<userId>|mobile"`, L61).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Token transport | Deep link carries a **short-lived one-time code**; app exchanges it over HTTPS for the token pair | Keeps a 7-day refresh token out of a `cinely://` URL. On Android any app may claim a custom scheme, so a URL-borne refresh token is interceptable. Follows RFC 8252's spirit. |
| Code implementation | **60-second signed JWT** (`purpose: "google-exchange"`), not a stored random code | Backend runs **2 replicas** (`k8s/40-backend/backend.yaml:20`) — an in-memory store would fail whenever callback and exchange hit different pods. Redis runs in infra but is **not wired into NestJS at all** (zero references in `apps/backend/src`); adding a Redis module for one code is disproportionate. A signed JWT is stateless, replica-safe, and `JwtService` is already injected into `GoogleController` (L31). |
| Button placement | Login **and** register screens | Matches web (`LoginView.vue` and `RegisterView.vue` both have it). |
| Google Cloud Console | **No change** | The OAuth redirect URI stays `https://cinely.fr/api/google/callback`. The deep-link happens server-side, after the callback. |

## Architecture

```
App: tap "Sign in with Google"
  └─ WebBrowser.openAuthSessionAsync(
       "https://cinely.fr/api/google/login?platform=mobile", "cinely://")
Google consent → GET /api/google/callback?code=…&state=login|mobile
  └─ handleLoginCallback(code)  → creates/finds user, mints tokens (unchanged)
  └─ mobile branch: sign 60s JWT { sub: userId, purpose: "google-exchange" }
  └─ redirect  cinely://auth?google_login=success&code=<jwt>
       (errors:  cinely://auth?google_login=error&message=…)
App receives the deep link
  └─ POST /api/auth/google/exchange { code }  →  { accessToken, refreshToken }
  └─ persist via existing session store → navigate to the notes tab
```

The **web path is untouched**: `state === "login"` (no suffix) keeps setting the refresh cookie and redirecting to `${FRONTEND_URL}/login?google_login=success&token=…`.

## Components

### Backend (`apps/backend`) — additive only

1. **`GoogleService.getLoginAuthUrl(platform?: string)`** — returns `getAuthUrl(platform === 'mobile' ? 'login|mobile' : 'login')`. Mirrors the connect flow's existing `|mobile` convention.
2. **`GoogleController.loginRedirect`** — accepts `@Query('platform')` and passes it through.
3. **`GoogleController.callback`** — replace the `state === 'login'` equality with a `|` split so `login` and `login|mobile` both enter the sign-in branch. Within it: web keeps today's cookie+redirect; mobile signs the exchange code and deep-links. The connect branch is untouched.
   - The callback needs the `userId`. `handleLoginCallback` currently returns `{ accessToken, refreshToken }` only; extend it (and `AuthService.loginOAuth` if needed) to also return `userId`. Do **not** decode the freshly-minted access token to recover a value the code already had.
4. **`POST /auth/google/exchange`** (auth controller, public): body `{ code: string }`. Verifies the JWT with the access secret, requires `purpose === 'google-exchange'`, then mints a fresh token pair for `sub` and returns **both tokens in the body** — the rule `auth.controller.ts:35` already states for native clients ("Web gets only the access token… Native also gets the refresh token"). Invalid/expired/wrong-purpose/tampered → `401`.

### Mobile (`apps/mobile`)

1. **`src/lib/googleAuth.ts`** — sign-in only, deliberately separate from `src/lib/google.ts` (which links Calendar/Drive). Opens the auth session, parses the returned deep link, POSTs the exchange, returns a discriminated result (`success` / `error` / `cancelled`) mirroring `google.ts`'s `ConnectResult` shape.
2. **`GoogleSignInButton`** component — shared by `src/app/(auth)/login.tsx` and `src/app/(auth)/register.tsx`, styled to the app's existing auth buttons.
3. Session persistence and navigation reuse the existing auth store — no changes to how the app stays logged in.

## Error handling

- User cancels the Google consent screen → `openAuthSessionAsync` returns `cancel`/`dismiss` → no error shown, button re-enables.
- Backend error during callback → deep link carries `google_login=error&message=…` → shown inline on the login screen, matching the web's error surface.
- Exchange rejected (expired/replayed after use of a new one/tampered) → inline "Sign-in expired, please try again."
- No network → the app's existing API error surface.

## Known properties (inherited, not introduced)

- **Google sign-in bypasses 2FA.** The web behaves the same way today (the callback mints tokens directly, never checking `twoFactorEnabled`). Matching that is intentional; changing it is out of scope.
- **The exchange code is replayable inside its 60-second window.** Strict single-use needs shared storage (Redis/Postgres) — rejected above as disproportionate. The window is short, the transport is HTTPS, and the legitimate app consumes the code immediately.

## Testing

**Backend unit tests** (Jest, existing infra):
- `getLoginAuthUrl()` → state `login`; `getLoginAuthUrl('mobile')` → state `login|mobile`.
- `callback` with `state=login` → web redirect + refresh cookie set (regression: unchanged).
- `callback` with `state=login|mobile` → redirects to `cinely://auth?…code=…`, sets **no** cookie, and the code verifies to `{ sub, purpose }`.
- `POST /auth/google/exchange`: valid code → both tokens; expired → 401; wrong `purpose` (e.g. a real access token) → 401; tampered signature → 401.

**Manual, on the emulator** — now genuinely possible: the released APK targets `https://cinely.fr`, which Google *can* reach (the old blocker was Google being unable to redirect to `localhost:3000`). Requires this branch's backend to be deployed first.

## Sequencing

The mobile app talks to the **deployed** backend, so:

1. Merge this branch → CI deploys the backend to cinely.fr.
2. Build APK **v1.0.2** per `apps/mobile/RELEASING.md` (with `EXPO_PUBLIC_API_URL="https://cinely.fr"`) and publish the release — the evergreen download link updates itself.
3. Verify on the emulator: tap "Sign in with Google" → consent → land in the notes tab.

## Non-goals

- Google sign-in on iOS (no macOS)
- Native Google Sign-In SDK / one-tap (the web-browser flow is sufficient and reuses the existing backend)
- Changing 2FA behavior for OAuth logins
- Strict single-use codes / Redis integration
- Apple or other OAuth providers

## Success criteria

1. From a fresh install, tapping "Sign in with Google" on the login screen completes consent and lands in the notes tab, authenticated against production.
2. The same account signing in via Google on web and mobile reaches the same notes.
3. The web Google sign-in flow is byte-for-byte unchanged (cookie + `/login?token=…`).
4. No refresh token ever appears in a `cinely://` URL.
