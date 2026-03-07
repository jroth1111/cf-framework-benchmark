import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home-page.component').then((m) => m.HomePageComponent) },
  { path: 'stays', loadComponent: () => import('./pages/stays-page.component').then((m) => m.StaysPageComponent) },
  {
    path: 'stays/:id',
    loadComponent: () => import('./pages/stay-detail-page.component').then((m) => m.StayDetailPageComponent),
  },
  { path: 'blog', loadComponent: () => import('./pages/blog-page.component').then((m) => m.BlogPageComponent) },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./pages/blog-post-page.component').then((m) => m.BlogPostPageComponent),
  },
  { path: 'chart', loadComponent: () => import('./pages/chart-page.component').then((m) => m.ChartPageComponent) },
  { path: 'media', loadComponent: () => import('./pages/media-page.component').then((m) => m.MediaPageComponent) },
];
