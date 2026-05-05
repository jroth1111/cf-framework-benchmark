import Link from "next/link";
import type { Viewport } from "next";
import "./globals.css";
import { HydrationMarker } from "./hydration-marker";

export const metadata = {
  title: "CF Bench",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="container nav">
          <Link className="brand" href="/" prefetch={false}>CF Bench</Link>
          <nav className="links">
            <Link className="pill" href="/stays" prefetch={false}>Stays</Link>
            <Link className="pill" href="/chart" prefetch={false}>Chart</Link>
            <Link className="pill" href="/media" prefetch={false}>Media</Link>
            <Link className="pill" href="/blog" prefetch={false}>Blog</Link>
          </nav>
        </header>

        <main className="container">
          {children}
          <div className="footer">Benchmark route surface on Cloudflare Workers.</div>
        </main>
        <HydrationMarker />
      </body>
    </html>
  );
}
