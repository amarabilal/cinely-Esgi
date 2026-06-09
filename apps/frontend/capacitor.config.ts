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
