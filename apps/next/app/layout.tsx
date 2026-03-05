import Link from "next/link";
import "./globals.css";
import { HydrationMarker } from "./hydration-marker";

export const metadata = {
  title: "CF Bench — Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="container nav">
          <Link className="brand" href="/">CF Bench</Link>
          <nav className="links">
            <Link className="pill" href="/stays">Stays</Link>
            <Link className="pill" href="/chart">Chart</Link>
            <Link className="pill" href="/blog">Blog</Link>
          </nav>
        </header>

        <main className="container">
          {children}
          <div className="footer">
            Next.js variant • stays SSR (server components), blog SSG, chart client component.
          </div>
        </main>
        <HydrationMarker />
      </body>
    </html>
  );
}
