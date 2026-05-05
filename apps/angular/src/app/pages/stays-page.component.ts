import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatUsd, queryListings, type Listing } from '@cf-bench/dataset';

@Component({
  selector: 'app-stays-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-copy">
      <h1 class="h1">Stays</h1>
      <p class="muted">Airbnb-style listing index.</p>
    </section>

    <section class="grid cols-3">
      <a
        *ngFor="let listing of listings"
        class="card listing-card"
        [routerLink]="['/stays', listing.id]"
        data-testid="stay-card"
      >
        <h2 class="listing-title">{{ listing.title }}</h2>
        <p class="muted small">
          {{ listing.city }}, {{ listing.country }} • {{ listing.bedrooms }} bd • {{ listing.baths }} ba • up to
          {{ listing.maxGuests }} guests
        </p>
        <p class="listing-price">
          {{ formatPrice(listing.pricePerNight) }} <span class="muted">/ night</span>
        </p>
        <div class="listing-meta">
          <span>{{ listing.rating }} ★</span>
          <span>{{ listing.reviews }} reviews</span>
        </div>
        <p class="muted small">{{ listing.summary }}</p>
      </a>
    </section>
  `,
})
export class StaysPageComponent {
  readonly listings: Listing[] = queryListings({ page: 1, pageSize: 12 }).results;

  formatPrice(value: number) {
    return formatUsd(value);
  }
}
