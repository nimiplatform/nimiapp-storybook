import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appReact = fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url));
const appReactDom = fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url));
const appReactJsxRuntime = fileURLToPath(new URL('./node_modules/react/jsx-runtime.js', import.meta.url));
const appRoot = fileURLToPath(new URL('.', import.meta.url));
const nimiRepoRoot = path.resolve(appRoot, '../../nimi');
const nimiSdkSourceRoot = path.resolve(nimiRepoRoot, 'sdks/typescript');
const nimiKitSourceRoot = path.resolve(nimiRepoRoot, 'kit');

function normalizeId(id: string): string {
  return id.split(path.sep).join('/');
}

function isNimiSdkModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/sdk/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+sdk@')
    || normalizedId.includes('/nimi-realm/nimi/sdks/typescript/')
  );
}

function isNimiKitModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/kit/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+kit@')
    || normalizedId.includes('/nimi-realm/nimi/kit/')
  );
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
      { find: /^react\/jsx-runtime$/, replacement: appReactJsxRuntime },
      { find: /^@nimiplatform\/sdk$/, replacement: path.resolve(nimiSdkSourceRoot, 'index.ts') },
      { find: /^@nimiplatform\/sdk\/ai$/, replacement: path.resolve(nimiSdkSourceRoot, 'core/ai/index.ts') },
      { find: /^@nimiplatform\/sdk\/features\/generation$/, replacement: path.resolve(nimiSdkSourceRoot, 'features/generation/index.ts') },
      { find: /^@nimiplatform\/sdk\/runtime$/, replacement: path.resolve(nimiSdkSourceRoot, 'runtime/index.ts') },
      { find: /^@nimiplatform\/sdk\/runtime\/generated$/, replacement: path.resolve(nimiSdkSourceRoot, 'runtime/generated.ts') },
      { find: /^@nimiplatform\/sdk\/types$/, replacement: path.resolve(nimiSdkSourceRoot, 'types/index.ts') },
      { find: /^@nimiplatform\/kit\/auth$/, replacement: path.resolve(nimiKitSourceRoot, 'auth/src/index.ts') },
      { find: /^@nimiplatform\/kit\/auth\/styles\.css$/, replacement: path.resolve(nimiKitSourceRoot, 'auth/src/styles.css') },
      { find: /^@nimiplatform\/kit\/core\/oauth$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/oauth/index.ts') },
      { find: /^@nimiplatform\/kit\/core\/offline-coordinator$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/offline-coordinator.ts') },
      { find: /^@nimiplatform\/kit\/core\/storage-json$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/storage-json.ts') },
      { find: /^@nimiplatform\/kit\/features\/model-config$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-config/src/index.ts') },
      { find: /^@nimiplatform\/kit\/features\/model-config\/headless$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-config/src/headless.ts') },
      { find: /^@nimiplatform\/kit\/features\/model-picker\/runtime$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-picker/src/runtime.ts') },
      { find: /^@nimiplatform\/kit\/shell\/renderer\/bridge$/, replacement: path.resolve(nimiKitSourceRoot, 'shell/renderer/src/bridge/index.ts') },
      { find: /^@nimiplatform\/kit\/ui$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/index.ts') },
      { find: /^@nimiplatform\/kit\/ui\/styles\.css$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/styles.css') },
      { find: /^@nimiplatform\/kit\/ui\/themes\/(.+\.css)$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/themes/$1') },
      { find: /^@nimiplatform\/kit\/ui\/(.+)$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/$1') },
    ],
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
  server: {
    fs: {
      allow: [
        appRoot,
        nimiRepoRoot,
      ],
    },
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
