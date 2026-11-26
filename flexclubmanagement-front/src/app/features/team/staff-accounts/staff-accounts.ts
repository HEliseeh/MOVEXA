import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { StaffAccount, StaffRole } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { ToastService } from '@core/notifications/toast.service';
import { apiError } from '@shared/format';
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES } from '@shared/password-policy';

const PASSWORD_MIN = PASSWORD_MIN_LENGTH;

/** Règles non respectées, en clair (null si le mot de passe convient) */
function passwordProblem(value: string): string | null {
  const failed = PASSWORD_RULES.filter(r => !r.test(value));
  return failed.length ? `Mot de passe : ${failed.map(r => r.label.toLowerCase()).join(', ')}.` : null;
}

interface AccountDraft {
  id: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffRole;
  activated: boolean;
  password: string;
}

const EMPTY_DRAFT: AccountDraft = {
  id: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'RECEPTION',
  activated: true,
  password: '',
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  MANAGER: 'Gérant',
  RECEPTION: 'Réceptionniste',
  COMMERCIAL: 'Commercial',
  OTHER: 'Aucun rôle (pas d’accès)',
};

/**
 * Mot de passe facile à dicter (pas de 0/O, 1/l/I) qui respecte la règle du gateway :
 * au moins une majuscule, un chiffre et un caractère spécial.
 */
function generatePassword(length = 10): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '@#-!?';
  const random = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
  const pick = (set: string) => set[random(set.length)];
  // Une majuscule, un chiffre et un caractère spécial garantis, le reste au hasard…
  const chars = [pick(upper), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(lower + upper + digits));
  // …puis mélangés (Fisher-Yates) pour que ces caractères ne soient pas toujours au début
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Paramètres › Utilisateurs : le gérant crée les comptes de son équipe, choisit le rôle,
 * désactive un compte (départ) et remet un mot de passe. On se connecte avec son adresse e-mail ;
 * le gérant transmet le premier mot de passe, ensuite « Mot de passe oublié » envoie un lien.
 */
@Component({
  selector: 'app-staff-accounts',
  imports: [FormsModule],
  templateUrl: './staff-accounts.html',
  styleUrl: './staff-accounts.css',
})
export class StaffAccounts implements OnInit {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly toast = inject(ToastService);
  private readonly store = inject(CurrentUserStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabels = ROLE_LABELS;
  readonly passwordMin = PASSWORD_MIN;

  /** Ce que peut faire chaque rôle : [action, réceptionniste, commercial, gérant] (règles appliquées par le serveur) */
  readonly permissions: [string, string, string, string][] = [
    ['Inscrire et modifier un membre', 'Oui', 'Oui', 'Oui'],
    ['Suivre les prospects, relancer les membres', 'Oui', 'Oui', 'Oui'],
    ['Pointer une entrée, encaisser un paiement', 'Oui', 'Non', 'Oui'],
    ['Clôturer la caisse du jour', 'Oui', 'Non', 'Oui'],
    ['Archiver un membre', 'Non', 'Non', 'Oui'],
    ['Importer ou exporter la liste des membres', 'Non', 'Non', 'Oui'],
    ['Annuler ou confirmer un paiement', 'Non', 'Non', 'Oui'],
    ['Tableau de bord et chiffre d’affaires', 'Non', 'Non', 'Oui'],
    ['Formules, coachs, équipe, paramètres', 'Non', 'Non', 'Oui'],
  ];

  /** Rôles proposés dans le formulaire, dans cet ordre */
  readonly roleChoices: StaffRole[] = ['RECEPTION', 'COMMERCIAL', 'MANAGER'];

  // ---- Filtres de la liste ----
  readonly query = signal('');
  readonly roleFilter = signal<StaffRole | ''>('');

  readonly accounts = signal<StaffAccount[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly showInactive = signal(false);

  readonly draft = signal<AccountDraft | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly resetting = signal<StaffAccount | null>(null);
  readonly newPassword = signal('');

  readonly myLogin = computed(() => this.store.user()?.login ?? '');
  readonly inactiveCount = computed(() => this.accounts().filter(a => !a.activated).length);
  readonly visible = computed(() => {
    const order: Record<StaffRole, number> = { MANAGER: 0, RECEPTION: 1, COMMERCIAL: 2, OTHER: 3 };
    const q = this.query().trim().toLowerCase();
    const role = this.roleFilter();
    return this.accounts()
      .filter(a => this.showInactive() || a.activated)
      .filter(a => !role || a.role === role)
      .filter(a => !q || `${this.fullName(a)} ${a.email ?? ''} ${a.login} ${a.phone ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.activated) - Number(a.activated) || order[a.role] - order[b.role] || a.login.localeCompare(b.login));
  });
  readonly isSelf = computed(() => {
    const d = this.draft();
    return !!d?.id && this.accounts().some(a => a.id === d.id && a.login === this.myLogin());
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.staff().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.accounts.set(list);
        this.loading.set(false);
        this.loadError.set(null);
      },
      error: err => {
        this.loading.set(false);
        this.loadError.set(apiError(err, 'Liste des comptes indisponible.'));
      },
    });
  }

  fullName(a: StaffAccount): string {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.login;
  }

  isMe(a: StaffAccount): boolean {
    return a.login === this.myLogin();
  }

  // ---- Création / modification ----

  /** « Aujourd’hui à 08:12 », « 12/11/2026 », « Jamais » */
  lastLogin(a: StaffAccount): string {
    if (!a.lastLoginAt) return 'Jamais';
    const d = new Date(a.lastLoginAt);
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `Aujourd’hui à ${time}`;
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Hier à ${time}`;
    return d.toLocaleDateString('fr-FR');
  }

  edit(a?: StaffAccount): void {
    this.formError.set(null);
    this.draft.set(
      a
        ? {
            id: a.id,
            firstName: a.firstName ?? '',
            lastName: a.lastName ?? '',
            email: a.email ?? '',
            phone: a.phone ?? '',
            // Un compte sans rôle FLEXCLUBMANAGEMENT reçoit « Réceptionniste » par défaut s'il est modifié
            role: a.role === 'OTHER' ? 'RECEPTION' : a.role,
            activated: a.activated,
            password: '',
          }
        : { ...EMPTY_DRAFT, password: generatePassword() },
    );
  }

  patch(p: Partial<AccountDraft>): void {
    this.draft.update(d => (d ? { ...d, ...p } : d));
  }

  regenerate(): void {
    this.patch({ password: generatePassword() });
  }

  regeneratePassword(): string {
    return generatePassword();
  }

  close(): void {
    if (!this.saving()) this.draft.set(null);
  }

  save(): void {
    const d = this.draft();
    if (!d || this.saving()) return;
    const error = this.validate(d);
    if (error) {
      this.formError.set(error);
      return;
    }
    const common = {
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim() || null,
      email: d.email.trim().toLowerCase(),
      phone: d.phone.trim() || null,
      role: d.role,
    };
    const request = d.id
      ? this.api.updateStaff(d.id, { ...common, activated: d.activated })
      : this.api.createStaff({ ...common, password: d.password });

    this.saving.set(true);
    this.formError.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving.set(false);
        this.draft.set(null);
        this.accounts.update(list => (d.id ? list.map(a => (a.id === saved.id ? saved : a)) : [...list, saved]));
        this.toast.success(
          d.id
            ? `Compte de ${this.fullName(saved)} enregistré.`
            : `Compte créé. ${this.fullName(saved)} se connecte avec « ${saved.email} » et le mot de passe que vous lui transmettez.`,
        );
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(apiError(err, 'Enregistrement impossible.'));
      },
    });
  }

  private validate(d: AccountDraft): string | null {
    if (!d.firstName.trim()) return 'Le prénom est obligatoire.';
    const email = d.email.trim();
    if (!email) return 'L’adresse e-mail est obligatoire : elle sert à se connecter.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Adresse e-mail invalide.';
    if (!d.id && email.length > 50) return 'Adresse e-mail : 50 caractères maximum.';
    if (!d.id) {
      const weak = passwordProblem(d.password);
      if (weak) return weak;
    }
    return null;
  }

  // ---- Nouveau mot de passe ----

  askReset(a: StaffAccount): void {
    this.newPassword.set(generatePassword());
    this.formError.set(null);
    this.resetting.set(a);
  }

  closeReset(): void {
    if (!this.saving()) this.resetting.set(null);
  }

  confirmReset(): void {
    const a = this.resetting();
    const password = this.newPassword();
    if (!a || this.saving()) return;
    const weak = passwordProblem(password);
    if (weak) {
      this.formError.set(weak);
      return;
    }
    this.saving.set(true);
    this.api.resetStaffPassword(a.id, password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetting.set(null);
        this.toast.success(`Nouveau mot de passe enregistré pour ${this.fullName(a)}. Transmettez-le lui.`);
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(apiError(err, 'Changement impossible.'));
      },
    });
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.success('Copié.'),
      () => this.toast.error('Copie impossible : notez-le à la main.'),
    );
  }
}
