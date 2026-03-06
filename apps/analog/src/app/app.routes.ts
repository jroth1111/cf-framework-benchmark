import { Routes } from '@angular/router';
import {
  BlogPageComponent,
  BlogPostPageComponent,
  HomePageComponent,
  StayDetailPageComponent,
  StaysPageComponent,
} from './bench-pages';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'stays', component: StaysPageComponent },
  { path: 'stays/:id', component: StayDetailPageComponent },
  { path: 'blog', component: BlogPageComponent },
  { path: 'blog/:slug', component: BlogPostPageComponent },
  { path: 'chart', loadComponent: () => import('./bench-pages').then((mod) => mod.ChartPageComponent) },
  { path: 'media', loadComponent: () => import('./bench-pages').then((mod) => mod.MediaPageComponent) },
];
