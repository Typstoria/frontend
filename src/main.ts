import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';
import { router } from './app/router';
import './shared/styles/main.css';

// Google Identity Services requires a Referer for its localhost popup flow.
if (import.meta.env.DEV) {
  const policy = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
  if (policy) policy.content = 'no-referrer-when-downgrade';
}

createApp(App).use(createPinia()).use(router).mount('#app');
