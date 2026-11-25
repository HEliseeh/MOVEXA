import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Course, CourseSession, CourseSlot } from '@core/api/api.models';
import { MovexaApi } from '@core/api/movexa-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { ToastService } from '@core/notifications/toast.service';
import { COURSE_COLORS, WEEK_DAYS } from '@shared/course-colors';
import { addDays, apiError, todayIso } from '@shared/format';
import { SlotDialog } from '@shared/slot-dialog/slot-dialog';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Lundi de la semaine qui contient ce jour (aaaa-mm-jj) */
function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return addDays(iso, 1 - dow);
}

/**
 * Planning du club (maquette « Planning du club ») : les séances de la semaine, jour par jour.
 * Pas de réservation dans le MVP : une séance passée affiche les présents (pointages sur l'activité du cours).
 * Le gérant ajoute, déplace ou supprime les créneaux ; l'accueil consulte.
 */
@Component({
  selector: 'app-planning',
  imports: [RouterLink, SlotDialog],
  templateUrl: './planning.html',
  styleUrl: './planning.css',
})
export class Planning implements OnInit {
  private readonly api = inject(MovexaApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CurrentUserStore);

  readonly colors = COURSE_COLORS;
  readonly today = todayIso();

  readonly weekStart = signal(mondayOf(todayIso()));
  readonly sessions = signal<CourseSession[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selected = signal<CourseSession | null>(null);

  /** Pop-up créneau : null = fermée ; slot null = ajout */
  readonly slotDialog = signal<{ slot: CourseSlot | null; day: number } | null>(null);

  readonly weekLabel = computed(() => {
    const start = new Date(this.weekStart() + 'T12:00:00');
    const end = new Date(addDays(this.weekStart(), 6) + 'T12:00:00');
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  });

  readonly days = computed(() =>
    WEEK_DAYS.map(([n, , short], i) => {
      const iso = addDays(this.weekStart(), i);
      return {
        n,
        iso,
        label: `${short} ${Number(iso.slice(8))}`,
        today: iso === this.today,
        sessions: this.sessions().filter(s => s.date === iso),
      };
    }),
  );

  readonly summary = computed(() => {
    const list = this.sessions();
    const measured = list.filter(s => s.present !== null);
    const places = list.reduce((n, s) => n + s.capacity, 0);
    const present = measured.reduce((n, s) => n + (s.present ?? 0), 0);
    return { count: list.length, places, present, measured: measured.length };
  });

  ngOnInit(): void {
    this.load();
    if (this.store.isManager()) {
      this.api.courses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => this.courses.set(c), error: () => {} });
    }
  }

  load(): void {
    this.loading.set(true);
    this.api
      .planning(this.weekStart())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: w => {
          this.sessions.set(w.sessions);
          this.loading.set(false);
          this.error.set(null);
          const sel = this.selected();
          this.selected.set(sel ? (w.sessions.find(s => s.slotId === sel.slotId && s.date === sel.date) ?? null) : null);
        },
        error: err => {
          this.loading.set(false);
          this.error.set(apiError(err, 'Planning indisponible.'));
        },
      });
  }

  moveWeek(delta: number): void {
    this.weekStart.set(delta === 0 ? mondayOf(this.today) : addDays(this.weekStart(), 7 * delta));
    this.selected.set(null);
    this.load();
  }

  /** « 14 présents sur 20 » pour une séance passée, sinon « 20 places » */
  fillText(s: CourseSession): string {
    return s.present === null ? `${s.capacity} places` : `${s.present} présent${s.present > 1 ? 's' : ''} sur ${s.capacity}`;
  }

  isPast(s: CourseSession): boolean {
    return s.present !== null;
  }

  dateLabel(s: CourseSession): string {
    const d = new Date(s.date + 'T12:00:00');
    const day = WEEK_DAYS[(d.getDay() + 6) % 7][1];
    return `${day} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  // ---- Créneaux (gérant) ----

  addSlot(day = 1): void {
    if (!this.courses().length) {
      this.toast.error('Créez d’abord un cours dans « Cours et coachs ».');
      return;
    }
    this.slotDialog.set({ slot: null, day });
  }

  editSelected(): void {
    const s = this.selected();
    if (!s) return;
    const slot = this.courses()
      .find(c => c.id === s.courseId)
      ?.slots.find(x => x.id === s.slotId);
    if (slot) this.slotDialog.set({ slot: { ...slot, courseId: s.courseId }, day: slot.dayOfWeek });
  }

  onSlotSaved(): void {
    this.slotDialog.set(null);
    this.toast.success('Planning mis à jour.');
    this.api.courses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => this.courses.set(c), error: () => {} });
    this.load();
  }
}
