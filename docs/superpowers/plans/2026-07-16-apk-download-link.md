# Android APK Download Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a properly-signed Cinely Android APK on GitHub Releases and link it from the web app (landing page, footer, Settings).

**Architecture:** A one-time release keystore + Gradle signing config (with debug fallback) produces a signed APK, published manually as GitHub release `v1.0.0` whose asset is reachable at the evergreen URL `https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk`. The frontend gets one constants module (`src/lib/appLinks.ts`), an `href` extension to the `Button` primitive, and three consumers: a landing-page section component (with a committed static QR SVG), a footer link, and a Settings card hidden on the legacy Capacitor shell.

**Tech Stack:** Gradle/keytool (PKCS12 keystore), `gh` CLI, Vue 3 + Vite + Tailwind tokens, Vitest + `@vue/test-utils` (new devDependency), `qrcode` npm CLI (one-shot via npx).

**Spec:** `docs/superpowers/specs/2026-07-16-apk-download-link-design.md`

## Global Constraints

- Download URL, used verbatim everywhere: `https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk`
- **Never commit** `cinely-release.jks` or `keystore.properties` — the repo is PUBLIC. Verify with `git status` before every commit in Tasks 1–4.
- Releases on this repo must stay mobile-APK-only (`releases/latest` keys on the newest release of any kind).
- Release `v1.0.0` must be published (Task 3) before the UI tasks merge — keep task order.
- Frontend: theme tokens only (`bg-card`, `text-muted-foreground`, …), no raw colors; copy in English; follow existing file style.
- Size/OS labels: `~110 MB` and `Android 7.0+` (minSdkVersion 24 — Expo default, confirmed in merged manifest).
- All shell commands below are **Git Bash** syntax, run from the repo root `C:\Users\ADMIN\Desktop\ESGI\Projet anuel\cinely-Esgi` unless a `cd` is shown.
- Frontend unit tests: `npm --prefix apps/frontend run test:unit` (there is no plain `test` script). Vitest only picks up `src/**/*.spec.ts`.
- Commits on branch `feat/apk-download-link`; every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Release signing config (keystore + Gradle wiring)

**Files:**
- Modify: `apps/mobile/android/.gitignore`
- Create (NOT committed): `apps/mobile/android/app/cinely-release.jks`, `apps/mobile/android/keystore.properties`
- Modify: `apps/mobile/android/app/build.gradle` (signingConfigs at lines 104–111, release buildType at lines 116–127, loader inserted above the `android {` block)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `./gradlew assembleRelease` signs with alias `cinely` from `cinely-release.jks` when `keystore.properties` exists, else falls back to debug signing. Task 2 relies on this.

- [ ] **Step 1: Gitignore the secrets FIRST**

Append to `apps/mobile/android/.gitignore` (after the existing `*.jsbundle` line):

```
# Release signing — never commit (public repo); see apps/mobile/RELEASING.md
keystore.properties
*.jks
```

- [ ] **Step 2: Verify git ignores both paths (test-before-create)**

```bash
cd "apps/mobile/android"
git check-ignore -v keystore.properties app/cinely-release.jks
```

Expected: two lines, each naming a `.gitignore` rule. If either path prints nothing, STOP and fix the ignore file before generating any secret.

- [ ] **Step 3: Generate the keystore and keystore.properties**

```bash
cd "apps/mobile/android"
KT="/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe"
STOREPASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-24)"
"$KT" -genkeypair -v -storetype PKCS12 \
  -keystore app/cinely-release.jks -alias cinely \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$STOREPASS" -keypass "$STOREPASS" \
  -dname "CN=Cinely, OU=Mobile, O=Cinely, L=Paris, C=FR"
printf 'storeFile=cinely-release.jks\nstorePassword=%s\nkeyAlias=cinely\nkeyPassword=%s\n' "$STOREPASS" "$STOREPASS" > keystore.properties
```

Expected: keytool prints `[Storing app/cinely-release.jks]`. `keystore.properties` has 4 lines. (PKCS12: store and key password are identical by design.)

- [ ] **Step 4: Wire Gradle — properties loader**

In `apps/mobile/android/app/build.gradle`, insert immediately ABOVE the `android {` line (the block whose `defaultConfig` sits at lines 95–103):

```gradle
// Release signing: reads android/keystore.properties when present (gitignored;
// see apps/mobile/RELEASING.md). Absent -> release falls back to debug signing
// so fresh checkouts and CI keep building.
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

- [ ] **Step 5: Wire Gradle — signingConfigs + release buildType**

Replace the existing `signingConfigs` block (currently lines 104–111):

```gradle
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
```

In the `release` buildType, replace these three lines (currently 117–119):

```gradle
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
```

with:

```gradle
            // Signed with the release keystore when android/keystore.properties
            // exists; otherwise falls back to debug signing (fresh checkout / CI).
            signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug
```

Note: `storeFile file('cinely-release.jks')` resolves relative to the app module — the `.jks` lives at `apps/mobile/android/app/cinely-release.jks`, matching `storeFile=cinely-release.jks` in the properties file.

- [ ] **Step 6: Verify with signingReport**

```bash
cd "apps/mobile/android"
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew -q :app:signingReport 2>&1 | grep -B2 -A8 "Variant: release$"
```

Expected: the `release` variant shows `Config: release`, `Store: ...\app\cinely-release.jks`, `Alias: cinely`. If it shows `Alias: androiddebugkey`, the wiring is wrong — stop and fix.

- [ ] **Step 7: Confirm no secret is staged, then commit**

```bash
git status --short   # must NOT list any .jks or keystore.properties
git add apps/mobile/android/.gitignore apps/mobile/android/app/build.gradle
git commit -m "feat(mobile): release signing via gitignored keystore.properties

Release builds sign with cinely-release.jks (alias cinely) when
android/keystore.properties exists; fresh checkouts and CI fall back
to debug signing. Both secret files are gitignored (public repo).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Build the signed release APK and verify its signature

**Files:**
- No repo changes. Artifact produced: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (gitignored).

**Interfaces:**
- Consumes: Task 1's signing config.
- Produces: a release-signed APK + its byte size, used by Task 3 (upload) and Task 5 (size label cross-check).

- [ ] **Step 1: Preflight — version matches the tag we'll publish**

`apps/mobile/android/app/build.gradle` lines 99–100 must read `versionCode 1` / `versionName "1.0.0"`, and `apps/mobile/app.json` must have `"version": "1.0.0"`. (All three were confirmed at plan time — just re-check, don't edit.)

- [ ] **Step 2: Build (long — 10–20 min; do not kill it early)**

```bash
cd "apps/mobile/android"
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
```

Expected: `BUILD SUCCESSFUL`. (CMake 3.31.4 pin is already committed; `debuggableVariants=[]` embeds the JS bundle — no Metro needed.)

- [ ] **Step 3: Verify the APK is signed with the RELEASE key**

```bash
cd "apps/mobile/android"
"/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" -printcert -jarfile app/build/outputs/apk/release/app-release.apk | head -8
```

Expected: `Owner: CN=Cinely, OU=Mobile, O=Cinely, L=Paris, C=FR`. If it prints `CN=Android Debug`, the fallback fired — check `keystore.properties` exists, then rebuild.

- [ ] **Step 4: Record the size**

```bash
stat -c%s "apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
```

Expected: a number near 109,000,000 (~109 MB decimal). Note it for Tasks 3 and 5.

---

### Task 3: Publish GitHub release v1.0.0 with the APK

**Files:**
- No repo changes. Creates tag `v1.0.0` + release + asset `cinely.apk` on `amarabilal/cinely-Esgi`.

**Interfaces:**
- Consumes: the signed APK from Task 2.
- Produces: the live evergreen URL `https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk` that all frontend tasks link to.

- [ ] **Step 1: Preflight — push permission and no existing releases**

```bash
gh api repos/amarabilal/cinely-Esgi --jq .permissions   # expect "push":true (confirmed at plan time)
gh release list -R amarabilal/cinely-Esgi               # expect empty (v1.0.0 must be first)
```

- [ ] **Step 2: Stage the asset under its stable name**

The evergreen URL keys on the asset FILENAME, so it must be exactly `cinely.apk`:

```bash
cp "apps/mobile/android/app/build/outputs/apk/release/app-release.apk" /tmp/cinely.apk
```

- [ ] **Step 3: Create the release**

```bash
gh release create v1.0.0 /tmp/cinely.apk \
  -R amarabilal/cinely-Esgi --target main \
  --title "Cinely Android v1.0.0" \
  --notes "First public Android build of Cinely.

- Requires Android 7.0+ (API 24). Download size ~110 MB.
- Download \`cinely.apk\` below, open it on your phone, and allow installs from unknown sources if prompted.
- If you previously installed a test/debug build of Cinely, uninstall it first — the signing key changed.

Note: releases on this repo are reserved for Android app builds so that the
\`releases/latest/download/cinely.apk\` link always serves the newest APK."
```

Expected: prints the release URL. Upload takes a few minutes (~110 MB).

- [ ] **Step 4: Verify the evergreen URL serves the exact bytes**

```bash
curl -sIL "https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk" | grep -iE "^HTTP|^content-length"
```

Expected: redirect chain ending in `HTTP/2 200` with `content-length` equal to Task 2 Step 4's number. This URL is now live — the UI can safely link it.

---

### Task 4: RELEASING.md

**Files:**
- Create: `apps/mobile/RELEASING.md`

**Interfaces:**
- Consumes: facts from Tasks 1–3.
- Produces: the documented per-release process (referenced by comments committed in Task 1).

- [ ] **Step 1: Write the doc**

Create `apps/mobile/RELEASING.md` with exactly this content:

```markdown
# Releasing the Android app

The web app links to the **evergreen URL**
`https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk`.
Publishing a new release updates what users download — no frontend change or
redeploy needed.

## Rules

- **Releases on this repo are Android-APK-only.** `releases/latest` points at
  the newest release of ANY kind; a non-APK release would break the download
  link. (Web deploys go through push-to-main CI and don't use releases.)
- **Never commit signing material.** `android/keystore.properties` and
  `android/app/cinely-release.jks` are gitignored — keep it that way; the repo
  is public.
- **Back up the keystore.** Copy `android/app/cinely-release.jks` AND
  `android/keystore.properties` somewhere safe outside the repo (password
  manager / private drive). Losing them means the next APK has a new signature
  and every installed device must uninstall/reinstall.

## Per-release process

1. **Bump versions** (keep them in sync with the tag):
   - `android/app/build.gradle`: `versionCode` (+1 every release) and
     `versionName "X.Y.Z"`.
   - `app.json`: `"version": "X.Y.Z"`.
2. **Build** (10–20 min), from `apps/mobile/android`, in Git Bash:
   ```bash
   JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
   ```
   Machine gotchas already handled in the repo: CMake is pinned to 3.31.4 in
   `android/build.gradle` (3.22's ninja loops on the space in "Projet anuel");
   `debuggableVariants=[]` embeds the JS bundle.
3. **Verify the signature** — must be the release key, not debug:
   ```bash
   "/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" \
     -printcert -jarfile app/build/outputs/apk/release/app-release.apk | head -3
   ```
   Expect `Owner: CN=Cinely, ...`. `CN=Android Debug` means
   `android/keystore.properties` was missing during the build.
4. **Publish** — the asset name MUST be `cinely.apk`:
   ```bash
   cp app/build/outputs/apk/release/app-release.apk /tmp/cinely.apk
   gh release create vX.Y.Z /tmp/cinely.apk -R amarabilal/cinely-Esgi \
     --target main --title "Cinely Android vX.Y.Z" --notes "<what changed>"
   ```
5. **Check the evergreen URL** serves the new build:
   ```bash
   curl -sIL "https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk" \
     | grep -iE "^HTTP|^content-length"
   ```
6. If the APK size drifted by more than ~10 MB, update
   `ANDROID_APK_SIZE_LABEL` in `apps/frontend/src/lib/appLinks.ts`.

## Device notes

- Sideloading asks users to allow installs from unknown sources.
- Installing over an app signed with a DIFFERENT key fails silently with
  `adb install -r` — uninstall first (`adb uninstall fr.cinely.app`).
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/RELEASING.md
git commit -m "docs(mobile): Android release process (keystore, build, gh release)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend foundation — appLinks module, QR asset, test dep

**Files:**
- Create: `apps/frontend/src/lib/appLinks.ts`
- Create: `apps/frontend/src/lib/__tests__/appLinks.spec.ts`
- Create: `apps/frontend/public/qr-android.svg` (generated, committed)
- Modify: `apps/frontend/package.json` + lockfile (add `@vue/test-utils` devDependency)

**Interfaces:**
- Consumes: the live URL from Task 3.
- Produces: `ANDROID_APK_URL: string`, `ANDROID_APK_SIZE_LABEL: string`, `ANDROID_MIN_VERSION_LABEL: string` (named exports of `@/lib/appLinks`) and the static asset `/qr-android.svg` — used by Tasks 6–9. Also installs `@vue/test-utils` used by Tasks 6, 7, 9.

- [ ] **Step 1: Install the component-test utility (repo has none yet)**

```bash
npm --prefix apps/frontend install -D @vue/test-utils
```

Expected: added to devDependencies; existing suite still passes (`npm --prefix apps/frontend run test:unit`).

- [ ] **Step 2: Write the failing test**

Create `apps/frontend/src/lib/__tests__/appLinks.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ANDROID_APK_URL, ANDROID_APK_SIZE_LABEL, ANDROID_MIN_VERSION_LABEL } from '../appLinks';

describe('appLinks', () => {
  it('points at the evergreen GitHub Releases asset', () => {
    expect(ANDROID_APK_URL).toBe(
      'https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk',
    );
  });

  it('exposes human-readable size and minimum OS labels', () => {
    expect(ANDROID_APK_SIZE_LABEL).toMatch(/MB$/);
    expect(ANDROID_MIN_VERSION_LABEL).toMatch(/^Android /);
  });
});
```

- [ ] **Step 3: Run it — must fail (module doesn't exist)**

```bash
npm --prefix apps/frontend run test:unit -- src/lib/__tests__/appLinks.spec.ts
```

Expected: FAIL — cannot resolve `../appLinks`.

- [ ] **Step 4: Implement `apps/frontend/src/lib/appLinks.ts`**

```ts
/**
 * Where the Android app is published. GitHub Releases evergreen URL:
 * `releases/latest/download/<asset>` always serves the newest release's
 * asset, so new APK versions require NO frontend change or redeploy.
 * Process + rules: apps/mobile/RELEASING.md.
 */
export const ANDROID_APK_URL =
  'https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk';

/** Shown next to download buttons so mobile-data users aren't surprised. */
export const ANDROID_APK_SIZE_LABEL = '~110 MB';

/** minSdkVersion 24 (Expo default for apps/mobile) = Android 7.0. */
export const ANDROID_MIN_VERSION_LABEL = 'Android 7.0+';
```

Cross-check the size label against the real asset (Task 2 Step 4 / `gh release view v1.0.0 -R amarabilal/cinely-Esgi --json assets --jq '.assets[0].size'`): if it's outside 100–120 MB, adjust `ANDROID_APK_SIZE_LABEL` to the nearest 10 MB.

- [ ] **Step 5: Run the test — must pass**

```bash
npm --prefix apps/frontend run test:unit -- src/lib/__tests__/appLinks.spec.ts
```

Expected: 2 passed.

- [ ] **Step 6: Generate the QR SVG (one-shot, committed — URL is evergreen)**

```bash
cd "apps/frontend"
npx --yes qrcode -t svg -o public/qr-android.svg "https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk"
head -c 120 public/qr-android.svg
```

Expected: file starts with `<svg` (or an `<?xml` prolog then `<svg`). Keep the default margin (quiet zone) — do not pass `-m 0`.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/lib/appLinks.ts apps/frontend/src/lib/__tests__/appLinks.spec.ts apps/frontend/public/qr-android.svg apps/frontend/package.json apps/frontend/package-lock.json
git status --short   # nothing else staged
git commit -m "feat(frontend): appLinks constants + Android download QR asset

Adds @vue/test-utils (dev) for the component tests that follow.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `Button` primitive — external `href` support

**Files:**
- Modify: `apps/frontend/src/components/ui/button/Button.vue`
- Create: `apps/frontend/src/components/ui/button/__tests__/Button.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<Button :href="string">` renders a styled `<a :href>` with `rel="noopener"`; existing `to` (RouterLink) and plain-button behavior unchanged. Tasks 7 and 9 use `:href` with `ANDROID_APK_URL`.

- [ ] **Step 1: Read the current component**

Read `apps/frontend/src/components/ui/button/Button.vue` in full. Its props (lines 10–20) are `variant/size/type/to`; classes come from `variantClasses`/`sizeClasses` computed maps (lines 22–35). The template renders a `<RouterLink>` branch when `to` is set, else a `<button>` — note the exact `:class` binding expression they share; the new anchor branch must reuse it verbatim.

- [ ] **Step 2: Write the failing test**

Create `apps/frontend/src/components/ui/button/__tests__/Button.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Button } from '../index';

describe('Button', () => {
  it('renders a plain <button> by default', () => {
    const w = mount(Button, { slots: { default: 'Click' } });
    expect(w.find('button').exists()).toBe(true);
    expect(w.text()).toBe('Click');
  });

  it('renders an <a rel="noopener"> when href is set', () => {
    const w = mount(Button, {
      props: { href: 'https://example.com/file.apk', size: 'lg' },
      slots: { default: 'Download' },
    });
    const a = w.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toBe('https://example.com/file.apk');
    expect(a.attributes('rel')).toBe('noopener');
    expect(w.find('button').exists()).toBe(false);
    expect(a.classes().length).toBeGreaterThan(0); // shares the button styling
  });
});
```

- [ ] **Step 3: Run it — the href test must fail**

```bash
npm --prefix apps/frontend run test:unit -- src/components/ui/button/__tests__/Button.spec.ts
```

Expected: first test passes, `href` test FAILS (no `<a>` rendered; unknown prop).

- [ ] **Step 4: Implement**

In `Button.vue`:
1. Add to the props interface, right after the `to?: string;` line:

```ts
  /** When set, the button renders as an external <a href> (rel="noopener"). */
  href?: string;
```

2. In the template, add an anchor branch ABOVE the RouterLink branch: copy the existing `<RouterLink>` element verbatim, then in the copy change the tag to `a`, replace `:to="to"` with `:href="href"`, add `rel="noopener"`, and set `v-if="href"`. Keep the `:class` binding and slot **byte-identical** to the RouterLink branch (that binding applies `variantClasses`/`sizeClasses`):

```vue
  <a
    v-if="href"
    :href="href"
    rel="noopener"
    :class="…same :class value as the RouterLink element you copied…"
  >
    <slot />
  </a>
```

Then make the RouterLink branch `v-else-if="to"` (it is currently the `v-if`). The plain `<button>` stays the final `v-else`.

- [ ] **Step 5: Run tests — all pass**

```bash
npm --prefix apps/frontend run test:unit -- src/components/ui/button/__tests__/Button.spec.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/ui/button
git commit -m "feat(frontend): Button supports external href rendering

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Landing page "Get the app" section

**Files:**
- Create: `apps/frontend/src/components/marketing/GetTheAppSection.vue`
- Create: `apps/frontend/src/components/marketing/__tests__/GetTheAppSection.spec.ts`
- Modify: `apps/frontend/src/views/public/HomeView.vue` (insert after the features section, line 55, before `</PublicLayout>` at line 56)

**Interfaces:**
- Consumes: `ANDROID_APK_URL`, `ANDROID_APK_SIZE_LABEL`, `ANDROID_MIN_VERSION_LABEL` from `@/lib/appLinks` (Task 5); `Button` `href` prop (Task 6); `/qr-android.svg` (Task 5).
- Produces: `<GetTheAppSection />` — a self-contained marketing section with no store/router dependencies (so it's mountable in tests).

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/components/marketing/__tests__/GetTheAppSection.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GetTheAppSection from '../GetTheAppSection.vue';
import { ANDROID_APK_URL } from '@/lib/appLinks';

describe('GetTheAppSection', () => {
  it('links the download button to the evergreen APK URL', () => {
    const w = mount(GetTheAppSection);
    const a = w.find(`a[href="${ANDROID_APK_URL}"]`);
    expect(a.exists()).toBe(true);
    expect(a.text()).toContain('Download for Android');
  });

  it('shows the QR code, size and sideload hint', () => {
    const w = mount(GetTheAppSection);
    const img = w.find('img');
    expect(img.attributes('src')).toBe('/qr-android.svg');
    expect(img.attributes('alt')).toContain('QR');
    expect(w.text()).toContain('MB');
    expect(w.text()).toContain('unknown sources');
  });
});
```

- [ ] **Step 2: Run it — must fail (component doesn't exist)**

```bash
npm --prefix apps/frontend run test:unit -- src/components/marketing/__tests__/GetTheAppSection.spec.ts
```

Expected: FAIL — cannot resolve `../GetTheAppSection.vue`.

- [ ] **Step 3: Implement `GetTheAppSection.vue`**

```vue
<script setup lang="ts">
import { Smartphone } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  ANDROID_APK_URL,
  ANDROID_APK_SIZE_LABEL,
  ANDROID_MIN_VERSION_LABEL,
} from '@/lib/appLinks';
</script>

<template>
  <!-- Get the app -->
  <section class="border-t border-border/60 px-6 py-20">
    <div class="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row md:justify-between">
      <div class="max-w-xl text-center md:text-left">
        <h2 class="text-3xl font-bold tracking-tight text-foreground">Take Cinely with you</h2>
        <p class="mt-4 text-pretty text-lg text-muted-foreground">
          Get the Android app and keep your notes in your pocket — same account,
          synced in real time.
        </p>
        <div class="mt-8 flex flex-col items-center gap-3 md:items-start">
          <Button :href="ANDROID_APK_URL" size="lg">
            <Smartphone class="mr-2 size-4" />
            Download for Android (.apk)
          </Button>
          <p class="text-sm text-muted-foreground">
            {{ ANDROID_APK_SIZE_LABEL }} · {{ ANDROID_MIN_VERSION_LABEL }} · You may
            need to allow installs from unknown sources.
          </p>
        </div>
      </div>
      <div class="flex flex-col items-center gap-3">
        <img
          src="/qr-android.svg"
          alt="QR code linking to the Cinely Android APK download"
          class="size-40 rounded-xl bg-white p-3 shadow-sm"
        />
        <p class="text-xs text-muted-foreground">Scan with your phone</p>
      </div>
    </div>
  </section>
</template>
```

(The `bg-white` tile is intentional — a QR code must stay dark-on-light in dark mode to scan reliably.)

- [ ] **Step 4: Run the test — must pass**

```bash
npm --prefix apps/frontend run test:unit -- src/components/marketing/__tests__/GetTheAppSection.spec.ts
```

Expected: 2 passed.

- [ ] **Step 5: Mount it on the landing page**

In `apps/frontend/src/views/public/HomeView.vue`:
1. Add to the imports (after line 2, `import PublicLayout ...`):

```ts
import GetTheAppSection from '@/components/marketing/GetTheAppSection.vue';
```

2. Insert between the features section's closing `</section>` (line 55) and `</PublicLayout>` (line 56):

```vue
    <GetTheAppSection />
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/marketing apps/frontend/src/views/public/HomeView.vue
git commit -m "feat(frontend): landing 'Get the app' section with APK download + QR

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Footer "Android app" link

**Files:**
- Modify: `apps/frontend/src/components/layout/PublicLayout.vue` (links array lines 16–21, footer loop lines 66–73)

**Interfaces:**
- Consumes: `ANDROID_APK_URL` from `@/lib/appLinks`.
- Produces: footer renders an external `<a>` alongside the existing RouterLinks.

- [ ] **Step 1: Type the links array and add the entry**

In `PublicLayout.vue`, add to the imports (after line 6):

```ts
import { ANDROID_APK_URL } from '@/lib/appLinks';
```

Replace the `legal` array (lines 16–21) with a discriminated union so vue-tsc narrows the template branches:

```ts
type FooterLink =
  | { label: string; to: string; external?: undefined }
  | { label: string; href: string; external: true };

const legal: FooterLink[] = [
  { to: '/legal/cgu', label: 'Terms' },
  { to: '/legal/politique-confidentialite', label: 'Privacy' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/contact', label: 'Contact' },
  { href: ANDROID_APK_URL, label: 'Android app', external: true },
];
```

- [ ] **Step 2: Branch the footer loop**

Replace the footer `<RouterLink v-for ...>` block (lines 67–72) with:

```vue
          <template v-for="l in legal" :key="l.label">
            <a
              v-if="l.external"
              :href="l.href"
              rel="noopener"
              class="transition-colors hover:text-foreground"
            >{{ l.label }}</a>
            <RouterLink
              v-else
              :to="l.to"
              class="transition-colors hover:text-foreground"
            >{{ l.label }}</RouterLink>
          </template>
```

- [ ] **Step 3: Type-check (the build runs vue-tsc)**

```bash
npm --prefix apps/frontend run build
```

Expected: `vue-tsc` passes and Vite build succeeds. (This also proves the union narrowing works in the template.)

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/layout/PublicLayout.vue
git commit -m "feat(frontend): footer link to the Android APK download

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Settings "Mobile app" card (hidden on the Capacitor shell)

**Files:**
- Create: `apps/frontend/src/components/settings/MobileAppCard.vue`
- Create: `apps/frontend/src/components/settings/__tests__/MobileAppCard.spec.ts`
- Modify: `apps/frontend/src/views/settings/SettingsView.vue` (import block lines 1–9; card inserted at the END of the first/default tab's panel)

**Interfaces:**
- Consumes: `isNative` from `@/lib/platform`; `Button` `href`; `@/lib/appLinks` constants.
- Produces: `<MobileAppCard />` — renders the download card on web, renders NOTHING when `isNative` is true (the guard lives inside the component, so SettingsView includes it unconditionally).

- [ ] **Step 1: Write the failing test**

`isNative` is a module-level constant evaluated at import, so each test resets modules and re-imports with a different Capacitor mock (`vi.doMock` is not hoisted — it applies to imports that happen after it):

Create `apps/frontend/src/components/settings/__tests__/MobileAppCard.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

async function mountCard(native: boolean) {
  vi.doMock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
  const { default: MobileAppCard } = await import('../MobileAppCard.vue');
  return mount(MobileAppCard);
}

describe('MobileAppCard', () => {
  it('renders the APK download link on the web', async () => {
    const { ANDROID_APK_URL } = await import('@/lib/appLinks');
    const w = await mountCard(false);
    const a = w.find(`a[href="${ANDROID_APK_URL}"]`);
    expect(a.exists()).toBe(true);
    expect(w.text()).toContain('Mobile app');
  });

  it('renders nothing inside the native (Capacitor) shell', async () => {
    const w = await mountCard(true);
    expect(w.find('a').exists()).toBe(false);
    expect(w.text()).toBe('');
  });
});
```

- [ ] **Step 2: Run it — must fail (component doesn't exist)**

```bash
npm --prefix apps/frontend run test:unit -- src/components/settings/__tests__/MobileAppCard.spec.ts
```

Expected: FAIL — cannot resolve `../MobileAppCard.vue`.

- [ ] **Step 3: Implement `MobileAppCard.vue`**

Settings sections are hand-rolled `div.bg-card` blocks (NOT the Card primitive — e.g. SettingsView lines 336–341); match that style:

```vue
<script setup lang="ts">
import { Smartphone } from 'lucide-vue-next';
import { isNative } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import {
  ANDROID_APK_URL,
  ANDROID_APK_SIZE_LABEL,
  ANDROID_MIN_VERSION_LABEL,
} from '@/lib/appLinks';
</script>

<template>
  <!-- An app shouldn't advertise its own APK: hidden inside the native shell. -->
  <div v-if="!isNative" class="bg-card border border-border rounded-xl p-6 space-y-3">
    <div class="flex items-center gap-2">
      <Smartphone class="size-4 text-primary" />
      <h3 class="text-sm font-semibold text-foreground">Mobile app</h3>
    </div>
    <p class="text-sm text-muted-foreground">
      Install Cinely on your Android phone — same account, notes synced in real time.
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <Button :href="ANDROID_APK_URL" size="sm">Download for Android (.apk)</Button>
      <span class="text-xs text-muted-foreground">
        {{ ANDROID_APK_SIZE_LABEL }} · {{ ANDROID_MIN_VERSION_LABEL }}
      </span>
    </div>
    <p class="text-xs text-muted-foreground">
      You may need to allow installs from unknown sources.
    </p>
  </div>
</template>
```

- [ ] **Step 4: Run the test — must pass**

```bash
npm --prefix apps/frontend run test:unit -- src/components/settings/__tests__/MobileAppCard.spec.ts
```

Expected: 2 passed.

- [ ] **Step 5: Mount it in SettingsView**

In `apps/frontend/src/views/settings/SettingsView.vue`:
1. Add to the import block (after line 8, `import { Badge } ...`):

```ts
import MobileAppCard from '@/components/settings/MobileAppCard.vue';
```

2. Read the template's tab structure (tabs start at line 268), find the FIRST tab's panel (the default account/profile tab), and insert as its LAST child block, following the sibling cards' indentation:

```vue
        <MobileAppCard />
```

Acceptance: on `/settings`, the default tab shows the card after the existing sections; no other tab is touched.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/settings apps/frontend/src/views/settings/SettingsView.vue
git commit -m "feat(frontend): 'Mobile app' download card in Settings (hidden on native)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Full verification

**Files:** none (verification only).

**Interfaces:** consumes everything above.

- [ ] **Step 1: Full unit suite + type-checked build**

```bash
npm --prefix apps/frontend run test:unit
npm --prefix apps/frontend run build
```

Expected: all specs pass (the 6 pre-existing unit spec files + 4 new ones); vue-tsc + Vite build succeed.

- [ ] **Step 2: Live check in the browser**

```bash
npm --prefix apps/frontend run dev
```

(If port 5173 is busy, stop the docker frontend container first: `docker compose stop frontend`.)

Verify at `http://localhost:5173`:
- `/` shows the "Take Cinely with you" section (light AND dark theme, desktop AND narrow width) with QR on its white tile; footer shows "Android app".
- Clicking the download button starts a `cinely.apk` download (~110 MB) from GitHub.
- `/settings` (log in first — dev seed user `test@cinely.dev`) default tab shows the "Mobile app" card.

- [ ] **Step 3: Secrets audit (last line of defense)**

```bash
git log --stat feat/apk-download-link --oneline | grep -iE "jks|keystore" || echo "CLEAN"
```

Expected: `CLEAN` (no commit ever touched a keystore file; `build.gradle`/`.gitignore` mentions are fine — the grep targets file paths in --stat output, so only inspect matches if any appear).

- [ ] **Step 4: Report**

Summarize: release URL, what changed, test counts, and the manual-check results. Flag the one check only a human with a phone can do: install `cinely.apk` on a real Android device from the link and log in (spec's end-to-end criterion). Then hand off to branch-finishing (PR to `main`).
