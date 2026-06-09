import { onMounted, ref } from 'vue';

type Mode = 'light' | 'dark';

const STORAGE_KEY = 'cinely-color-mode';

function resolve(): Mode {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Module-level singleton so every ThemeToggle instance stays in sync.
const mode = ref<Mode>('dark');

function setClass(next: Mode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', next === 'dark');
}

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/**
 * Animate a theme swap.
 *
 * The swap touches dozens of CSS variables; without coordination each element
 * runs its own transition (Tailwind transition-colors, our global 200ms, shadcn
 * primitives) and you get a chaotic "wave" of colors arriving at different times.
 *
 * Two-pronged fix (matches the cluster-offline reference):
 *  1. Add `.theme-switching` on <html> so our CSS kills ALL transitions for the
 *     frame → the swap is atomic, every pixel updates at once.
 *  2. If the browser supports the View Transitions API, wrap the swap in
 *     document.startViewTransition() so it renders as a single, snapshot-based
 *     crossfade controlled by ::view-transition-old/new(root) in main.css.
 */
function animateThemeChange(next: Mode) {
  if (typeof document === 'undefined') { setClass(next); return; }

  const root = document.documentElement;
  root.classList.add('theme-switching');
  const apply = () => setClass(next);
  const docVT = document as DocWithVT;

  if (typeof docVT.startViewTransition === 'function') {
    docVT.startViewTransition(apply).finished.finally(() => {
      root.classList.remove('theme-switching');
    });
  } else {
    apply();
    // Wait two frames so the new tokens are committed and painted before
    // re-enabling transitions, otherwise the tail of the swap can still tween.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('theme-switching'));
    });
  }
}

export function useColorMode() {
  onMounted(() => {
    mode.value = resolve();
    setClass(mode.value); // initial paint — no animation
  });

  function toggle() {
    const next: Mode = mode.value === 'dark' ? 'light' : 'dark';
    mode.value = next;
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
    animateThemeChange(next);
  }

  return { mode, toggle };
}
