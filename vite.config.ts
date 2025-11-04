import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import OverwolfPlugin from './.vite/plugins/OverwolfPlugin';
// @ts-expect-error
import react from '@vitejs/plugin-react';

const r = (p: string) => resolve(__dirname, p);

// Renames e.g. "src/windows/background/background.html" -> "background.html"
function flattenHtmlPaths(): Plugin {
  return {
    name: 'flatten-html-paths',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const [key, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && key.endsWith('.html')) {
          // keep only the basename like "background.html"
          const base = key.split('/').pop()!;
          chunk.fileName = base;
        }
      }
    },
  };
}

const isDevMode = process.env.NODE_ENV !== 'production';

export default defineConfig({
  // Make sure the Overwolf runtime always sees dev-friendly code
  css: { devSourcemap: true },
  esbuild: {
    sourcemap: true,
  },
  define: {
    'import.meta.env.DEV': isDevMode,
    __DEV__: isDevMode,
  },
  logLevel: 'info',
  publicDir: r('public'),
  mode: process.env.NODE_ENV,
  build: {
    outDir: r('dist'),
    emptyOutDir: true,

    sourcemap: 'inline',
    minify: false,
    target: 'esnext',

    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return
        }
        warn(warning)
      },
      input: {
        background: r('src/windows/background/background.html'),
        main: r('src/windows/main/main.html'),
        mode_1v1: r('src/windows/mode_1v1/mode_1v1.html'),
        callouts: r('src/windows/callouts/callouts.html'),
        debug: r('src/windows/debug/debug.html'),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith('.css') ? 'css/[name][extname]' : 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    react(),
    flattenHtmlPaths(),
    OverwolfPlugin({ makeOpk: process.env.MAKE_OPK, setVersion: process.env.SET_VERSION }),
  ]
});
