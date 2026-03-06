import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'stays',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'blog',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'chart',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'media',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
