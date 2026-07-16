import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { isNative } from '@/lib/platform';
import { currentMode } from '@/composables/useColorMode';

/**
 * Wires native-shell behaviour. No-op on web. Call once from App.vue.
 * - hides the splash screen once Vue has mounted
 * - themes the status bar to match light/dark and reacts to toggles
 * - routes the Android hardware back button (history back, else exit at root)
 */
export function useNativeShell() {
  if (!isNative) return;
  const router = useRouter();

  void (async () => {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { App } = await import('@capacitor/app');

    const applyStatusBar = async (mode: 'light' | 'dark') => {
      try {

        await StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: mode === 'dark' ? '#0a0a0a' : '#ffffff' });
      } catch {  }
    };

    const mode = currentMode();
    await applyStatusBar(mode.value);
    watch(mode, (m) => { void applyStatusBar(m); });

    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        router.back();
      } else {
        void App.exitApp();
      }
    });

    await SplashScreen.hide();
  })();
}
