import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

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

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login';
  if (to.meta.guest && auth.isAuthenticated) return '/notes';
});

export default router;
