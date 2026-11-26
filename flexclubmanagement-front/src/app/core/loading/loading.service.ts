import { computed, Injectable, signal } from '@angular/core';

/** Délai avant d'afficher le voile : une requête rapide ne fait pas clignoter l'écran */
const SHOW_DELAY_MS = 300;
/** Une fois affiché, le voile reste au moins ce temps (évite un flash) */
const MIN_VISIBLE_MS = 400;
/** Au-delà, on prévient que ça prend du temps */
const SLOW_AFTER_MS = 8000;

/**
 * Chargement global : compte les opérations en cours (requêtes HTTP, changement de page).
 * - busy : une opération est en cours → les clics et la saisie sont bloqués immédiatement ;
 * - visible : le voile et le spinner apparaissent seulement si ça dure plus de 300 ms ;
 * - slow : message rassurant si ça dure plus de 8 s.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  private readonly _visible = signal(false);
  private readonly _slow = signal(false);

  readonly busy = computed(() => this.pending() > 0);
  readonly visible = this._visible.asReadonly();
  readonly slow = this._slow.asReadonly();

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  begin(): void {
    this.pending.update(n => n + 1);
    if (this.pending() !== 1) return;
    // Nouvelle série d'opérations : annule une disparition programmée
    this.clear('hide');
    if (!this._visible()) {
      this.showTimer = setTimeout(() => {
        this._visible.set(true);
        this.shownAt = Date.now();
      }, SHOW_DELAY_MS);
    }
    this.slowTimer = setTimeout(() => this._slow.set(true), SLOW_AFTER_MS);
  }

  end(): void {
    this.pending.update(n => Math.max(0, n - 1));
    if (this.pending() > 0) return;
    this.clear('show');
    this.clear('slow');
    this._slow.set(false);
    if (!this._visible()) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - this.shownAt));
    this.hideTimer = setTimeout(() => this._visible.set(false), wait);
  }

  private clear(which: 'show' | 'slow' | 'hide'): void {
    const key = `${which}Timer` as 'showTimer' | 'slowTimer' | 'hideTimer';
    const timer = this[key];
    if (timer) clearTimeout(timer);
    this[key] = null;
  }
}
