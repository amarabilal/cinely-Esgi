# Cinely Mobile App — Design Spec (Capacitor, Android-first)

**Date:** 2026-06-09
**Status:** Approved — ready for implementation plan
**Author:** brainstormed with Claude Code

## 1. Goal

Ship a native mobile app of Cinely to the **Play Store (Android first)** and, later, the
**App Store (iOS)**, by **wrapping the existing Vue 3 + Vite frontend in a Capacitor native
shell** rather than rewriting the UI. One codebase serves web and mobile; mobile-specific
behaviour is gated at runtime by `Capacitor.isNativePlatform()`.

## 2. Decisions locked during brainstorming

| Decision | Choice | Rationale |
|---|---|---|
| Build approach | **Capacitor** (reuse the Vue app) | Reuses notes/editor/auth/realtime/design-system as-is; fastest path to both stores |
| Feature scope | **Core notes app** | Auth, notes overview/search, TipTap editor, folders/tags, sharing, settings. Marketing pages excluded; legal as links |
| Offline | **Online-only v1** | Matches today's online-only realtime model; graceful offline banner; data layer left open to add caching later |
| Native features (v1) | **All four**: push, biometric lock, camera/photo attachments, native share-out (+ splash/icon/status-bar table-stakes) | User approved "yes to all" |
| Build target | **Android first** (local Android Studio on Windows); iOS deferred | iOS needs macOS/Xcode; user is on Windows |
| Backend URL | **`https://cinely.fr`** (already live: K3s + Traefik + Let's Encrypt) | No same-origin proxy in a packaged app → app points at the live API |

## 3. Constraints discovered in the codebase

- **Auth:** access token in `localStorage` sent as `Authorization: Bearer` (✅ WebView-friendly).
  Refresh token is an httpOnly cookie with `sameSite: 'lax'` (❌ not sent on cross-site XHR from
  the `https://localhost` WebView origin → silent logout). Requires a small, web-safe backend
  change: `/auth/refresh` also accepts/returns the refresh token in the body for native clients;
  native stores tokens in secure on-device storage.
- **API/socket URLs** are relative (`/api`, `/socket.io`) and rely on same-origin via Traefik.
  In a packaged app there is no same-origin → both must become an **absolute, env-driven URL**.
- **CORS** (HTTP in `main.ts` and Socket.IO in `notes.gateway.ts`) is locked to a single
  `FRONTEND_URL`. Must allow the Capacitor origins (`https://localhost`, `capacitor://localhost`).
- **Editor has no image support** (`@tiptap/extension-image` absent) and there is **no upload
  endpoint and no object storage**. Camera attachments require a TipTap image node + a new backend
  upload endpoint + a storage backend (local disk is ephemeral on K3s).
- **No notifications module** — push is a net-new backend module + an FCM project.
- **Router lands on `/` (marketing)** — native build must default to `/notes` / `/login` and hide
  marketing routes.

## 4. Architecture — wrap, don't fork

- Capacitor added **into `apps/frontend`**: `capacitor.config.ts` (`webDir: dist`), native
  `android/` (later `ios/`). The same `npm run build` output feeds both web and app.
- A small **runtime config + `tokenStore`** abstraction:
  - Native: base URL = `VITE_API_BASE_URL` (default `https://cinely.fr`); tokens in
    `@capacitor/preferences` / secure storage.
  - Web: unchanged (`/api`, `localStorage`).
- `src/api/client.ts` and `src/composables/useNoteSync.ts` (`io()`) take the absolute URL on native.

## 5. Backend changes (small, additive, web-safe)

1. `/auth/refresh` accepts the refresh token in the request body and returns it in the body when no
   cookie is present (native path). Web continues to use the cookie unchanged.
2. CORS allow-list (HTTP + socket gateway) becomes an array that includes the Capacitor origins.
3. **(Camera)** `POST /api/notes/:id/attachments` (or generic `/uploads`) → object storage
   (storage backend TBD in plan: MinIO/S3/Cloudinary) → returns a URL.
4. **(Push)** New `notifications` module: device-token entity, `POST /api/devices` register endpoint,
   FCM send service; triggers on share invite / permission change.

## 6. Mobile shell & native chrome (table-stakes)

Splash screen, app icon, status-bar theming synced to dark/light, Android **hardware back button**
wired to router/exit (`@capacitor/app`), safe-area insets (`env(safe-area-inset-*)`) for FAB / top
bar / cookie banner, light haptics on key actions. Native entry redirects to `/notes` (or `/login`);
marketing routes hidden; legal reachable from Settings as links.

## 7. Mobile UX polish (from the responsiveness audit — the "native feel" layer)

Concrete fixes identified by the audit: collapse the editor toolbar into a "More" menu; stack the
tag/folder inputs; make fixed-width dropdowns/modals responsive (`max-w`, `max-h` + scroll, centre on
mobile); ≥40px touch targets; make sidebar folder actions tappable (not hover-only); `dvh` for
full-height layouts; `text-base` inputs (kill iOS zoom-on-focus). Affected files (per audit):
`AppTopBar`, `ToolbarDropdown`, `ShareExportMenu`, `TagManager`, `LinkModal`, `CommandPalette`,
`ShareNoteModal`, `PermissionSelect`, `NoteEditorView`, `RegisterView`, `SettingsView`, `AppSidebar`,
`VersionHistoryModal`, `SecurityView`, `DashboardView`, `TwoFactorView`, `AppLayout`, `CookieConsent`.

## 8. Native features (all four — ordered by dependency)

1. **Splash / icon / status bar / back button / haptics** — table-stakes chrome (section 6).
2. **Biometric app lock** — *client-only.* `capacitor-native-biometric`; launch gate + Settings
   toggle; unlocks the stored token.
3. **Native share-out** — *client-only.* `@capacitor/share` from the note overflow menu.
4. **Camera / photo attachments** — *client + backend + storage.* `@capacitor/camera` → upload
   endpoint → object storage → TipTap `Image` node (syncs over the existing socket as HTML).
5. **Push notifications** — *client + backend + FCM.* `@capacitor/push-notifications` + the new
   `notifications` module; APNs deferred with iOS.

*Share-into-app (accept shared text/images to create a note) needs native intent filters — deferred
to a fast-follow unless prioritised.*

## 9. Build & release (Android first, on Windows)

`npx cap add android` → `npm run build && npx cap sync` → run in Android Studio on emulator + a
physical device. Release: signed AAB → Play Console ($25 one-time) + listing assets. iOS deferred to
a cloud-Mac CI (Codemagic / GH Actions) when ready; only push (APNs) and signing differ.

## 10. Error handling & testing

- Offline banner via `@capacitor/network`; existing `vue-sonner` toasts for API errors; socket
  auto-reconnect on app-resume; token expiry → silent refresh → login.
- Verification on a real Android device + emulator: login **persistence across app restart**,
  realtime sync over mobile network, biometric, share, camera-insert-and-sync, push receipt; keep
  the Playwright web suite green.

## 11. Out of scope (v1)

Offline-first editing; iOS release; share-into-app; marketing pages in-app; any redesign of existing
screens beyond the responsiveness polish.

## 12. Key risks

- **Auth refresh on native** — primary functional risk; mitigated by the body-based refresh change
  and on-device QA of restart persistence.
- **Image storage backend** — camera attachments are blocked until a storage choice is made
  (decide in the plan; MinIO on the existing cluster is the likely default).
- **FCM setup** — push requires a Firebase project + `google-services.json`; sender/credentials are
  operational prerequisites.
- **Play Store "minimum functionality"** — excluding marketing pages and keeping the app focused
  reduces review risk.
