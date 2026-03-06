import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart({
      target: 'cloudflare-workers',
      prerender: {
        enabled: false,
      },
    }),
    viteSolid({ ssr: true }),
  ],
})
