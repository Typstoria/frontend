import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { typstWasmCsp } from './scripts/typst-wasm-csp';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [vue(), typstWasmCsp()],
    worker: { plugins: () => [typstWasmCsp()] },
    optimizeDeps: {
      exclude: [
        '@myriaddreamin/typst.ts',
        '@myriaddreamin/typst-ts-web-compiler',
        '@myriaddreamin/typst-ts-renderer',
      ],
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
          // Preserve the browser Origin for the backend's origin checks.
          changeOrigin: false,
        },
      },
    },
  };
});
