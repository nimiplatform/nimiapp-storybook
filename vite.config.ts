import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appReact = fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url));
const appReactDom = fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url));
const appReactJsxRuntime = fileURLToPath(new URL('./node_modules/react/jsx-runtime.js', import.meta.url));
const appRoot = fileURLToPath(new URL('.', import.meta.url));

function normalizeId(id: string): string {
  return id.split(path.sep).join('/');
}

function isNimiSdkModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/sdk/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+sdk@')  );
}

function isNimiKitModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/kit/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+kit@')  );
}

function chunkForModule(id: string): string | undefined {
  if (id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/')) {
    return 'vendor-react';
  }
  if (id.includes('/node_modules/i18next/') || id.includes('/node_modules/react-i18next/')) {
    return 'nimi-kit';
  }
  const normalized = normalizeId(id);
  if (isNimiSdkModule(normalized) && normalized.includes('/core-generated/')) {
    return 'nimi-sdk-generated';
  }
  if (isNimiSdkModule(normalized)) {
    return 'nimi-sdk';
  }
  if (isNimiKitModule(normalized)) {
    return 'nimi-kit';
  }
  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: appReact },
      { find: /^react-dom$/, replacement: appReactDom },
      { find: /^react\/jsx-runtime$/, replacement: appReactJsxRuntime },    ],
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    exclude: [
      '@nimiplatform/kit',
      '@nimiplatform/kit/ui',
      '@nimiplatform/kit/auth',
      '@nimiplatform/kit/core/offline-coordinator',
      '@nimiplatform/kit/core/storage-json',
      '@nimiplatform/kit/features/model-config',
      '@nimiplatform/kit/features/model-config/headless',
      '@nimiplatform/kit/features/model-picker/runtime',
      '@nimiplatform/kit/shell/renderer/bridge',
      '@nimiplatform/sdk',
      '@nimiplatform/sdk/ai',
      '@nimiplatform/sdk/features/generation',
      '@nimiplatform/sdk/runtime',
      '@nimiplatform/sdk/runtime/generated',
      '@nimiplatform/sdk/types',
    ],
  },

  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: chunkForModule,
      },
    },
  },
});
