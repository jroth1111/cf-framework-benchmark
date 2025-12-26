import React from "react";
import "../main.css";

export function Layout(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <header className="container nav">
        <a className="brand" href="/">CF Bench</a>
        <nav className="links">
          <a className="pill" href="/stays">Stays</a>
          <a className="pill" href="/chart">Chart</a>
          <a className="pill" href="/blog">Blog</a>
        </nav>
      </header>
      <main className="container">
        <h1 className="h1">{props.title}</h1>
        {props.children}
        <div className="footer">
          React + Vite variant • <span className="kbd">/chart</span> is SPA-like, blog is SSG pages, stays are multi-page routes.
        </div>
      </main>
    </div>
  );
}
