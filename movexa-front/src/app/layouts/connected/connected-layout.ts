import { OfflineBanner } from '@core/components/offline-banner/offline-banner';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Sidebar } from '@core/components/sidebar/sidebar';
import { Topbar } from '@core/components/topbar/topbar';
import { Toast } from '@shared/toast/toast';

@Component({
  selector: 'app-connected-layout',
  imports: [RouterOutlet, Sidebar, Topbar, Toast, OfflineBanner],
  templateUrl: './connected-layout.html',
  styleUrl:    './connected-layout.scss',
})
export class ConnectedLayout {
  /** Menu latéral ouvert sur petit écran (sur grand écran il est toujours visible) */
  readonly menuOpen = signal(false);

  constructor() {
    // Referme le menu mobile après chaque navigation
    inject(Router)
      .events.pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }
}
