import { Component, computed, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Coach, CoachPayload, Course } from '@core/api/api.models';
import { MovexaApi } from '@core/api/movexa-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { ToastService } from '@core/notifications/toast.service';
import { CoursesPanel } from './courses-panel/courses-panel';
import { ConfirmDialog } from '@shared/confirm-dialog/confirm-dialog';
import { apiError, initials, whatsappLink } from '@shared/format';

/** Fiche en cours d'édition (pop-up) */
interface CoachDraft extends CoachPayload {
  id?: number;
  memberCount: number;
}

const AVATARS = ['#c3b5f7', '#fde3c0', '#e8f55a', '#cfe8e3', '#d6e8f7'];

const EMPTY_DRAFT: CoachDraft = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  notes: '',
  active: true,
  disciplines: [],
  memberCount: 0,
};

/**
 * Équipe des coachs : qui ils sont, ce qu'ils enseignent, combien de membres ils suivent.
 * Tout le monde consulte ; seul le gérant crée, modifie ou supprime (règle appliquée par le serveur).
 */
@Component({
  selector: 'app-coaches',
  imports: [FormsModule, RouterLink, ConfirmDialog, CoursesPanel],
  templateUrl: './coaches.html',
  styleUrl: './coaches.css',
})
export class Coaches implements OnInit {
  private readonly api = inject(MovexaApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CurrentUserStore);

  readonly initials = initials;
  readonly whatsappLink = whatsappLink;

  readonly coaches = signal<Coach[]>([]);
  /** Cours collectifs (chargés par le panneau des cours) */
  readonly courses = signal<Course[]>([]);
  readonly panel = viewChild(CoursesPanel);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  /** Disciplines connues (suggestions du formulaire) */
  readonly knownDisciplines = signal<string[]>([]);

  readonly courseCount = computed(() => this.courses().filter(c => c.active).length);
  readonly activeCoaches = computed(() => this.coaches().filter(c => c.active));

  /** Coachs (actifs d'abord) avec les cours qu'ils donnent et leurs séances de la semaine */
  readonly coachRows = computed(() => {
    const active = this.courses().filter(c => c.active);
    return [...this.coaches()]
      .sort((a, b) => Number(b.active) - Number(a.active) || this.fullName(a).localeCompare(this.fullName(b), 'fr'))
      .map((c, i) => {
        const names = new Set<string>();
        let sessions = 0;
        for (const course of active) {
          for (const slot of course.slots) {
            if ((slot.coachId ?? course.coachId) === c.id) {
              sessions++;
              names.add(course.name);
            }
          }
          if (course.coachId === c.id) names.add(course.name);
        }
        return { c, courses: [...names], sessions, bg: AVATARS[i % AVATARS.length] };
      });
  });

  // ---- Pop-up ----
  readonly draft = signal<CoachDraft | null>(null);
  readonly disciplineInput = signal('');
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly confirmDelete = signal(false);
  readonly deleting = signal(false);

  /** Suggestions pas encore ajoutées à la fiche */
  readonly suggestions = computed(() => {
    const taken = new Set((this.draft()?.disciplines ?? []).map(d => d.toLowerCase()));
    return this.knownDisciplines().filter(d => !taken.has(d.toLowerCase()));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .coaches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.coaches.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('Impossible de charger les coachs. Vérifiez que le backend est démarré.');
          this.loading.set(false);
        },
      });
    this.api.coachDisciplines().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: d => this.knownDisciplines.set(d), error: () => {} });
  }

  fullName(c: { firstName: string; lastName: string | null }): string {
    return `${c.firstName} ${c.lastName ?? ''}`.trim();
  }

  // ---- Création / modification ----

  edit(c?: Coach): void {
    if (!this.store.isManager()) return;
    this.formError.set(null);
    this.disciplineInput.set('');
    this.confirmDelete.set(false);
    this.draft.set(
      c
        ? {
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName ?? '',
            phone: c.phone ?? '',
            email: c.email ?? '',
            notes: c.notes ?? '',
            active: c.active,
            disciplines: [...c.disciplines],
            memberCount: c.memberCount ?? 0,
          }
        : { ...EMPTY_DRAFT, disciplines: [] },
    );
  }

  close(): void {
    if (!this.saving()) this.draft.set(null);
  }

  patch(p: Partial<CoachDraft>): void {
    this.draft.update(d => (d ? { ...d, ...p } : d));
  }

  /** Ajoute la ou les disciplines saisies (séparées par des virgules) */
  addDiscipline(value = this.disciplineInput()): void {
    const parts = value
      .split(',')
      .map(v => v.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (!parts.length) return;
    this.draft.update(d => {
      if (!d) return d;
      const list = [...d.disciplines];
      for (const p of parts) {
        if (!list.some(x => x.toLowerCase() === p.toLowerCase())) list.push(p.charAt(0).toUpperCase() + p.slice(1));
      }
      return { ...d, disciplines: list.slice(0, 15) };
    });
    this.disciplineInput.set('');
  }

  removeDiscipline(d: string): void {
    this.draft.update(x => (x ? { ...x, disciplines: x.disciplines.filter(v => v !== d) } : x));
  }

  onDisciplineKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this.addDiscipline();
    } else if (e.key === 'Backspace' && !this.disciplineInput()) {
      const list = this.draft()?.disciplines ?? [];
      if (list.length) this.removeDiscipline(list[list.length - 1]);
    }
  }

  save(): void {
    const d = this.draft();
    if (!d) return;
    if (this.disciplineInput().trim()) this.addDiscipline();
    const current = this.draft()!;
    if (!current.firstName.trim()) {
      this.formError.set('Le prénom du coach est obligatoire.');
      return;
    }
    const email = (current.email ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.formError.set('Adresse e-mail invalide.');
      return;
    }
    const payload: CoachPayload = {
      firstName: current.firstName.trim(),
      lastName: current.lastName?.trim() || null,
      phone: current.phone?.trim() || null,
      email: email || null,
      notes: current.notes?.trim() || null,
      active: current.active,
      disciplines: current.disciplines,
    };
    this.saving.set(true);
    this.formError.set(null);
    const req = current.id ? this.api.updateCoach(current.id, payload) : this.api.createCoach(payload);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving.set(false);
        this.draft.set(null);
        this.toast.success(current.id ? `Fiche de ${this.fullName(saved)} enregistrée.` : `${this.fullName(saved)} a rejoint l’équipe.`);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(apiError(err, 'Enregistrement impossible.'));
      },
    });
  }

  // ---- Suppression ----

  deleteMessage(): string {
    const d = this.draft();
    const n = d?.memberCount ?? 0;
    const who = d ? this.fullName({ firstName: d.firstName, lastName: d.lastName }) : '';
    return (
      `La fiche de ${who} sera supprimée définitivement.` +
      (n ? ` Les ${n} membre(s) qu’il ou elle suit n’auront plus de coach (ils ne sont pas supprimés).` : '') +
      ' Pour garder l’historique, vous pouvez plutôt le marquer « inactif ».'
    );
  }

  remove(): void {
    const d = this.draft();
    if (!d?.id) return;
    this.deleting.set(true);
    this.api
      .deleteCoach(d.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDelete.set(false);
          this.draft.set(null);
          this.toast.success('Coach supprimé.');
          this.load();
        },
        error: err => {
          this.deleting.set(false);
          this.confirmDelete.set(false);
          this.formError.set(apiError(err, 'Suppression impossible.'));
        },
      });
  }
}
