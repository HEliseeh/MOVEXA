import { CurrentUserStore } from '@core/auth/current-user.store';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Activity, Coach, GymSettings, MemberLite, PaymentMethod, Plan } from '@core/api/api.models';
import { MembersService, MemberDto, MemberPayload } from '@core/api/members.service';
import { MovexaApi } from '@core/api/movexa-api.service';
import { MemberPhoto } from '@shared/member-photo/member-photo';
import { shrinkImage } from '@shared/image';
import { ConfirmDialog } from '@shared/confirm-dialog/confirm-dialog';
import { addDays, apiError, fcfa, frDate, initials, METHOD_LABELS, todayIso, whatsappLink } from '@shared/format';

/** Données reprises d'un prospect converti en membre (sans ressaisie) */
export interface MemberPrefill {
  firstName?: string;
  lastName?: string;
  phone?: string;
  prospectId?: number;
  planName?: string | null;
}

/** Téléphone : chiffres, espaces, points, tirets, + au début ; au moins 8 chiffres */
function phone(control: AbstractControl<string>): ValidationErrors | null {
  const v = control.value?.trim();
  if (!v) return null;
  if (!/^\+?[0-9][0-9 .-]{6,18}[0-9]$/.test(v)) return { phone: true };
  return v.replace(/\D/g, '').length < 8 ? { phone: true } : null;
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && !control.value.trim() ? { required: true } : null;
}

function email(control: AbstractControl<string>): ValidationErrors | null {
  const v = control.value?.trim();
  return v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? { email: true } : null;
}

const MESSAGES: Record<string, Record<string, string>> = {
  phone: { required: 'Indiquez le numéro de téléphone.', phone: 'Ce numéro semble incomplet.', taken: '' },
  firstName: { required: 'Indiquez le prénom.', maxlength: '100 caractères maximum.' },
  lastName: { required: 'Indiquez le nom.', maxlength: '100 caractères maximum.' },
  email: { email: 'Cette adresse e-mail n’est pas valide.', taken: 'Cette adresse e-mail est déjà utilisée.' },
  notes: { maxlength: '300 caractères maximum.' },
};

/**
 * Pop-up « Nouveau membre / Modifier le membre » (maquette « Pop-up formulaire »).
 * Objectif : inscription, formule et paiement en moins de 30 secondes.
 */
@Component({
  selector: 'app-member-form',
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialog, MemberPhoto],
  templateUrl: './member-form.html',
  styleUrl: './member-form.css',
})
export class MemberForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly members = inject(MembersService);
  private readonly api = inject(MovexaApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  /** Archiver un membre : réservé au gérant */
  readonly store = inject(CurrentUserStore);

  /** null = création, sinon le membre à modifier */
  readonly member = input<MemberDto | null>(null);
  readonly prefill = input<MemberPrefill | null>(null);

  readonly saved = output<{ member: MemberDto; created: boolean }>();
  readonly deleted = output<MemberDto>();
  readonly closed = output<void>();

  readonly isEdit = computed(() => this.member() !== null);
  readonly plans = signal<Plan[]>([]);
  /** Coachs proposés : les actifs, plus le coach actuel du membre s'il est devenu inactif */
  readonly coaches = signal<Coach[]>([]);
  readonly settings = signal<GymSettings | null>(null);
  readonly method = signal<PaymentMethod>('CASH');

  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);
  /** Membre créé : écran « Inscription terminée » */
  readonly done = signal<MemberDto | null>(null);
  /** Doublon détecté pendant la saisie du téléphone */
  readonly duplicate = signal<MemberLite | null>(null);

  // ---- Activités (droits d'accès) ----
  readonly activities = signal<Activity[]>([]);
  /** 'plan' : droits de la formule ; 'custom' : choisis un par un */
  readonly accessMode = signal<'plan' | 'custom'>('plan');
  readonly customIds = signal<number[]>([]);
  /** Membre rechargé (modification) : droits actuels et photo */
  readonly current = signal<MemberDto | null>(null);

  // ---- Photo (facultative) ----
  readonly photo = signal<Blob | null>(null);
  readonly photoPreview = signal<string | null>(null);
  readonly removePhoto = signal(false);
  readonly photoError = signal<string | null>(null);

  readonly fcfa = fcfa;
  readonly frDate = frDate;
  readonly methodLabels = METHOD_LABELS;
  readonly today = todayIso();

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, phone]],
    firstName: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    email: ['', [email]],
    notes: ['', [Validators.maxLength(300)]],
    planId: [0],
    coachId: [0],
    startDate: [todayIso()],
  });

  private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue()), map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly plan = computed(() => this.plans().find(p => p.id === +this.values().planId) ?? null);

  /** Montant de la première formule : prix + frais d'inscription (nouveau membre) */
  readonly firstAmount = computed(() => {
    const p = this.plan();
    return p ? p.price + (p.registrationFee ?? 0) : 0;
  });

  /** Droits de la formule (création : formule choisie ; modification : formule en cours) */
  readonly planRights = computed(() => {
    if (!this.isEdit()) return this.plan()?.activityNames ?? null;
    const m = this.current();
    return m && !m.customAccess ? (m.activityNames ?? []) : null;
  });

  /** Activités proposées en mode « une par une » : en vente, plus celles déjà accordées */
  readonly activityChoices = computed(() => this.activities().filter(a => a.active || this.customIds().includes(a.id)));

  /** Titres numérotés des étapes, comme sur la maquette */
  readonly step = computed(() => {
    const create = !this.isEdit() && this.store.isDesk();
    return create
      ? { identity: '1 · Identité', plan: '2 · Formule', access: '3 · Activités autorisées', pay: `4 · Paiement de ${fcfa(this.firstAmount())}` }
      : { identity: 'Identité', plan: 'Formule', access: 'Activités autorisées', pay: 'Paiement' };
  });
  readonly initials = computed(() => initials(this.values().firstName, this.values().lastName));
  readonly fullName = computed(() => `${this.values().firstName} ${this.values().lastName}`.trim());

  readonly methods = computed(() => {
    const s = this.settings();
    return (
      [
        ['CASH', s?.cashEnabled ?? true],
        ['MTN_MOMO', s?.mtnEnabled ?? true],
        ['MOOV_MONEY', s?.moovEnabled ?? true],
        ['PAYMENT_LINK', !!s?.paymentLinkBaseUrl],
      ] as [PaymentMethod, boolean][]
    ).map(([id, enabled]) => ({ id, enabled, label: METHOD_LABELS[id] }));
  });

  readonly endText = computed(() => {
    const p = this.plan();
    if (!p) return 'Aucun abonnement pour l’instant : pensez à encaisser avant la première séance.';
    const start = this.values().startDate || this.today;
    return p.durationDays === 0 ? 'Valable le jour même.' : `Fin calculée : ${frDate(addDays(start, p.durationDays))}`;
  });

  readonly subtitle = computed(() => {
    const m = this.member();
    return m ? `N° ${m.memberNumber} · inscrit le ${frDate(m.joinDate)}` : 'Inscription, formule et paiement en une seule fois.';
  });

  readonly saveLabel = computed(() => {
    if (this.saving()) return 'Enregistrement…';
    if (this.isEdit()) return 'Enregistrer les modifications';
    const p = this.plan();
    if (!p) return 'Inscrire le membre';
    return this.method() === 'PAYMENT_LINK' ? 'Inscrire et envoyer le lien' : `Inscrire et encaisser ${fcfa(this.firstAmount())}`;
  });

  readonly errorCount = computed(() => {
    this.values();
    this.submitted();
    return Object.values(this.form.controls).filter(c => c.invalid).length + (this.duplicate() ? 1 : 0);
  });

  private readonly firstInput = viewChild<ElementRef<HTMLInputElement>>('firstInput');

  constructor() {
    afterNextRender(() => this.firstInput()?.nativeElement.focus());

    // Détection des doublons pendant la saisie : dès 8 chiffres, on cherche le numéro
    this.form.controls.phone.valueChanges
      .pipe(
        map(v => v.replace(/\D/g, '')),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(d => (d.length >= 8 ? this.api.searchMembers(d.slice(-8), 3) : of([]))),
        takeUntilDestroyed(),
      )
      .subscribe(list => {
        const own = this.member()?.id;
        this.duplicate.set(list.find(m => m.id !== own) ?? null);
      });
  }

  ngOnInit(): void {
    const m = this.member();
    const pre = this.prefill();
    if (m) {
      this.form.patchValue({ phone: m.phone ?? '', firstName: m.firstName, lastName: m.lastName, email: m.email ?? '', notes: m.notes ?? '', coachId: m.coachId ?? 0 });
      // La liste ne porte pas les droits détaillés : on recharge le membre
      this.members.get(m.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: full => {
          this.current.set(full);
          this.accessMode.set(full.customAccess ? 'custom' : 'plan');
          this.customIds.set(full.activityIds ?? []);
        },
        error: () => this.current.set(m),
      });
    } else if (pre) {
      this.form.patchValue({ phone: pre.phone ?? '', firstName: pre.firstName ?? '', lastName: pre.lastName ?? '' });
    }
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      this.settings.set(s);
      const first = this.methods().find(x => x.enabled);
      if (first) this.method.set(first.id);
    });
    this.api.activities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.activities.set(list),
      error: () => {},
    });
    this.api.coaches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.coaches.set(list.filter(c => c.active || c.id === m?.coachId)),
      error: () => {},
    });
    if (!m) {
      this.api.plans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(plans => {
        this.plans.set(plans);
        const wanted = plans.find(p => p.name === pre?.planName) ?? plans.find(p => p.durationDays === 30);
        this.form.controls.planId.setValue(wanted?.id ?? 0);
      });
    }
  }

  error(name: 'phone' | 'firstName' | 'lastName' | 'email' | 'notes'): string | null {
    const control = this.form.controls[name];
    if (name === 'phone' && this.duplicate()) {
      const d = this.duplicate()!;
      return `Ce numéro appartient déjà à ${d.firstName} ${d.lastName} (${d.memberNumber}).`;
    }
    if (!control.errors || !(control.touched || this.submitted())) return null;
    const key = Object.keys(control.errors)[0];
    return MESSAGES[name]?.[key] || 'Valeur invalide.';
  }

  // ---- Activités ----

  setAccessMode(mode: 'plan' | 'custom'): void {
    this.accessMode.set(mode);
    // Passage en « une par une » : on part des droits de la formule
    if (mode === 'custom' && !this.customIds().length) {
      const names = this.planRights() ?? [];
      this.customIds.set(this.activities().filter(a => names.includes(a.name)).map(a => a.id));
    }
  }

  toggleActivity(id: number, on: boolean): void {
    this.customIds.update(ids => (on ? [...new Set([...ids, id])] : ids.filter(x => x !== id)));
  }

  // ---- Photo ----

  async pickPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoError.set(null);
    try {
      const blob = await shrinkImage(file);
      this.clearPreview();
      this.photo.set(blob);
      this.photoPreview.set(URL.createObjectURL(blob));
      this.removePhoto.set(false);
    } catch {
      this.photoError.set('Cette image ne peut pas être lue. Essayez une photo JPEG ou PNG.');
    }
  }

  dropPhoto(): void {
    this.clearPreview();
    this.photo.set(null);
    this.removePhoto.set(!!this.member()?.hasPhoto);
  }

  private clearPreview(): void {
    const url = this.photoPreview();
    if (url) URL.revokeObjectURL(url);
    this.photoPreview.set(null);
  }

  save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicate()) return;
    if (this.accessMode() === 'custom' && !this.customIds().length) {
      this.serverError.set('Cochez au moins une activité, sinon son QR code sera refusé partout.');
      return;
    }

    const v = this.form.getRawValue();
    const payload: MemberPayload = {
      phone: v.phone.trim(),
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim() || null,
      notes: v.notes.trim() || null,
      coachId: +v.coachId || null,
      customAccess: this.accessMode() === 'custom',
      activityIds: this.accessMode() === 'custom' ? this.customIds() : [],
    };
    const existing = this.member();
    if (!existing) {
      // Le commercial inscrit sans formule : l'encaissement se fait à l'accueil
      const p = this.store.isDesk() ? this.plan() : null;
      payload.planId = p?.id ?? null;
      payload.paymentMethod = p ? this.method() : null;
      payload.planStartDate = p ? v.startDate || this.today : null;
      payload.prospectId = this.prefill()?.prospectId ?? null;
    }

    this.saving.set(true);
    this.serverError.set(null);
    const request = existing ? this.members.update(existing.id, payload) : this.members.create(payload);
    request
      .pipe(
        // Puis la photo : envoyée (ou retirée) une fois le membre enregistré
        switchMap(member => {
          const blob = this.photo();
          if (blob) return this.members.savePhoto(member.id, blob).pipe(map(() => ({ ...member, hasPhoto: true })));
          if (this.removePhoto()) return this.members.deletePhoto(member.id).pipe(map(() => ({ ...member, hasPhoto: false })));
          return of(member);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
      next: member => {
        this.saving.set(false);
        this.clearPreview();
        if (existing) this.saved.emit({ member, created: false });
        else this.done.set(member);
      },
      error: err => {
        this.saving.set(false);
        this.serverError.set(apiError(err, 'L’enregistrement a échoué. Réessayez.'));
      },
    });
  }

  /** Message WhatsApp de bienvenue avec le reçu */
  welcomeLink(m: MemberDto): string {
    const gym = this.settings()?.name ?? 'la salle';
    const p = m.payment;
    let text = `Bienvenue ${m.firstName} à ${gym} ! Votre numéro de membre : ${m.memberNumber}.`;
    if (p?.status === 'PAID') text += `\nReçu ${p.receiptNumber} : ${p.planName}, ${fcfa(p.amount)} (${METHOD_LABELS[p.method]}), valable jusqu’au ${frDate(p.validTo)}.`;
    if (p?.status === 'PENDING' && p.paymentUrl) text += `\nPour payer votre abonnement ${p.planName} (${fcfa(p.amount)}) : ${p.paymentUrl}`;
    return whatsappLink(m.phone, text);
  }

  finish(): void {
    const m = this.done();
    if (m) this.saved.emit({ member: m, created: true });
  }

  /** Après l'inscription : pointer tout de suite l'entrée du membre à l'accueil */
  checkInNow(): void {
    const m = this.done();
    if (!m) return;
    this.finish();
    this.router.navigate(['/access'], { queryParams: { member: m.id } });
  }

  close(): void {
    if (this.done()) this.finish();
    else this.closed.emit();
  }

  confirmDelete(): void {
    const m = this.member();
    if (!m) return;
    this.deleting.set(true);
    this.members
      .delete(m.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmingDelete.set(false);
          this.deleted.emit(m);
        },
        error: err => {
          this.deleting.set(false);
          this.confirmingDelete.set(false);
          this.serverError.set(apiError(err, 'L’archivage a échoué.'));
        },
      });
  }
}
