import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "@cf-bench/ui/styles.css";

export const links: Route.LinksFunction = () => [
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{};if(h.startMs==null)h.startMs=performance.now();})();',
          }}
        />
      </head>
      <body>
        <header className="container nav">
          <Link className="brand" to="/">
            CF Bench
          </Link>
          <nav className="links">
            <Link className="pill" prefetch="intent" to="/stays">
              Stays
            </Link>
            <Link className="pill" to="/chart">
              Chart
            </Link>
            <Link className="pill" to="/media">
              Media
            </Link>
            <Link className="pill" prefetch="intent" to="/blog">
              Blog
            </Link>
          </nav>
        </header>
        <main className="container">
          {children}
          <div className="footer">React Router variant • Workers SSR route modules for the benchmark contract.</div>
        </main>
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{};h.endMs=performance.now();})();',
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
