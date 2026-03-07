import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatUsd, getListing, type Listing } from '@cf-bench/dataset';

@Component({
  selector: 'app-stay-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="listing as stay; else missing">
      <section class="page-copy">
        <a class="inline-link" routerLink="/stays">Back to stays</a>
        <h1 class="h1">{{ stay.title }}</h1>
        <p class="muted">
          {{ stay.neighborhood }}, {{ stay.city }} · {{ stay.maxGuests }} guests · {{ stay.bedrooms }} beds ·
          {{ stay.baths }} baths
        </p>
      </section>

      <section class="grid cols-detail">
        <article class="card detail-panel">
          <div class="meta-row">
            <span class="tag" *ngFor="let tag of stay.tags">{{ tag }}</span>
          </div>
          <div class="rich-html" data-testid="stay-description" [innerHTML]="descriptionHtml"></div>
        </article>

        <aside class="card detail-panel sidebar">
          <div class="price-block">
            <div class="listing-price">{{ formatPrice(stay.pricePerNight) }}</div>
            <div class="muted small">nightly · {{ stay.reviews }} reviews · {{ stay.rating }} ★</div>
          </div>

          <h2>Host</h2>
          <p class="muted">{{ stay.hostName }} · Host since {{ stay.hostSinceISO }}</p>

          <h2>Amenities</h2>
          <ul class="detail-list">
            <li *ngFor="let amenity of stay.amenities">{{ amenity }}</li>
          </ul>

          <h2>Review samples</h2>
          <div class="review-list">
            <article class="review-card" *ngFor="let review of stay.reviewSamples">
              <div class="review-heading">
                <strong>{{ review.name }}</strong>
                <span class="muted small">{{ review.dateISO }} · {{ review.rating }} ★</span>
              </div>
              <p class="muted">{{ review.text }}</p>
            </article>
          </div>
        </aside>
      </section>
    </ng-container>

    <ng-template #missing>
      <section class="page-copy">
        <h1 class="h1">Stay not found</h1>
      </section>
    </ng-template>
  `,
})
export class StayDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly listing: Listing | null = getListing(this.route.snapshot.paramMap.get('id') ?? '') ?? null;
  readonly descriptionHtml: SafeHtml | null = this.listing
    ? this.sanitizer.bypassSecurityTrustHtml(this.listing.descriptionHtml)
    : null;

  formatPrice(value: number) {
    return formatUsd(value);
  }
}
