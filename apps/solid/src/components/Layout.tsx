import { JSX } from "solid-js";
import "../main.css";

export function Layout(props: { title: string; children: JSX.Element }) {
  return (
    <div>
      <header class="container nav">
        <a class="brand" href="/">CF Bench</a>
        <nav class="links">
          <a class="pill" href="/stays">Stays</a>
          <a class="pill" href="/chart">Chart</a>
          <a class="pill" href="/blog">Blog</a>
        </nav>
      </header>

      <main class="container">
        <h1 class="h1">{props.title}</h1>
        {props.children}
        <div class="footer">
          SolidJS + Vite variant • <span class="kbd">/chart</span> is SPA-like, blog is SSG pages, stays are multi-page routes.
        </div>
      </main>
    </div>
  );
}
