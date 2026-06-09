import { nextTick } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { isNative } from '@/lib/platform';

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
};

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Public pages (no auth required)
    { path: '/', component: () => import('@/views/public/HomeView.vue') },
    { path: '/features', component: () => import('@/views/public/FeaturesView.vue') },
    { path: '/security', component: () => import('@/views/public/SecurityView.vue') },
    { path: '/contact', component: () => import('@/views/public/ContactView.vue') },

    // Legal pages
    { path: '/legal/cgu', component: () => import('@/views/legal/CguView.vue') },
    { path: '/legal/politique-confidentialite', component: () => import('@/views/legal/PrivacyView.vue') },
    { path: '/legal/cookies', component: () => import('@/views/legal/CookiesView.vue') },

    // Auth pages (guest only)
    {
      path: '/login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guest: true },
    },
    {
      path: '/forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { guest: true },
    },
    {
      path: '/reset-password',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { guest: true },
    },
    {
      path: '/verify-email',
      component: () => import('@/views/auth/VerifyEmailView.vue'),
    },
    {
      path: '/2fa',
      component: () => import('@/views/auth/TwoFactorView.vue'),
    },

    // App pages (auth required) — nested under the persistent AppLayout shell
    // (top bar + collapsible sidebar + command palette + toaster).
    {
      path: '/notes',
      component: () => import('@/components/app/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'notes', component: () => import('@/views/notes/NotesOverviewView.vue') },
        { path: 'archived', name: 'notes-archived', component: () => import('@/views/notes/NotesOverviewView.vue') },
        { path: 'search', name: 'notes-search', component: () => import('@/views/notes/SearchView.vue') },
        { path: ':id', name: 'note-editor', component: () => import('@/views/notes/NoteEditorView.vue') },
        // Dashboard + Settings live inside the same shell so they inherit the
        // top bar + sidebar + command palette (absolute paths keep their URLs).
        { path: '/dashboard', name: 'dashboard', component: () => import('@/views/notes/DashboardView.vue') },
        { path: '/settings', name: 'settings', component: () => import('@/views/settings/SettingsView.vue') },
      ],
    },
  ],
});

// On native, the marketing pages are not part of the app — entering one
// (including the default '/' landing) bounces to the app, which the auth
// guard then resolves to '/notes' or '/login'.
const MARKETING_PATHS = new Set(['/', '/features', '/security', '/contact']);

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (isNative && MARKETING_PATHS.has(to.path)) {
    return auth.isAuthenticated ? '/notes' : '/login';
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login';
  if (to.meta.guest && auth.isAuthenticated) return '/notes';
});

// Animate every route change as a snapshot crossfade via the View Transitions
// API — the same effect as the dark/light theme switch. The crossfade is driven
// by the ::view-transition-old/new(root) rules in main.css. beforeResolve runs
// AFTER async route components have loaded, so the new chunk is ready before the
// transition captures. We skip the initial load and reduced-motion users.
router.beforeResolve((to, from) => {
  const doc = document as DocWithVT;
  if (
    typeof doc.startViewTransition !== 'function' ||
    from.matched.length === 0 ||              // initial page load — no transition
    to.fullPath === from.fullPath ||          // same URL (e.g. hash) — skip
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  return new Promise<void>((resolve) => {
    doc.startViewTransition!(() => {
      resolve();         // confirm navigation → router-view renders the new view
      return nextTick(); // hold the snapshot until the new view has painted
    });
  });
});

export default router;
