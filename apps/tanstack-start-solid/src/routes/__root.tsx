import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/solid-router'
import { HydrationMarker } from '../components/HydrationMarker'
import '@cf-bench/ui/styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'CF Bench — TanStack Start Solid' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <script
          innerHTML={`(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.startMs==null)h.startMs=performance.now();})();`}
        />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
        <HydrationMarker />
      </body>
    </html>
  )
}
