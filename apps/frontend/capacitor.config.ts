import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.cinely.app',
  appName: 'Cinely',
  webDir: 'dist',
  android: {
    // The WebView origin is https://localhost (a secure context). allowMixedContent
    // lets the app reach a plain-HTTP backend during LOCAL testing
    // (e.g. http://10.0.2.2:3000 from an emulator). With the production HTTPS backend
    // there is no mixed content, so this stays inert; tighten to false for a hardened
    // store release if you don't need to hit an http backend from a device.
    allowMixedContent: true,
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
