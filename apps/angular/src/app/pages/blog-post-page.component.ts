import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getPost, type BlogPost } from '@cf-bench/dataset';

@Component({
  selector: 'app-blog-post-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="post as entry; else missing">
      <section class="page-copy">
        <a class="inline-link" routerLink="/blog">Back to blog</a>
        <h1 class="h1">{{ entry.title }}</h1>
        <p class="muted">{{ entry.dateISO }} · {{ entry.readingMinutes }} min read</p>
        <div class="meta-row">
          <span class="tag" *ngFor="let tag of entry.tags">{{ tag }}</span>
        </div>
      </section>

      <article class="card detail-panel">
        <div class="rich-html" data-testid="blog-html" [innerHTML]="postHtml"></div>
      </article>
    </ng-container>

    <ng-template #missing>
      <section class="page-copy">
        <h1 class="h1">Post not found</h1>
      </section>
    </ng-template>
  `,
})
export class BlogPostPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly post: BlogPost | null = getPost(this.route.snapshot.paramMap.get('slug') ?? '') ?? null;
  readonly postHtml: SafeHtml | null = this.post ? this.sanitizer.bypassSecurityTrustHtml(this.post.html) : null;
}
