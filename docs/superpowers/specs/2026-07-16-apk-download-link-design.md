# Design: "Download for Android" APK link

**Date:** 2026-07-16
**Status:** Approved (brainstorming session)
**Branch:** `feat/apk-download-link` (off `origin/main`)

## Goal

Let anyone get the Cinely Android app (the React Native app in `apps/mobile`) from the web app: a download link on the public landing page and in the logged-in Settings view, pointing at a properly signed APK hosted on GitHub Releases.

## Decisions (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Link placement | Landing page + footer + Settings card | Visitors discover the app on cinely.fr; existing users find it in Settings. Same link, two audiences. |
| APK hosting | GitHub Releases on `amarabilal/cinely-Esgi` (public repo) | Free, handles the ~104 MB file, versioned with notes, zero infra change. The `releases/latest/download/<asset>` URL is evergreen: publishing a new release updates the download without touching the web app. |
| Signing | Create a real release keystore before publishing | The existing APK is debug-signed. Publishing it would force every device to uninstall/reinstall when the signature later changes. A real keystore now means in-place updates forever. |
| Release process | Manual, documented (`gh release create` from the dev machine) | CI-building the native Android app in Actions is significant work for no current need. |

**Download URL (used everywhere):**
`https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk`

## Part 1 — Release pipeline

### One-time keystore setup

- Generate a release keystore with `keytool -genkeypair` → `apps/mobile/android/app/cinely-release.jks`.
- Store its passwords/alias in `apps/mobile/android/keystore.properties`.
- **Gitignore both** (add `cinely-release.jks` and `keystore.properties` to `apps/mobile/android/.gitignore`). The repo is public — neither file may ever be committed. Do not ignore `debug.keystore` (standard RN file, stays tracked).
- Wire `signingConfigs.release` in `apps/mobile/android/app/build.gradle` to read `keystore.properties` **when the file exists, falling back to the debug keystore when it doesn't** — so other machines and CI keep building without the secret.
- Document (in `RELEASING.md`, below) that the keystore must be backed up somewhere safe outside the repo: losing it means every installed device must uninstall/reinstall.

### Per-release process

1. Set the app version: `versionName`/`versionCode` in `apps/mobile/android/app/build.gradle` and `version` in `apps/mobile/app.json`, matching the release tag (first release: `v1.0.0`, versionCode 1).
2. Build: `cd apps/mobile/android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease` (CMake 3.31.4 pin is already committed; `debuggableVariants=[]` already embeds the JS bundle).
3. Verify the signature is the release key, not debug: `keytool -printcert -jarfile app-release.apk` (or `apksigner verify --print-certs`).
4. Rename the artifact to the stable asset name: copy `app-release.apk` → `cinely.apk` (the evergreen URL keys on the asset filename).
5. Publish: `gh release create v1.0.0 cinely.apk --title "Cinely Android v1.0.0" --notes "<short notes>"` (creates the tag on the current `main`).
6. Sanity-check the evergreen URL downloads the new file.

### Constraint created by `releases/latest`

`releases/latest` points at the repo's most recent release **of any kind**. Releases on this repo must therefore stay mobile-APK-only (today the web deploys via push-to-`main` and uses no releases, so this costs nothing). Recorded in `RELEASING.md`.

### Rollout order

Publish release `v1.0.0` **before** merging the UI changes, so the button never 404s.

## Part 2 — Web UI (`apps/frontend` only; the RN app is untouched)

All three surfaces link to the same evergreen URL via a plain `<a href>` (GitHub serves the asset as an attachment; no `download` attribute needed cross-origin). Existing design-system primitives and theme tokens only — no raw colors, dark-mode aware.

### Landing page — `src/views/public/HomeView.vue`

A "Get the app" section:

- Heading + one-line blurb, in the page's existing language and typographic rhythm.
- Primary button-styled anchor: "Download for Android (.apk)".
- Small print next to the button: file size (~104 MB) and minimum Android version (taken from `minSdkVersion` in `apps/mobile/android/app/build.gradle`).
- One-line sideload hint: users may need to allow installs from unknown sources. One line, not a tutorial.
- **QR code** of the download URL so desktop visitors can scan with their phone. Generated **once** with the `qrcode` npm CLI (`npx qrcode -t svg -o …`) and committed as a static asset (`apps/frontend/public/qr-android.svg`) — the URL is evergreen so no runtime QR library. Rendered on a small white rounded tile so it stays scannable in dark mode, with meaningful `alt` text.

### Footer — `src/components/layout/PublicLayout.vue`

Add an "Android app" entry to the footer links. The existing footer entries are router links driven by an array; extend the array with an `external` flag and render flagged entries as plain `<a href>` (with `rel="noopener"`), keeping the file's existing styling.

### Settings — `src/views/settings/SettingsView.vue`

A "Mobile app" `Card` with a short description and the same download button. Hidden when running inside the legacy Capacitor wrapper: `v-if="!isNative"` using the existing `@/lib/platform` export — an app shouldn't advertise its own APK.

## Part 3 — Edge cases

- **No 404 window:** release published before the UI merges (rollout order above).
- **Mobile data surprise:** file size is displayed next to the button.
- **No live version display:** the UI shows no version number (it would go stale or require a GitHub API fetch — non-goal).
- **Legacy Capacitor wrapper:** Settings card hidden via `isNative` (above). The public pages already redirect to the app when native, so the landing section needs no guard.

## Part 4 — Testing & docs

### Tests (Vitest, following existing frontend test conventions)

- Landing section renders the anchor with the exact evergreen URL.
- Settings card renders for web, and is absent when `isNative` is mocked `true`.

### Manual verification

- Web: section/footer/card render correctly in light + dark, desktop + mobile widths.
- End-to-end: download the APK from the live link on a real Android device, install, log in.
- `keytool -printcert -jarfile` on the downloaded file shows the release certificate.

### Docs — `apps/mobile/RELEASING.md`

Covers: keystore location + backup warning, the fallback-to-debug signing behavior, version bump locations, the build command with machine gotchas (JAVA_HOME, CMake pin), rename-to-`cinely.apk`, the `gh release create` command, and the "releases stay mobile-only" rule.

## Non-goals

- CI-built APKs / release automation in GitHub Actions
- Play Store publishing / AAB format
- iOS
- Live version number fetched from the GitHub API
- In-app update checks in the RN app

## Success criteria

1. A visitor on cinely.fr clicks the landing-page button (or scans the QR) and gets `cinely.apk`; it installs and the app works (login succeeds).
2. A logged-in user finds the same download in Settings.
3. Publishing a hypothetical `v1.0.1` release changes what the link serves with no frontend change or redeploy.
4. No keystore material is committed to the public repo.
