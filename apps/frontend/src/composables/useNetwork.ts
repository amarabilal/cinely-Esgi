import { ref, onMounted, onUnmounted } from 'vue';
import { isNative } from '@/lib/platform';

const online = ref(true);

export function useNetwork() {
  let removeListener: (() => void) | null = null;

  onMounted(async () => {
    if (isNative) {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      online.value = status.connected;
      const handle = await Network.addListener('networkStatusChange', (s) => {
        online.value = s.connected;
      });
      removeListener = () => { void handle.remove(); };
    } else {
      online.value = navigator.onLine;
      const on = () => { online.value = true; };
      const off = () => { online.value = false; };
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      removeListener = () => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      };
    }
  });

  onUnmounted(() => removeListener?.());

  return { online };
}
