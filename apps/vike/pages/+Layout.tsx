import "./Layout.css";

import { useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { urlPathname } = usePageContext();

  useEffect(() => {
    requestAnimationFrame(() => {
      const w = window as Window & {
        __CF_BENCH__?: {
          hydration?: { endMs?: number };
        };
      };
      w.__CF_BENCH__ = w.__CF_BENCH__ || {};
      const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
      hydration.endMs = performance.now();
    });
  }, [urlPathname]);

  return (
    <>
      <header className="container nav">
        <a className="brand" href="/">
          CF Bench
        </a>
        <nav className="links">
          <BenchLink href="/stays" currentPath={urlPathname}>
            Stays
          </BenchLink>
          <BenchLink href="/chart" currentPath={urlPathname}>
            Chart
          </BenchLink>
          <BenchLink href="/media" currentPath={urlPathname}>
            Media
          </BenchLink>
          <BenchLink href="/blog" currentPath={urlPathname}>
            Blog
          </BenchLink>
        </nav>
      </header>
      <main className="container">
        {children}
        <div className="footer">Vike benchmark route surface on Cloudflare Workers.</div>
      </main>
    </>
  );
}

function BenchLink({
  href,
  currentPath,
  children,
}: {
  href: string;
  currentPath: string;
  children: React.ReactNode;
}) {
  const isActive = href === "/" ? currentPath === href : currentPath.startsWith(href);
  return (
    <a href={href} className={isActive ? "pill active" : "pill"}>
      {children}
    </a>
  );
}
