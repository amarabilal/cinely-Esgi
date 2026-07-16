import { createApp } from 'vue';
import { createPinia } from 'pinia';
import * as Sentry from '@sentry/vue';
import App from './App.vue';
import router from './router';
import './assets/main.css';
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

const app = createApp(App);
app.use(createPinia());
app.use(router);

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate: 0.01,
    autoSessionTracking: false,
    environment: import.meta.env.MODE,
  });
}

if (import.meta.env.VITE_MATOMO_URL && localStorage.getItem('cookie_consent') === 'accepted') {
  const _paq = (window as any)._paq = (window as any)._paq || [];
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  _paq.push(['setTrackerUrl', `${import.meta.env.VITE_MATOMO_URL}/matomo.php`]);
  _paq.push(['setSiteId', '1']);
  const script = document.createElement('script');
  script.async = true;
  script.src = `${import.meta.env.VITE_MATOMO_URL}/matomo.js`;
  document.head.appendChild(script);
}

export function trackEvent(category: string, action: string, name?: string) {
  const paq = (window as any)._paq;
  if (paq) paq.push(['trackEvent', category, action, name]);
}

app.mount('#app');
