import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Activity, Coach, Course, CourseColor, CoursePayload, CourseSlot } from '@core/api/api.models';
import { MovexaApi } from '@core/api/movexa-api.service';
import { ToastService } from '@core/notifications/toast.service';
import { COLOR_KEYS, COURSE_COLORS, slotSummary, WEEK_DAYS } from '@shared/course-colors';
import { apiError } from '@shared/format';
import { SlotDialog } from '@shared/slot-dialog/slot-dialog';

interface CourseDraft {
  id: number | null;
  name: string;
  description: string;
  coachId: number | null;
  activityId: number | null;
  durationMinutes: number | null;
  capacity: number | null;
  room: string;
  color: CourseColor;
  active: boolean;
}

/**
 * Onglet « Cours collectifs » de Cours et coachs (gérant) : chaque cours avec son coach,
 * sa durée, ses places, ses créneaux de la semaine et son remplissage moyen.
 */
@Component({
  selector: 'app-courses-panel',
  imports: [FormsModule, SlotDialog],
  templateUrl: './courses-panel.html',
  styleUrl: './courses-panel.css',
})
export class CoursesPanel implements OnInit {
  private readonly api = inject(MovexaApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Coachs de la salle (chargés par la page) */
  readonly coaches = input<Coach[]>([]);
  /** Liste des cours à chaque chargement (la page en tire les cours de chaque coach) */
  readonly loaded = output<Course[]>();

  readonly colors = COURSE_COLORS;
  readonly colorKeys = COLOR_KEYS;
  readonly days = WEEK_DAYS;
  readonly slotSummary = slotSummary;

  readonly courses = signal<Course[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly draft = signal<CourseDraft | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly slotDialog = signal<{ slot: CourseSlot | null; courseId: number } | null>(null);

  readonly activeCoaches = computed(() => this.coaches().filter(c => c.active || c.id === this.draft()?.coachId));
  /** Créneaux du cours en cours d'édition */
  readonly draftSlots = computed(() => this.courses().find(c => c.id === this.draft()?.id)?.slots ?? []);
  readonly sessionsPerWeek = computed(() => this.courses().filter(c => c.active).reduce((n, c) => n + c.slots.length, 0));

  ngOnInit(): void {
    this.load();
    this.api.activities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: a => this.activities.set(a), error: () => {} });
  }

  load(): void {
    this.api
      .courses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.courses.set(list);
          this.loaded.emit(list);
          this.loading.set(false);
          this.loadError.set(null);
        },
        error: err => {
          this.loading.set(false);
          this.loadError.set(apiError(err, 'Cours indisponibles.'));
        },
      });
  }

  duration(min: number): string {
    if (min % 60 === 0) return `${min / 60} h`;
    return min > 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
  }

  slotLabel(s: CourseSlot): string {
    return `${WEEK_DAYS[s.dayOfWeek - 1][1]} ${s.startTime}${s.room ? ' · ' + s.room : ''}${s.coachName ? ' · ' + s.coachName : ''}`;
  }

  // ---- Édition d'un cours ----

  edit(c?: Course): void {
    this.formError.set(null);
    const cours = this.activities().find(a => /cours/i.test(a.name));
    this.draft.set(
      c
        ? {
            id: c.id,
            name: c.name,
            description: c.description ?? '',
            coachId: c.coachId,
            activityId: c.activityId,
            durationMinutes: c.durationMinutes,
            capacity: c.capacity,
            room: c.room ?? '',
            color: c.color,
            active: c.active,
          }
        : {
            id: null,
            name: '',
            description: '',
            coachId: null,
            activityId: cours?.id ?? null,
            durationMinutes: 60,
            capacity: 20,
            room: '',
            color: COLOR_KEYS[this.courses().length % COLOR_KEYS.length],
            active: true,
          },
    );
  }

  patch(p: Partial<CourseDraft>): void {
    this.draft.update(d => (d ? { ...d, ...p } : d));
  }

  close(): void {
    if (!this.saving()) this.draft.set(null);
  }

  save(): void {
    const d = this.draft();
    if (!d || this.saving()) return;
    if (!d.name.trim()) return this.formError.set('Indiquez le nom du cours.');
    if (!d.durationMinutes || d.durationMinutes < 15) return this.formError.set('Durée : 15 minutes au moins.');
    if (!d.capacity || d.capacity < 1) return this.formError.set('Indiquez le nombre de places.');
    const payload: CoursePayload = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      coachId: d.coachId,
      activityId: d.activityId,
      durationMinutes: d.durationMinutes,
      capacity: d.capacity,
      room: d.room.trim() || null,
      color: d.color,
      active: d.active,
    };
    this.saving.set(true);
    this.formError.set(null);
    (d.id ? this.api.updateCourse(d.id, payload) : this.api.createCourse(payload)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving.set(false);
        if (d.id) {
          this.draft.set(null);
          this.toast.success(`Cours « ${saved.name} » enregistré.`);
        } else {
          // Nouveau cours : on garde la fenêtre ouverte pour ajouter ses créneaux
          this.patch({ id: saved.id });
          this.toast.success(`Cours « ${saved.name} » créé. Ajoutez maintenant ses créneaux.`);
        }
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(apiError(err, 'Enregistrement impossible.'));
      },
    });
  }

  onSlotSaved(): void {
    this.slotDialog.set(null);
    this.load();
  }
}
