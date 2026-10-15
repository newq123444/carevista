import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Stamp the build so the running app can report exactly which code is live.
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ');

// The service worker (public/sw.js) stores every built file so the app opens
// with no signal. File names change with every build, so the build writes the
// list for it.
function swAssetList(): Plugin {
  return {
    name: 'cv-sw-asset-list',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter(f => /\.(js|css|svg|png|woff2?)$/.test(f))
        .map(f => '/' + f);
      this.emitFile({ type: 'asset', fileName: 'sw-assets.json', source: JSON.stringify({ build: BUILD_ID, files }) });
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), swAssetList()],
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy uploaded files (photos, belongings) from backend
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
