import { onMounted, ref, watch } from 'vue';

type Mode = 'light' | 'dark';

const STORAGE_KEY = 'cinely-color-mode';

function resolve(): Mode {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const mode = ref<Mode>('dark');

function apply(next: Mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', next === 'dark');
  root.classList.add('theme-switching');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove('theme-switching'));
  });
}

export function useColorMode() {
  onMounted(() => {
    mode.value = resolve();
    apply(mode.value);
  });

  function toggle() {
    const next: Mode = mode.value === 'dark' ? 'light' : 'dark';
    mode.value = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }

  watch(mode, (next) => apply(next));

  return { mode, toggle };
}
