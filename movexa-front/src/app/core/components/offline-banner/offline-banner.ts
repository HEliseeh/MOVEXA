import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { OfflineService } from '@core/offline/offline.service';

/**
 * Bandeau « Pas de connexion internet » (maquette : composant bandeau hors ligne),
 * visible sur toutes les pages tant que le réseau manque.
 * L'écran Accès et présence a son propre bandeau, plus détaillé (pointages en attente) : on ne double pas.
 */
@Component({
  selector: 'app-offline-banner',
  template: `
    @if (visible()) {
      <div class="ob" role="status">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.1-1.5M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01" />
        </svg>
        <span>
          <strong>Pas de connexion internet.</strong>
          Tu peux continuer à travailler : tout se synchronise automatiquement dès que le réseau revient.
          @if (offline.pending().length) { ({{ offline.pending().length }} pointage(s) en attente) }
        </span>
      </div>
    }
  `,
  styles: `
    .ob {
      display: flex; align-items: center; gap: 10px;
      min-height: 48px; box-sizing: border-box; padding: 10px 44px;
      background: #fde3c0; color: #12262a; font-size: 14px; line-height: 1.4;
    }
    .ob svg { flex: none; }
    @media (max-width: 700px) { .ob { padding: 10px 16px; } }
  `,
})
export class OfflineBanner {
  readonly offline = inject(OfflineService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly visible = computed(() => !this.offline.online() && !this.url().startsWith('/access'));
}
