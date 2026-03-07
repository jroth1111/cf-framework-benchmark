import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-copy">
      <span class="eyebrow">Cloudflare Workers benchmark</span>
      <h1 class="h1">Angular on Workers</h1>
      <p class="muted">
        Native Angular SSR routes for the shared benchmark app: stays, blog, chart, and media.
      </p>
    </section>

    <section class="grid cols-2">
      <a class="card feature-card" routerLink="/stays">
        <h2>Stays</h2>
        <p class="muted">Server-rendered listing index and detail routes.</p>
      </a>
      <a class="card feature-card" routerLink="/blog">
        <h2>Blog</h2>
        <p class="muted">Static benchmark posts rendered through Angular SSR.</p>
      </a>
      <a class="card feature-card" routerLink="/chart">
        <h2>Chart</h2>
        <p class="muted">Client-side hydration with chart rendering and price fetches.</p>
      </a>
      <a class="card feature-card" routerLink="/media">
        <h2>Media</h2>
        <p class="muted">Interactive feed-to-player transitions with benchmark markers.</p>
      </a>
    </section>
  `,
})
export class HomePageComponent {}
