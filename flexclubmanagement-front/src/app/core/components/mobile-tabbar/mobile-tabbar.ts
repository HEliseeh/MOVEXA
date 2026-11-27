import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CurrentUserStore } from '@core/auth/current-user.store';

interface Tab {
  label: string;
  route: string;
  query?: Record<string, string>;
  icon: string;
}

const SCAN = 'M3 8V4h5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h3v3H8zM13 13h3v3h-3z';
const MEMBERS = 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7';
const CASH = 'M2 7h20v12H2zM2 11h20M6 15h4';
const FUNNEL = 'M3 4h18l-7 8v6l-4 2v-8z';

/**
 * Barre d'onglets en bas de l'écran sur téléphone (maquette « Mobile : pointage ») :
 * Pointage, Membres, Encaisser pour l'accueil ; Membres et Prospects pour le commercial.
 */
@Component({
  selector: 'app-mobile-tabbar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabbar" aria-label="Navigation">
      @for (t of tabs(); track t.route) {
        <a class="tab" [routerLink]="t.route" [queryParams]="t.query" routerLinkActive="tab--on" #rla="routerLinkActive"
           [attr.aria-current]="rla.isActive ? 'page' : null">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="t.icon" /></svg>
          {{ t.label }}
        </a>
      }
    </nav>
  `,
  styles: `
    :host { display: none; }
    @media (max-width: 700px) {
      :host {
        display: block;
        position: fixed;
        inset: auto 0 0 0;
        z-index: 250;
        padding-bottom: env(safe-area-inset-bottom);
        background: #12262a;
      }
    }
    .tabbar { display: flex; justify-content: space-around; padding: 6px 8px; }
    .tab {
      flex: 1 1 0;
      min-height: 52px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: #dce7e5;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }
    .tab--on { background: #1c3437; color: #cfe8e3; }
    .tab:focus-visible { outline: 2px solid #cfe8e3; outline-offset: -2px; }
  `,
})
export class MobileTabbar {
  private readonly store = inject(CurrentUserStore);

  readonly tabs = computed<Tab[]>(() =>
    this.store.isDesk()
      ? [
          { label: 'Pointage', route: '/access', icon: SCAN },
          { label: 'Membres', route: '/members', icon: MEMBERS },
          { label: 'Encaisser', route: '/payments', query: { pay: '1' }, icon: CASH },
        ]
      : [
          { label: 'Membres', route: '/members', icon: MEMBERS },
          { label: 'Prospects', route: '/prospects', icon: FUNNEL },
        ],
  );
}
