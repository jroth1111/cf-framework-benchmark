import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

const APP_TEMPLATE = `
<div class="shell">
  <header class="shell-header">
    <div>
      <p class="eyebrow">Cloudflare Workers matrix</p>
      <a routerLink="/" class="brand">Angular benchmark app</a>
    </div>

    <nav class="nav">
      <a
        *ngFor="let item of navItems"
        [routerLink]="item.href"
        routerLinkActive="nav-link-active"
        [routerLinkActiveOptions]="{ exact: item.href === '/' }"
        class="nav-link"
      >
        {{ item.label }}
      </a>
    </nav>
  </header>

  <main class="shell-main">
    <router-outlet></router-outlet>
  </main>
</div>
`;

const APP_STYLES = `
:host {
  display: block;
  min-height: 100vh;
}

.shell {
  min-height: 100vh;
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px;
}

.shell-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  border-bottom: 1px solid var(--border);
  padding-bottom: 18px;
  margin-bottom: 28px;
}

.brand {
  color: var(--text);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.nav-link {
  padding: 10px 14px;
  border-radius: 999px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
}

.nav-link-active {
  color: var(--text);
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.08);
}

.shell-main {
  display: grid;
  gap: 20px;
}

@media (max-width: 820px) {
  .shell {
    padding: 18px;
  }

  .shell-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .brand {
    font-size: 1.7rem;
  }
}
`;

type BenchWindow = Window & {
  __CF_BENCH__?: {
    hydration?: { endMs?: number };
  };
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: APP_TEMPLATE,
  styles: [APP_STYLES],
})
export class App implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);

  readonly navItems = [
    { label: 'Home', href: '/' },
    { label: 'Stays', href: '/stays' },
    { label: 'Blog', href: '/blog' },
    { label: 'Chart', href: '/chart' },
    { label: 'Media', href: '/media' },
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
