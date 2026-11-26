import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NavCounts } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { NavBadge } from '@shared/models/Navigation.model';

/**
 * Compteurs des pastilles du menu (prospects à relancer, abonnements qui finissent).
 * Rechargés en arrière-plan à chaque changement de page : une action faite ailleurs
 * (relance envoyée, renouvellement) se voit dès la page suivante.
 */
@Injectable({ providedIn: 'root' })
export class NavCountsService {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly store = inject(CurrentUserStore);
  private readonly counts = signal<NavCounts | null>(null);
  /** Tous les compteurs (cloche et enveloppe de la barre du haut) */
  readonly all = this.counts.asReadonly();

  constructor() {
    inject(Router)
      .events.pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.refresh());
    this.refresh();
  }

  /** Nombre à afficher (0 = pas de pastille) */
  value(badge: NavBadge | undefined): number {
    return badge ? (this.counts()?.[badge] ?? 0) : 0;
  }

  refresh(): void {
    if (!this.store.isStaff()) return;
    this.api.navCounts().subscribe({
      next: c => this.counts.set(c),
      error: () => {
        /* pastilles facultatives : on garde les dernières valeurs */
      },
    });
  }
}
