import '../styles.css';

import type { ReactNode } from 'react';
import { HydrationMarker } from '../components/HydrationMarker';

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <meta name="description" content="Cloudflare Workers benchmark app." />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{};if(h.startMs==null)h.startMs=performance.now();})();",
        }}
      />
      <HydrationMarker />
      <div>
        <header className="container nav">
          <a className="brand" href="/">
            CF Bench
          </a>
          <nav className="links">
            <a className="pill" href="/stays">
              Stays
            </a>
            <a className="pill" href="/chart">
              Chart
            </a>
            <a className="pill" href="/media">
              Media
            </a>
            <a className="pill" href="/blog">
              Blog
            </a>
          </nav>
        </header>
        <main className="container">
          {children}
          <p className="footer">Benchmark route surface on Cloudflare Workers.</p>
        </main>
      </div>
    </>
  );
}

export const getConfig = async () => {
  return {
    render: 'static',
  } as const;
};
