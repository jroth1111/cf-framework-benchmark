import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'waku/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@cf-bench/dataset': path.resolve(rootDir, '../../packages/dataset/src/index.js'),
        '@cf-bench/chart-core': path.resolve(rootDir, '../../packages/chart-core/src/index.js'),
        '@cf-bench/bench-types': path.resolve(rootDir, '../../packages/bench-types/src/index.ts'),
      },
    },
    environments: {
      rsc: {
        optimizeDeps: {
          include: ['hono/tiny'],
        },
      },
      ssr: {
        optimizeDeps: {
          include: ['waku > rsc-html-stream/server'],
        },
      },
    },
    plugins: [
      tailwindcss(),
      babel({
        filter: /\.[jt]sx?$/,
        babelConfig: {
          babelrc: false,
          configFile: false,
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      react(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
      }),
    ],
  },
});
