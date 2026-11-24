import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { OfflineService } from '@core/offline/offline.service';
import { initials } from '@shared/format';
import { ChangePassword } from '../change-password/change-password';

/** Libellé et couleur de pastille par profil, par ordre de priorité */
const ROLE_INFO: [string, string, 'peach' | 'lavender' | 'lime' | 'mint'][] = [
  ['ROLE_SUPER_ADMIN', 'équipe MOVEXA', 'mint'],
  ['ROLE_ADMIN', 'gérant', 'peach'],
  ['ROLE_RECEPTION', 'accueil', 'lavender'],
  ['ROLE_COMMERCIAL', 'commercial', 'lime'],
  ['ROLE_COACH', 'coach', 'mint'],
];

// ---------------------------------------------------------------
// Topbar — barre du haut claire (design system v2) : recherche sans
// cadre, état hors ligne, messages, notifications, avatar.
// Le logo et la déconnexion sont dans le menu latéral.
// ---------------------------------------------------------------
@Component({
  selector: 'app-topbar',
  imports: [ChangePassword],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  private store = inject(CurrentUserStore);
  private router = inject(Router);
  readonly offline = inject(OfflineService);

  /** Menu latéral ouvert (affichage mobile uniquement) */
  menuOpen = input(false);

  /** Émis quand l'utilisateur clique sur le bouton menu (mobile) */
  menuToggle = output<void>();

  readonly query = signal('');

  readonly user = this.store.user;

  /** Pop-up « Changer mon mot de passe » */
  readonly changingPassword = signal(false);

  private readonly role = computed(() => {
    const roles = this.store.roles();
    return ROLE_INFO.find(([role]) => roles.includes(role));
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return u.firstName || u.lastName ? initials(u.firstName, u.lastName) : u.login.slice(0, 2).toUpperCase();
  });

  /** « Nadia Koné, gérant » */
  readonly userLabel = computed(() => {
    const u = this.user();
    if (!u) return '';
    const name = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.login;
    const role = this.role()?.[1];
    return role ? `${name}, ${role}` : name;
  });

  readonly avatarTone = computed(() => this.role()?.[2] ?? 'mint');

  /** Pastille visible seulement hors ligne ou s'il reste des pointages à envoyer */
  readonly syncLabel = computed(() => {
    const n = this.offline.pending().length;
    if (!this.offline.online()) return n ? `Hors ligne · ${n} en attente` : 'Hors ligne';
    return n ? `Synchronisation · ${n} en attente` : null;
  });

  /** Recherche : ouvre la liste des membres filtrée */
  search(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();
    if (!q) return;
    this.router.navigate(['/members'], { queryParams: { q } });
  }
}
