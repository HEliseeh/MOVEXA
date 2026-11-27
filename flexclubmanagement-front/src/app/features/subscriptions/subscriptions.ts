import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberLite, Payment, Plan } from '@core/api/api.models';
import { MemberDto, MembersService } from '@core/api/members.service';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { ToastService } from '@core/notifications/toast.service';
import { fcfa, frDate, STATE_LABELS, STATE_TONES, whatsappLink } from '@shared/format';
import { PayDialog } from '@shared/pay-dialog/pay-dialog';

type Tab = 'week' | 'expired' | 'all';

/**
 * Abonnements et échéances (module 2) : qui doit renouveler et qui a expiré.
 * Les formules et leurs prix sont gérés dans « Formules et tarifs » (page /plans).
 */
@Component({
  selector: 'app-subscriptions',
  imports: [FormsModule, RouterLink, PayDialog],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.css',
})
export class Subscriptions implements OnInit {
  private readonly members = inject(MembersService);
  private readonly api = inject(FlexclubmanagementApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CurrentUserStore);

  readonly fcfa = fcfa;
  readonly frDate = frDate;
  readonly stateLabels = STATE_LABELS;
  readonly tones = STATE_TONES;

  readonly tab = signal<Tab>('week');
  readonly query = signal('');
  readonly all = signal<MemberDto[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly threshold = signal(7);
  readonly paying = signal<MemberLite | null>(null);
  /** Paiement par lien activé (Paramètres) : bouton « Envoyer le lien » */
  readonly linkEnabled = signal(false);
  /** Moyen proposé à l'ouverture de l'encaissement */
  readonly payMethod = signal<'PAYMENT_LINK' | null>(null);
  private gymName = 'la salle';

  private readonly prices = computed(() => new Map(this.plans().map(p => [p.name, p.price])));

  readonly expiring = computed(() => this.all().filter(m => m.state === 'EXPIRING_SOON').sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')));
  readonly expired = computed(() => this.all().filter(m => m.state === 'EXPIRED').sort((a, b) => (b.expiryDate ?? '').localeCompare(a.expiryDate ?? '')));

  readonly rows = computed(() => {
    const base = this.tab() === 'week' ? this.expiring() : this.tab() === 'expired' ? this.expired() : this.all();
    const q = this.query().trim().toLowerCase();
    return q ? base.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) : base;
  });

  readonly toCollect = computed(() => this.rows().filter(m => m.state !== 'ACTIVE').reduce((t, m) => t + (this.priceOf(m) ?? 0), 0));

  ngOnInit(): void {
    // Onglet demandé dans l'adresse (?tab=expired)
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab) this.tab.set(tab);
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      this.threshold.set(s.expiringSoonDays);
      this.linkEnabled.set(!!s.paymentLinkBaseUrl);
      this.gymName = s.name ?? 'la salle';
    });
    this.load();
  }

  load(): void {
    this.members.list(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ members }) => this.all.set(members));
    this.api.plans(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => this.plans.set(p));
  }

  priceOf(m: MemberDto): number | null {
    return m.plan ? (this.prices().get(m.plan) ?? null) : null;
  }

  when(m: MemberDto): string {
    const d = m.daysLeft;
    if (d === null) return '';
    if (m.state === 'EXPIRED') return `depuis ${-d} jour${d < -1 ? 's' : ''}`;
    if (m.state === 'EXPIRING_SOON') return d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} jours`;
    return '';
  }

  /** Lien de paiement envoyé au membre (il paie depuis son téléphone) */
  sendLink(m: MemberDto): void {
    this.renew(m);
    this.payMethod.set('PAYMENT_LINK');
  }

  renew(m: MemberDto): void {
    this.payMethod.set(null);
    this.paying.set({ id: m.id, memberNumber: m.memberNumber, firstName: m.firstName, lastName: m.lastName, phone: m.phone, planName: m.plan, endDate: m.expiryDate, state: m.state, daysLeft: m.daysLeft, qrToken: m.qrToken });
  }

  reminder(m: MemberDto): string {
    const verb = m.state === 'EXPIRED' ? `a pris fin le ${frDate(m.expiryDate)}` : `se termine le ${frDate(m.expiryDate)}`;
    const price = this.priceOf(m);
    return whatsappLink(m.phone, `Bonjour ${m.firstName}, votre abonnement ${m.plan ?? ''} à ${this.gymName} ${verb}.${price ? ` Renouvellement : ${fcfa(price)}.` : ''} À bientôt !`);
  }

  onPaid(p: Payment): void {
    this.paying.set(null);
    this.toast.success(p.status === 'PENDING' ? 'Lien de paiement créé.' : `${p.memberName} : abonnement prolongé jusqu’au ${frDate(p.validTo)}.`);
    this.load();
  }
}
