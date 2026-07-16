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

    { path: '/', component: () => import('@/views/public/HomeView.vue') },
    { path: '/features', component: () => import('@/views/public/FeaturesView.vue') },
    { path: '/security', component: () => import('@/views/public/SecurityView.vue') },
    { path: '/contact', component: () => import('@/views/public/ContactView.vue') },
    { path: '/public/notes/:token', component: () => import('@/views/notes/PublicNoteView.vue') },

    { path: '/legal/cgu', component: () => import('@/views/legal/CguView.vue') },
    { path: '/legal/politique-confidentialite', component: () => import('@/views/legal/PrivacyView.vue') },
    { path: '/legal/cookies', component: () => import('@/views/legal/CookiesView.vue') },

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

    {
      path: '/callback',
      component: () => import('@/views/auth/GoogleCallbackView.vue'),
    },

    {
      path: '/notes',
      component: () => import('@/components/app/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'notes', component: () => import('@/views/notes/NotesOverviewView.vue') },
        { path: 'archived', name: 'notes-archived', component: () => import('@/views/notes/NotesOverviewView.vue') },
        { path: 'search', name: 'notes-search', component: () => import('@/views/notes/SearchView.vue') },
        { path: ':id', name: 'note-editor', component: () => import('@/views/notes/NoteEditorView.vue') },

        { path: '/dashboard', name: 'dashboard', component: () => import('@/views/notes/DashboardView.vue') },
        { path: '/calendar', name: 'calendar', component: () => import('@/views/notes/CalendarView.vue') },
        { path: '/settings', name: 'settings', component: () => import('@/views/settings/SettingsView.vue') },
        { path: '/notebooks', name: 'notebooks', component: () => import('@/views/notebooks/NotebooksDashboardView.vue') },
        { path: '/notebooks/:id', name: 'notebook-detail', component: () => import('@/views/notebooks/NotebookDetailView.vue') },
        { path: '/trash', name: 'trash', component: () => import('@/views/notes/TrashView.vue') },
        { path: '/activity', name: 'activity', component: () => import('@/views/activity/ActivityView.vue') },
      ],
    },
  ],
});

const MARKETING_PATHS = new Set(['/', '/features', '/security', '/contact']);

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (isNative && MARKETING_PATHS.has(to.path)) {
    return auth.isAuthenticated ? '/notes' : '/login';
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login';
  if (to.meta.guest && auth.isAuthenticated) return '/notes';
});

router.beforeResolve((to, from) => {
  const doc = document as DocWithVT;
  if (
    typeof doc.startViewTransition !== 'function' ||
    from.matched.length === 0 ||
    to.fullPath === from.fullPath ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  return new Promise<void>((resolve) => {
    doc.startViewTransition!(() => {
      resolve();
      return nextTick();
    });
  });
});

export default router;
