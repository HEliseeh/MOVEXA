import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Activity, Plan, PlanPayload } from '@core/api/api.models';
import { MovexaApi } from '@core/api/movexa-api.service';
import { ToastService } from '@core/notifications/toast.service';
import { apiError, fcfa } from '@shared/format';

/** Formule en cours d'édition (panneau de droite) */
interface PlanDraft {
  id: number | null;
  name: string;
  price: number | null;
  durationDays: number;
  /** Durée choisie dans la liste, ou « custom » pour une durée en jours libre */
  durationPreset: string;
  freezeAllowed: boolean;
  activityIds: number[];
  registrationFee: number | null;
  active: boolean;
}

/** Durées proposées (en jours) ; « Autre » permet une durée libre */
const DURATIONS: [number, string][] = [
  [0, 'Le jour même (séance unique)'],
  [7, '7 jours'],
  [30, '1 mois'],
  [90, '3 mois'],
  [180, '6 mois'],
  [365, '12 mois'],
];

export function durationLabel(days: number): string {
  const known = DURATIONS.find(([d]) => d === days);
  if (known) return days === 0 ? '1 entrée, le jour même' : known[1];
  return `${days} jours`;
}

/**
 * Formules et tarifs (gérant) : prix, durée, activités incluses, frais d'inscription, gel,
 * mise en vente. Une formule n'est jamais supprimée : on la retire de la vente.
 * En bas, les activités de la salle (vérifiées à chaque pointage).
 */
@Component({
  selector: 'app-plans',
  imports: [FormsModule],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
})
export class Plans implements OnInit {
  private readonly api = inject(MovexaApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly fcfa = fcfa;
  readonly durationLabel = durationLabel;
  readonly durations = DURATIONS;

  readonly plans = signal<Plan[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly draft = signal<PlanDraft | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly newActivity = signal('');
  readonly renaming = signal<{ id: number; name: string } | null>(null);

  readonly onSale = computed(() => this.plans().filter(p => p.active));
  readonly subscriptionsInProgress = computed(() => this.plans().reduce((n, p) => n + (p.memberCount ?? 0), 0));
  /** Formule la plus vendue ce mois-ci (aucune s'il n'y a pas eu de vente) */
  readonly bestSellerId = computed(() => {
    const best = [...this.plans()].sort((a, b) => (b.salesThisMonth ?? 0) - (a.salesThisMonth ?? 0))[0];
    return best && (best.salesThisMonth ?? 0) > 0 ? best.id : null;
  });
  /** Activités proposées dans le formulaire : en vente, plus celles déjà incluses dans la formule */
  readonly activityChoices = computed(() => {
    const d = this.draft();
    return this.activities().filter(a => a.active || d?.activityIds.includes(a.id));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({ plans: this.api.plans(true), activities: this.api.activities() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ plans, activities }) => {
          this.plans.set(plans);
          this.activities.set(activities);
          this.loading.set(false);
          this.loadError.set(null);
          const d = this.draft();
          if (!d) {
            const first = plans.find(p => p.active) ?? plans[0];
            if (first) this.edit(first);
          }
        },
        error: err => {
          this.loading.set(false);
          this.loadError.set(apiError(err, 'Formules indisponibles.'));
        },
      });
  }

  /** Ligne d'information sous le prix : ventes du mois pour une séance, membres sinon */
  usage(p: Plan): string {
    if (p.durationDays === 0) {
      const n = p.salesThisMonth ?? 0;
      return `${n} vente${n > 1 ? 's' : ''} ce mois-ci`;
    }
    const n = p.memberCount ?? 0;
    return `${n} abonnement${n > 1 ? 's' : ''} en cours`;
  }

  // ---- Édition d'une formule ----

  edit(p?: Plan): void {
    this.formError.set(null);
    const preset = (days: number) => (DURATIONS.some(([d]) => d === days) ? String(days) : 'custom');
    this.draft.set(
      p
        ? {
            id: p.id,
            name: p.name,
            price: p.price,
            durationDays: p.durationDays,
            durationPreset: preset(p.durationDays),
            freezeAllowed: p.freezeAllowed,
            activityIds: [...p.activityIds],
            registrationFee: p.registrationFee || null,
            active: p.active,
          }
        : {
            id: null,
            name: '',
            price: null,
            durationDays: 30,
            durationPreset: '30',
            freezeAllowed: false,
            activityIds: this.activities().filter(a => a.active).map(a => a.id),
            registrationFee: null,
            active: true,
          },
    );
  }

  patch(p: Partial<PlanDraft>): void {
    this.draft.update(d => (d ? { ...d, ...p } : d));
  }

  pickDuration(value: string): void {
    this.patch(value === 'custom' ? { durationPreset: value } : { durationPreset: value, durationDays: +value });
  }

  toggleActivity(id: number, on: boolean): void {
    this.draft.update(d =>
      d ? { ...d, activityIds: on ? [...new Set([...d.activityIds, id])] : d.activityIds.filter(x => x !== id) } : d,
    );
  }

  save(active?: boolean): void {
    const d = this.draft();
    if (!d || this.saving()) return;
    const error = this.validate(d);
    if (error) {
      this.formError.set(error);
      return;
    }
    const payload: PlanPayload = {
      name: d.name.trim(),
      price: d.price!,
      durationDays: d.durationDays,
      active: active ?? d.active,
      registrationFee: d.registrationFee ?? 0,
      freezeAllowed: d.freezeAllowed,
      activityIds: d.activityIds,
    };
    this.saving.set(true);
    this.formError.set(null);
    const req = d.id ? this.api.updatePlan(d.id, payload) : this.api.createPlan(payload);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving.set(false);
        this.toast.success(
          active === false
            ? `« ${saved.name} » est retirée de la vente.`
            : active === true
              ? `« ${saved.name} » est de nouveau en vente.`
              : `Formule « ${saved.name} » enregistrée.`,
        );
        this.edit(saved);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(apiError(err, 'Enregistrement impossible.'));
      },
    });
  }

  private validate(d: PlanDraft): string | null {
    if (!d.name.trim()) return 'Indiquez le nom de la formule.';
    if (d.price === null || d.price < 0) return 'Indiquez un prix (0 ou plus).';
    if (d.durationDays === null || d.durationDays < 0 || d.durationDays > 3660) return 'Indiquez une durée en jours (0 = le jour même).';
    if (!d.activityIds.length) return 'Cochez au moins une activité, sinon le QR code du membre sera refusé partout.';
    if (d.registrationFee !== null && d.registrationFee < 0) return 'Les frais d’inscription ne peuvent pas être négatifs.';
    return null;
  }

  // ---- Activités de la salle ----

  addActivity(): void {
    const name = this.newActivity().trim();
    if (!name) return;
    this.api.createActivity(name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: a => {
        this.newActivity.set('');
        this.activities.update(list => [...list, a]);
        this.toast.success(`Activité « ${a.name} » ajoutée. Cochez-la dans les formules qui l’incluent.`);
      },
      error: err => this.toast.error(apiError(err, 'Ajout impossible.')),
    });
  }

  saveActivity(a: Activity, changes: Partial<Pick<Activity, 'name' | 'active'>>): void {
    const name = (changes.name ?? a.name).trim();
    if (!name) return;
    this.api
      .updateActivity({ id: a.id, name, active: changes.active ?? a.active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.renaming.set(null);
          this.load();
        },
        error: err => this.toast.error(apiError(err, 'Modification impossible.')),
      });
  }
}
