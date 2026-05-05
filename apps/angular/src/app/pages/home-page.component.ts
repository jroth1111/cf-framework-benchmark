import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-copy">
      <h1 class="h1">Framework benchmark harness</h1>
    </section>

    <section class="grid cols-3">
      <a class="card feature-card" routerLink="/chart">
        <h2>SPA-like</h2>
        <p class="muted">Interactive chart with symbol switching.</p>
        <span class="btn">Open chart</span>
      </a>
      <a class="card feature-card" routerLink="/stays">
        <h2>App pages</h2>
        <p class="muted">Listings index + detail pages.</p>
        <span class="btn">Browse stays</span>
      </a>
      <a class="card feature-card" routerLink="/blog">
        <h2>SSG blog</h2>
        <p class="muted">Prerendered route content.</p>
        <span class="btn">Read blog</span>
      </a>
      <a class="card feature-card" routerLink="/media">
        <h2>Media feed</h2>
        <p class="muted">Feed browsing and player interactions.</p>
        <span class="btn">Open media</span>
      </a>
    </section>
  `,
})
export class HomePageComponent {}
