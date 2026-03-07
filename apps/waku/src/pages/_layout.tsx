import '../styles.css';

import type { ReactNode } from 'react';
import { HydrationMarker } from '../components/HydrationMarker';

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <meta name="description" content="Waku Cloudflare Workers benchmark app." />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{};if(h.startMs==null)h.startMs=performance.now();})();",
        }}
      />
      <HydrationMarker />
      <div className="page-shell">
        <header className="shell-header">
          <div>
            <p className="eyebrow">Cloudflare Workers matrix</p>
            <a className="brand" href="/">
              Waku benchmark app
            </a>
          </div>
          <nav className="nav">
            <a className="nav-link" href="/stays">
              Stays
            </a>
            <a className="nav-link" href="/blog">
              Blog
            </a>
            <a className="nav-link" href="/chart">
              Chart
            </a>
            <a className="nav-link" href="/media">
              Media
            </a>
          </nav>
        </header>
        <main>{children}</main>
        <p className="footer">Waku static benchmark route surface deployed to Cloudflare Workers.</p>
      </div>
    </>
  );
}

export const getConfig = async () => {
  return {
    render: 'static',
  } as const;
};
