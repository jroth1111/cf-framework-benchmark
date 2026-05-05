import { JSX } from "solid-js";

export function Layout(props: { title: string; children: JSX.Element }) {
  return (
    <div>
      <header class="container nav">
        <a class="brand" href="/">CF Bench</a>
        <nav class="links">
          <a class="pill" href="/stays">Stays</a>
          <a class="pill" href="/chart">Chart</a>
          <a class="pill" href="/media">Media</a>
          <a class="pill" href="/blog">Blog</a>
        </nav>
      </header>

      <main class="container">
        <h1 class="h1">{props.title}</h1>
        {props.children}
        <div class="footer">Benchmark route surface on Cloudflare Workers.</div>
      </main>
    </div>
  );
}
