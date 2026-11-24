import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { MenuComponent } from '@core/components/menu-component/menu-component';
import { MENU_ITEMS, MenuStep } from '@shared/models/Navigation.model';

// ---------------------------------------------------------------
// Sidebar — menu latéral clair : logo, modules, déconnexion.
// Garde la page active et le seul sous-menu ouvert.
// ---------------------------------------------------------------
@Component({
  selector: 'app-sidebar',
  imports: [MenuComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private router = inject(Router);
  private auth = inject(AuthService);
  private store = inject(CurrentUserStore);

  readonly items = MENU_ITEMS;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Entrée dont la route correspond le mieux à l'URL (/members/import → « Importer un fichier ») */
  readonly activeId = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    let best: { id: string; length: number } | null = null;
    for (const leaf of this.leaves(this.items)) {
      const route = leaf.route[0];
      if (!route || (path !== route && !path.startsWith(route + '/'))) continue;
      if (!best || route.length > best.length) best = { id: leaf.id, length: route.length };
    }
    return best?.id ?? null;
  });

  /** Sous-menu ouvert : celui de la page active à chaque navigation, sinon celui que l'on a cliqué */
  readonly openId = linkedSignal(() => {
    const id = this.activeId();
    return this.items.find(m => m.children?.some(c => c.id === id))?.id ?? null;
  });

  toggle(id: string): void {
    this.openId.update(current => (current === id ? null : id));
  }

  logout(): void {
    this.auth.logout();
    this.store.clear();
    this.router.navigate(['/login']);
  }

  private leaves(steps: MenuStep[]): MenuStep[] {
    return steps.flatMap(s => (s.children?.length ? this.leaves(s.children) : [s]));
  }
}
