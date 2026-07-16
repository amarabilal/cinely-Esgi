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

Cut releases after merging to main, so the tag matches the source that built the APK.

1. **Bump versions** (keep them in sync with the tag):
   - `android/app/build.gradle`: `versionCode` (+1 every release) and
     `versionName "X.Y.Z"`.
   - `app.json`: `"version": "X.Y.Z"`.
2. **Build** (10–20 min), from `apps/mobile/android`, in Git Bash:
   ```bash
   ANDROID_HOME="/c/Users/ADMIN/AppData/Local/Android/Sdk" \
   JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
   ```
   Machine gotchas already handled in the repo: CMake is pinned to 3.31.4 in
   `android/build.gradle` (3.22's ninja loops on the space in "Projet anuel");
   `debuggableVariants=[]` embeds the JS bundle.
3. **Verify the signature** — must be the release key, not debug. The APK is
   v2-signed only (minSdk 24), so `keytool -printcert -jarfile` prints
   "Not a signed jar file" — use apksigner instead (Git Bash):
   ```bash
   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
   SDK="/c/Users/ADMIN/AppData/Local/Android/Sdk"
   "$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)/apksigner.bat" \
     verify --print-certs app/build/outputs/apk/release/app-release.apk
   ```
   Expect `Signer #1 certificate DN: CN=Cinely, OU=Mobile, O=Cinely, L=Paris, C=FR`.
   `CN=Android Debug` means `android/keystore.properties` was missing during
   the build.
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
