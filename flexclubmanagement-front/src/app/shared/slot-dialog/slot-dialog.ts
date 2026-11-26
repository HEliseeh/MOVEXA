import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Coach, Course, CourseSlot } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { COURSE_COLORS, WEEK_DAYS } from '@shared/course-colors';
import { apiError } from '@shared/format';

/**
 * Pop-up « Ajouter un créneau » / « Modifier le créneau » (gérant) :
 * cours, jour, heure, et si besoin une autre salle ou un autre coach que ceux du cours.
 */
@Component({
  selector: 'app-slot-dialog',
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" (keydown.escape)="close()">
      <form class="modal modal--s" role="dialog" aria-modal="true" aria-labelledby="sd-title" (ngSubmit)="save()">
        <header class="modal-head">
          <span class="sd-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2" /></svg>
          </span>
          <div class="modal-head-text">
            <h2 id="sd-title" class="modal-title">{{ slot()?.id ? 'Modifier le créneau' : 'Ajouter un créneau' }}</h2>
            <p class="modal-subtitle">Chaque semaine, au même jour et à la même heure.</p>
          </div>
          <button type="button" class="modal-close" aria-label="Fermer" (click)="close()">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div class="modal-body">
          @if (error(); as e) { <div class="alert alert--error" role="alert">{{ e }}</div> }
          @if (course(); as c) {
            <p class="sd-summary"><span class="sd-swatch" [style.background]="colors[c.color].bg" aria-hidden="true"></span>{{ summary() }}</p>
          }
          <div class="field">
            <label for="sd-course">Cours</label>
            <select id="sd-course" name="course" class="input-line" [disabled]="!!slot()?.id" [ngModel]="courseId()" (ngModelChange)="courseId.set(+$event)">
              @for (c of activeCourses(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select>
          </div>
          <fieldset class="sd-days">
            <legend class="field-label">Jour</legend>
            <div class="choices">
              @for (d of days; track d[0]) {
                <button type="button" class="choice sd-day" [attr.aria-pressed]="day() === d[0]" [attr.aria-label]="d[1]" (click)="day.set(d[0])">{{ d[2] }}</button>
              }
            </div>
          </fieldset>
          <div class="sd-pair">
            <div class="field">
              <label for="sd-time">Heure de début</label>
              <input id="sd-time" name="time" class="input-line" type="time" step="300" [ngModel]="time()" (ngModelChange)="time.set($event)" />
            </div>
            <div class="field">
              <span class="field-label">Fin</span>
              <span class="sd-end">{{ endText() }}</span>
            </div>
          </div>
          <div class="sd-pair">
            <div class="field">
              <label for="sd-room">Salle</label>
              <input id="sd-room" name="room" class="input-line" maxlength="60" [placeholder]="course()?.room || 'Salle du cours'"
                     [ngModel]="room()" (ngModelChange)="room.set($event)" />
            </div>
            <div class="field">
              <label for="sd-coach">Coach</label>
              <select id="sd-coach" name="coach" class="input-line" [ngModel]="coachId()" (ngModelChange)="coachId.set($event === null ? null : +$event)">
                <option [ngValue]="null">{{ course()?.coachName ? 'Celui du cours (' + course()!.coachName + ')' : 'Celui du cours' }}</option>
                @for (c of coaches(); track c.id) { <option [ngValue]="c.id">{{ c.firstName }} {{ c.lastName ?? '' }}</option> }
              </select>
            </div>
          </div>
        </div>
        <footer class="modal-foot sd-foot">
          @if (slot()?.id) {
            <button type="button" class="btn btn-outline sd-delete" [disabled]="saving()" (click)="remove()">Supprimer le créneau</button>
          }
          <span class="sd-spacer"></span>
          <button type="button" class="btn btn-outline" [disabled]="saving()" (click)="close()">Annuler</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </footer>
      </form>
    </div>
  `,
  styles: `
    .sd-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-4); }
    .sd-icon { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 50%; background: var(--ds-pastel-mint); color: #12262a; display: grid; place-items: center; }
    .sd-days { margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px; }
    .sd-day { min-width: 52px; padding: 0 10px; }
    .sd-end { min-height: 44px; display: flex; align-items: center; font-size: 16px; color: var(--color-text-muted); }
    .sd-summary { margin: 0; padding: 12px 14px; border-radius: 14px; background: var(--color-bg); display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .sd-swatch { width: 12px; height: 28px; border-radius: 4px; flex: none; }
    .sd-foot { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .sd-spacer { flex: 1 1 auto; }
    .sd-delete { color: var(--color-danger-strong); border-color: var(--color-danger-strong); }
  `,
})
export class SlotDialog implements OnInit {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = input.required<Course[]>();
  /** Créneau à modifier (avec son courseId), ou null pour en ajouter un */
  readonly slot = input<CourseSlot | null>(null);
  readonly defaultCourseId = input<number | null>(null);
  readonly defaultDay = input<number>(1);

  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly days = WEEK_DAYS;
  readonly colors = COURSE_COLORS;
  readonly coaches = signal<Coach[]>([]);
  readonly courseId = signal<number | null>(null);
  readonly day = signal(1);
  readonly time = signal('18:00');
  readonly room = signal('');
  readonly coachId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeCourses = computed(() => this.courses().filter(c => c.active || c.id === this.courseId()));
  readonly course = computed(() => this.courses().find(c => c.id === this.courseId()) ?? null);

  /** Heure de fin d'après la durée du cours : « 19:00 (1 h) » */
  readonly endText = computed(() => {
    const c = this.course();
    const [h, m] = (this.time() || '00:00').split(':').map(Number);
    if (!c || Number.isNaN(h)) return '—';
    const end = h * 60 + (m || 0) + c.durationMinutes;
    const hh = String(Math.floor(end / 60) % 24).padStart(2, '0');
    const mm = String(end % 60).padStart(2, '0');
    const d = c.durationMinutes;
    return `${hh}:${mm} (${d % 60 === 0 ? d / 60 + ' h' : d + ' min'})`;
  });

  /** « Zumba · tous les lundis à 19:00 » */
  readonly summary = computed(() => {
    const c = this.course();
    const day = WEEK_DAYS.find(d => d[0] === this.day())?.[1].toLowerCase() ?? '';
    return c ? `${c.name} · tous les ${day}s à ${this.time() || '—'}` : '';
  });

  ngOnInit(): void {
    const s = this.slot();
    this.courseId.set(s?.courseId ?? this.defaultCourseId() ?? this.activeCourses()[0]?.id ?? null);
    this.day.set(s?.dayOfWeek ?? this.defaultDay());
    this.time.set(s?.startTime ?? '18:00');
    this.room.set(s?.room ?? '');
    this.coachId.set(s?.coachId ?? null);
    this.api.coaches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.coaches.set(list.filter(c => c.active || c.id === s?.coachId)),
      error: () => {},
    });
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  save(): void {
    const courseId = this.courseId();
    if (!courseId) return this.error.set('Choisissez un cours (créez-le d’abord dans « Cours et coachs »).');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(this.time())) return this.error.set('Indiquez une heure, par exemple 18:00.');
    const payload: CourseSlot = { dayOfWeek: this.day(), startTime: this.time(), room: this.room().trim() || null, coachId: this.coachId() };
    const id = this.slot()?.id;
    this.saving.set(true);
    this.error.set(null);
    (id ? this.api.updateSlot(id, payload) : this.api.addSlot(courseId, payload)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(apiError(err, 'Enregistrement impossible.'));
      },
    });
  }

  remove(): void {
    const id = this.slot()?.id;
    if (!id) return;
    this.saving.set(true);
    this.api.deleteSlot(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(apiError(err, 'Suppression impossible.'));
      },
    });
  }
}
