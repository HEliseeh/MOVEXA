import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { NavCountsService } from '@core/navigation/nav-counts.service';
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
// Topbar — barre du haut (maquette « Composant : barre du haut ») :
// recherche, enveloppe (relances à envoyer aujourd'hui), cloche (ce qui
// attend une action), avatar (mot de passe, déconnexion).
// Le logo et la déconnexion sont aussi dans le menu latéral.
// ---------------------------------------------------------------
@Component({
  selector: 'app-topbar',
  imports: [ChangePassword, RouterLink],
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

  private readonly auth = inject(AuthService);
  private readonly counts = inject(NavCountsService);

  /** Pop-up « Changer mon mot de passe » */
  readonly changingPassword = signal(false);
  /** Panneau ouvert : notifications ou menu du compte */
  readonly panel = signal<'notifications' | 'account' | null>(null);

  /** Enveloppe : relances de membres à envoyer aujourd'hui */
  readonly messages = computed(() => this.counts.all()?.remindersToSend ?? 0);

  /** Cloche : ce qui attend une action, selon le rôle */
  readonly notifications = computed(() => {
    const c = this.counts.all();
    if (!c) return [];
    const desk = this.store.isDesk();
    const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
    const items: { n: number; text: string; route: string; query?: Record<string, string> }[] = [
      { n: c.prospectsToday, text: plural(c.prospectsToday, 'prospect à relancer aujourd’hui', 'prospects à relancer aujourd’hui'), route: '/prospects' },
      { n: c.remindersToSend ?? 0, text: plural(c.remindersToSend ?? 0, 'relance de membre à envoyer', 'relances de membres à envoyer'), route: '/reminders' },
    ];
    if (desk) {
      items.push(
        { n: c.expiringSoon, text: plural(c.expiringSoon, 'abonnement finit bientôt', 'abonnements finissent bientôt'), route: '/subscriptions' },
        { n: c.pendingLinks ?? 0, text: plural(c.pendingLinks ?? 0, 'lien de paiement en attente', 'liens de paiement en attente'), route: '/payments', query: { tab: 'links' } },
      );
    }
    return items.filter(i => i.n > 0);
  });

  toggle(p: 'notifications' | 'account'): void {
    this.panel.update(current => (current === p ? null : p));
  }

  changePassword(): void {
    this.panel.set(null);
    this.changingPassword.set(true);
  }

  logout(): void {
    this.panel.set(null);
    this.auth.logout();
    this.store.clear();
    this.router.navigate(['/login']);
  }

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
