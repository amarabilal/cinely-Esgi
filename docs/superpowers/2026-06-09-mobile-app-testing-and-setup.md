# Cinely Mobile App — Setup & Testing Guide

Branch: `feat/mobile-app-capacitor`. The Vue web app is wrapped with **Capacitor** for Android.
Everything below assumes Windows + the repo at `C:\Users\ADMIN\Desktop\ESGI\Projet anuel\cinely-Esgi`.

## What was built (all committed on the branch)

| Area | Feature |
|---|---|
| Foundation | Capacitor + Android project; absolute API/socket URL; token-based auth that survives app restart; CORS for Capacitor origins; native shell (splash, status bar, hardware back); safe-area insets + `dvh`; offline banner; native entry routing |
| Biometric | Face/fingerprint app lock (launch + resume), Settings toggle |
| Share | Native OS share sheet for a note (web fallback) |
| Camera | Photo attachments — capture/pick → upload → insert image; Postgres-backed image storage; public image URLs |
| Push | Device-token registration + FCM push when a note is shared (graceful no-op until Firebase is configured) |
| Polish | Branded violet app icon + dark splash |

Tests: **14 frontend unit tests + 68 backend tests** pass. Web behavior is unchanged.

## Why you can't just point at cinely.fr yet

The live `https://cinely.fr` still runs the **old** backend. It does **not** allow the Capacitor
app origin (`https://localhost`) in CORS and lacks the new endpoints (body-based refresh, `/uploads`,
`/devices`). So the app must talk to the **branch** backend. Two ways:

- **Path A — local backend (recommended for testing):** run the whole stack with Docker, point the
  app at it from an Android emulator. Self-contained, no servers to deploy.
- **Path B — deploy the branch:** deploy this branch's backend to your cluster so `cinely.fr` has the
  new code, then the app uses the default HTTPS URL with zero extra config.

---

## Path A — test locally on an Android emulator (recommended)

### 1. Start the backend stack (branch code)
From the repo root:
```powershell
docker-compose up
```
This starts the **branch** backend (NestJS) + Postgres + Redis + Mailhog. The new `attachments` and
`device_tokens` tables auto-create in dev (TypeORM `synchronize`). Backend is at `http://localhost:3000`.

### 2. Point the app at the local backend and build
The Android **emulator** reaches your PC via the special IP `10.0.2.2`. Build the web bundle with that
backend URL and copy it into the Android project:
```powershell
cd "C:\Users\ADMIN\Desktop\ESGI\Projet anuel\cinely-Esgi\apps\frontend"
$env:VITE_API_BASE_URL = "http://10.0.2.2:3000"
npm run build
npx cap sync android
```
(The debug build allows plain-HTTP to local hosts via a debug-only network-security config; release
builds stay HTTPS-only.)

### 3. Open and run in Android Studio
```powershell
npx cap open android
```
- Android Studio opens. Top toolbar: pick a virtual device (if none, **Device Manager → Create Device →
  Pixel 7, system image API 34**, download if needed).
- Press the green **Run ▶** button. The app installs and launches on the emulator.

### 4. What to check (tap through these)
- **App icon + splash:** violet note icon in the launcher; short dark splash on open.
- **Login:** lands on the login screen → log in (register a new account if needed — emails show in
  Mailhog at `http://localhost:8025`). You reach the notes list.
- **Create/edit a note:** type; it autosaves.
- **Realtime:** open `http://localhost:5173` in your PC browser (the docker frontend), open the same
  note, edit in one → see it update in the other.
- **Stay logged in:** swipe the app away (fully close), reopen → still logged in, notes load.
- **Photo attachment:** in a note type `/` → choose **Image** (or the toolbar Insert → image) → take a
  photo / pick one → it uploads and appears in the note. Allow the camera permission when asked.
- **Share:** open a note's share/export menu → **Share…** → the Android share sheet appears.
- **Biometric lock** (emulator must have a fingerprint enrolled: Settings → Security → Fingerprint;
  to "scan" on an emulator use Extended Controls `...` → Fingerprint → Touch): Cinely **Settings →
  App Lock** toggle on → background and reopen the app → it asks for biometrics.
- **Offline banner:** toggle the emulator to airplane mode → a red "You're offline" bar appears →
  turn it back → it disappears.
- **Back button:** the device back gesture navigates within the app, then backgrounds it at the notes list.

> Push notifications do **not** work in Path A unless you also do the Firebase setup below — that's
> expected.

---

## Path B — test against your live server

1. Deploy this branch's **backend** so `https://cinely.fr` runs the new code (your CI/CD deploys on
   push). Create the two new tables in prod first (see "Production checklist").
2. Build the app with the default URL (no env needed) and run it:
   ```powershell
   cd "C:\Users\ADMIN\Desktop\ESGI\Projet anuel\cinely-Esgi\apps\frontend"
   npm run build
   npx cap sync android
   npx cap open android
   ```
3. The app uses `https://cinely.fr` over HTTPS — no cleartext config needed. Run through the same
   checklist as Path A.

---

## Testing on a real phone (instead of the emulator)
1. On the phone: Settings → About → tap "Build number" 7× to enable Developer options → enable **USB
   debugging**. Plug it into the PC.
2. For **Path A**, the phone can't use `10.0.2.2`; use your PC's LAN IP instead, e.g.
   `$env:VITE_API_BASE_URL = "http://192.168.1.50:3000"` (find it with `ipconfig`), allow port 3000
   through the Windows firewall, then `npm run build; npx cap sync android`.
3. In Android Studio, select your phone in the device dropdown and press Run.

---

## Enabling push notifications (Firebase — your account needed)
Push code is complete but inert until you connect Firebase:
1. Create a Firebase project at <https://console.firebase.google.com>.
2. Add an **Android app** with package name `fr.cinely.app`. Download **`google-services.json`** and
   place it at `apps/frontend/android/app/google-services.json`. (The Gradle build auto-activates the
   Google-services plugin once this file exists.)
3. In **Project settings → Service accounts**, generate a private key (JSON). On the backend, set env
   `FCM_SERVICE_ACCOUNT` to that JSON (single line), or `GOOGLE_APPLICATION_CREDENTIALS` to its path.
4. `npm run build; npx cap sync android`, rebuild in Android Studio. Now sharing a note with another
   user sends them a push; tapping it opens the note.

---

## Production checklist (when you deploy the branch)
- Create the new tables (prod has `synchronize` off):
  ```sql
  CREATE TABLE attachments ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mime_type varchar NOT NULL,
    size integer NOT NULL, data bytea NOT NULL, owner_id uuid NOT NULL, created_at timestamp NOT NULL DEFAULT now() );
  CREATE TABLE device_tokens ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
    token varchar NOT NULL UNIQUE, platform varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now() );
  ```
  (Match the uuid default to the project's existing convention / required extension.)
- Set `PUBLIC_BASE_URL=https://cinely.fr` on the backend (used to build absolute image URLs; defaults to
  `https://cinely.fr` already).
- (Optional) Set the FCM env for push (above).
- The new CORS allow-list already includes the Capacitor origins.

## Known watch-items
- **Image storage** uses Postgres `bytea` (replica-safe, no new infra). Fine for a notes app; swap to
  S3/MinIO later if image volume grows.
- **Public image URLs**: `GET /api/uploads/:id` is unauthenticated (so `<img>` tags load); access control
  is the unguessable UUID. Acceptable for v1; add per-note authorization or signed URLs to harden.
- **Token storage**: refresh token sits in Capacitor Preferences (not encrypted secure storage) — a
  future hardening step.
