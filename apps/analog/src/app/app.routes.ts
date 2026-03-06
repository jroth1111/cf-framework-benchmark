import { Routes } from '@angular/router';
import {
  BlogPageComponent,
  BlogPostPageComponent,
  ChartPageComponent,
  HomePageComponent,
  MediaPageComponent,
  StayDetailPageComponent,
  StaysPageComponent,
} from './bench-pages';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'stays', component: StaysPageComponent },
  { path: 'stays/:id', component: StayDetailPageComponent },
  { path: 'blog', component: BlogPageComponent },
  { path: 'blog/:slug', component: BlogPostPageComponent },
  { path: 'chart', component: ChartPageComponent },
  { path: 'media', component: MediaPageComponent },
];
