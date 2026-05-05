import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

type BenchWindow = Window & {
  __CF_BENCH__?: {
    hydration?: { endMs?: number };
  };
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);

  readonly navItems = [
    { label: 'Stays', href: '/stays' },
    { label: 'Chart', href: '/chart' },
    { label: 'Media', href: '/media' },
    { label: 'Blog', href: '/blog' },
  ];

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const w = window as BenchWindow;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = w.__CF_BENCH__.hydration || {};
    hydration.endMs = performance.now();
    w.__CF_BENCH__.hydration = hydration;
  }
}
