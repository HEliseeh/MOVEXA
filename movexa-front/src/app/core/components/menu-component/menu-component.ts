import { Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { MenuStep, ROLE_SHORT_LABELS } from '@shared/models/Navigation.model';

// ---------------------------------------------------------------
// MenuComponent — entrée de nav récursive (item + sous-menus)
// Utilisé par le Sidebar, qui garde l'état ouvert / actif.
// ---------------------------------------------------------------
@Component({
  selector: 'app-menu-component',
  imports: [NgTemplateOutlet, RouterLink, MenuComponent],
  templateUrl: './menu-component.html',
  styleUrl: './menu-component.scss',
  host: {
    '[class.group-start]': 'item().groupStart && depth() === 0',
  },
})
export class MenuComponent {
  private store = inject(CurrentUserStore);

  item = input.required<MenuStep>();
  /** Profondeur dans l'arbre (0 = racine) */
  depth = input(0);
  /** Identifiant de la page active (calculé par le Sidebar) */
  activeId = input<string | null>(null);
  /** Sous-menu ouvert (un seul à la fois, géré par le Sidebar) */
  open = input(false);
  /** Demande d'ouverture / fermeture du sous-menu */
  toggled = output<string>();

  readonly hasChildren = computed(() => !!this.item().children?.length);

  /** Le profil connecté peut-il ouvrir cette entrée ? Un groupe l'est si au moins un enfant l'est. */
  readonly allowed = computed(() => {
    const item = this.item();
    if (item.children?.length) return item.children.some(c => this.can(c));
    return this.can(item);
  });

  readonly isActive = computed(() => {
    const id = this.activeId();
    const item = this.item();
    return id === item.id || !!item.children?.some(c => c.id === id);
  });

  /** « Réservé au profil gérant, accueil » */
  readonly lockReason = computed(() => {
    const item = this.item();
    const roles = item.children?.length
      ? [...new Set(item.children.flatMap(c => c.roles ?? []))]
      : (item.roles ?? []);
    const names = roles.map(r => ROLE_SHORT_LABELS[r]).filter(Boolean);
    return names.length ? `Réservé au profil ${names.join(', ')}` : 'Accès non autorisé';
  });

  toggle(): void {
    this.toggled.emit(this.item().id);
  }

  private can(step: MenuStep): boolean {
    return !step.roles?.length || this.store.hasAnyRole(step.roles);
  }
}
