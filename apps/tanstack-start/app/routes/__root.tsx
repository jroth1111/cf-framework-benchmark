import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { HydrationMarker } from "../components/hydration-marker";
import "@cf-bench/ui/styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CF Bench — TanStack Start" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div>
          <header className="container nav">
            <Link className="brand" to="/">CF Bench</Link>
            <nav className="links">
              <Link className="pill" to="/stays">Stays</Link>
              <Link className="pill" to="/chart">Chart</Link>
              <Link className="pill" to="/blog">Blog</Link>
            </nav>
          </header>

          <main className="container">
            <Outlet />
            <div className="footer">
              TanStack Start variant • stays SSR loader, blog route pre-render friendly, chart client component.
            </div>
          </main>
        </div>
        <Scripts />
        <HydrationMarker />
      </body>
    </html>
  );
}
