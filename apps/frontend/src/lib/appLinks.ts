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
