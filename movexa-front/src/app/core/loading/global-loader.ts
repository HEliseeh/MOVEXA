import { Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { LoadingService } from './loading.service';

/**
 * Voile de chargement global, posé au-dessus de toute l'application.
 * Pendant une opération, il bloque clics et clavier tout de suite (évite les doubles envois),
 * puis devient visible avec un spinner si l'opération dure (fondu, sans clignotement).
 * Il suit aussi les changements de page (chargement des écrans à la demande).
 */
@Component({
  selector: 'app-global-loader',
  template: `
    @if (loading.busy() || loading.visible()) {
      <div class="gl" [class.gl--visible]="loading.visible()" role="status" aria-live="polite" [attr.aria-busy]="loading.busy()">
        @if (loading.visible()) {
          <div class="gl-box">
            <span class="gl-spinner" aria-hidden="true"></span>
            <span class="gl-text">{{ loading.slow() ? 'Ça prend plus de temps que prévu… (connexion lente ?)' : 'Chargement…' }}</span>
          </div>
        }
      </div>
    }
  `,
  styleUrl: './global-loader.css',
})
export class GlobalLoader {
  readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  constructor() {
    // Changement de page : début à NavigationStart, fin quand la navigation aboutit ou échoue
    let navigating = false;
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(e => {
      if (e instanceof NavigationStart && !navigating) {
        navigating = true;
        this.loading.begin();
      } else if ((e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) && navigating) {
        navigating = false;
        this.loading.end();
      }
    });

    // Bloque aussi le clavier (Entrée, Espace…) pendant une opération, pas seulement la souris
    const blockKeys = (ev: KeyboardEvent) => {
      if (this.loading.busy() && ev.key !== 'Tab') {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    effect(onCleanup => {
      if (!this.loading.busy()) return;
      document.addEventListener('keydown', blockKeys, true);
      onCleanup(() => document.removeEventListener('keydown', blockKeys, true));
    });
  }
}
