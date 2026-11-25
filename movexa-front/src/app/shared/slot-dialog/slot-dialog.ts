import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Coach, Course, CourseSlot } from '@core/api/api.models';
import { MovexaApi } from '@core/api/movexa-api.service';
import { WEEK_DAYS } from '@shared/course-colors';
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
          <div class="modal-head-text">
            <h2 id="sd-title" class="modal-title">{{ slot()?.id ? 'Modifier le créneau' : 'Ajouter un créneau' }}</h2>
            <p class="modal-subtitle">Chaque semaine, au même jour et à la même heure.</p>
          </div>
        </header>
        <div class="modal-body">
          @if (error(); as e) { <div class="alert alert--error" role="alert">{{ e }}</div> }
          <div class="field">
            <label for="sd-course">Cours</label>
            <select id="sd-course" name="course" class="input-line" [disabled]="!!slot()?.id" [ngModel]="courseId()" (ngModelChange)="courseId.set(+$event)">
              @for (c of activeCourses(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select>
          </div>
          <div class="sd-pair">
            <div class="field">
              <label for="sd-day">Jour</label>
              <select id="sd-day" name="day" class="input-line" [ngModel]="day()" (ngModelChange)="day.set(+$event)">
                @for (d of days; track d[0]) { <option [ngValue]="d[0]">{{ d[1] }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="sd-time">Heure de début</label>
              <input id="sd-time" name="time" class="input-line" type="time" step="300" [ngModel]="time()" (ngModelChange)="time.set($event)" />
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
    .sd-foot { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .sd-spacer { flex: 1 1 auto; }
    .sd-delete { color: var(--color-danger-strong); border-color: var(--color-danger-strong); }
  `,
})
export class SlotDialog implements OnInit {
  private readonly api = inject(MovexaApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = input.required<Course[]>();
  /** Créneau à modifier (avec son courseId), ou null pour en ajouter un */
  readonly slot = input<CourseSlot | null>(null);
  readonly defaultCourseId = input<number | null>(null);
  readonly defaultDay = input<number>(1);

  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly days = WEEK_DAYS;
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
