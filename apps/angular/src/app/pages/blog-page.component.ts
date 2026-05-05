import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { blogPosts, type BlogPost } from '@cf-bench/dataset';

@Component({
  selector: 'app-blog-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-copy">
      <h1 class="h1">Blog</h1>
    </section>

    <section class="blog-list">
      <a
        *ngFor="let post of posts"
        class="card blog-card"
        [routerLink]="['/blog', post.slug]"
        data-testid="blog-post-card"
      >
        <h2>{{ post.title }}</h2>
        <p class="muted small">{{ post.dateISO }} · {{ post.readingMinutes }} min read</p>
        <p class="muted">{{ post.excerpt }}</p>
        <div class="meta-row">
          <span class="tag" *ngFor="let tag of post.tags">{{ tag }}</span>
        </div>
      </a>
    </section>
  `,
})
export class BlogPageComponent {
  readonly posts: BlogPost[] = blogPosts;
}
