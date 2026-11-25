import { Component, computed, DestroyRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MemberLite, Payment } from '@core/api/api.models';
import { MemberDto, MemberOverview, MembersService } from '@core/api/members.service';
import { MovexaApi } from '@core/api/movexa-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { ToastService } from '@core/notifications/toast.service';
import { CancelPayment } from '@shared/cancel-payment/cancel-payment';
import {
  addDays,
  apiError,
  dayHour,
  fcfa,
  frDate,
  initials,
  isoDate,
  METHOD_LABELS,
  RULE_LABELS,
  STATE_TONES,
  stateText,
  whatsappLink,
} from '@shared/format';
import { PayDialog } from '@shared/pay-dialog/pay-dialog';
import { QrCode } from '@shared/qr-code/qr-code';
import { MemberForm } from '@shared/member-form/member-form';
import { MemberPhoto } from '@shared/member-photo/member-photo';

type Tab = 'pay' | 'visits' | 'reminders';

/**
 * Fiche membre : en un coup d'œil le statut, la date de fin, les paiements, les visites
 * et les rappels envoyés. Point de départ du renouvellement et de l'envoi du QR code.
 */
@Component({
  selector: 'app-member-detail',
  imports: [RouterLink, FormsModule, PayDialog, QrCode, MemberForm, CancelPayment, MemberPhoto],
  templateUrl: './member-detail.html',
  styleUrl: './member-detail.css',
})
export class MemberDetail implements OnInit {
  private readonly members = inject(MembersService);
  private readonly api = inject(MovexaApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CurrentUserStore);

  /** Paramètre de route :id (withComponentInputBinding n'est pas activé : lu à la main) */
  readonly id = input<string>();

  readonly data = signal<MemberOverview | null>(null);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('pay');
  readonly paying = signal(false);
  readonly editing = signal(false);
  readonly cancelling = signal<Payment | null>(null);
  readonly gymName = signal('la salle');
  /** Recharge la photo après une modification */
  readonly photoVersion = signal(0);

  // ---- Gel de l'abonnement ----
  readonly freezing = signal(false);
  readonly freezeDays = signal<number | null>(14);
  readonly freezeReason = signal('');
  readonly freezeError = signal<string | null>(null);
  readonly freezeSaving = signal(false);

  readonly fcfa = fcfa;
  readonly frDate = frDate;
  readonly dayHour = dayHour;
  readonly methodLabels = METHOD_LABELS;
  readonly ruleLabels = RULE_LABELS;
  readonly tones = STATE_TONES;
  readonly initials = initials;

  private readonly qr = viewChild(QrCode);

  readonly member = computed(() => this.data()?.member ?? null);
  readonly lite = computed<MemberLite | null>(() => {
    const m = this.member();
    return m
      ? { id: m.id, memberNumber: m.memberNumber, firstName: m.firstName, lastName: m.lastName, phone: m.phone, planName: m.plan, endDate: m.expiryDate, state: m.state, daysLeft: m.daysLeft, qrToken: m.qrToken }
      : null;
  });
  /** « inscrit » ou « inscrite » selon le genre renseigné */
  readonly joinedWord = computed(() => (this.member()?.gender === 'FEMALE' ? 'inscrite' : 'inscrit'));

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'pay', label: 'Paiements' },
    { id: 'visits', label: 'Visites' },
    { id: 'reminders', label: 'Rappels envoyés' },
  ];

  readonly statusText = computed(() => {
    const m = this.member();
    return m ? stateText(m.state, m.expiryDate, m.daysLeft) : '';
  });

  /** Période en cours : progression entre le début et la fin */
  readonly period = computed(() => {
    const d = this.data();
    const current = d?.subscriptions.find(s => !s.cancelled && s.endDate === d.member.expiryDate);
    if (!current) return null;
    const total = Math.max(1, (Date.parse(current.endDate) - Date.parse(current.startDate)) / 86_400_000);
    const left = d!.member.daysLeft ?? 0;
    const pct = Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100)));
    const remaining = left < 0 ? `Expiré depuis ${-left} jour${left < -1 ? 's' : ''}` : left === 0 ? 'Dernier jour' : `${left} jour${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`;
    return { ...current, pct, remaining };
  });

  /** « surtout le soir, entre 17 h et 19 h » : le créneau de 2 heures le plus fréquent */
  readonly usualSlot = computed(() => {
    const hours = this.data()?.visitHours ?? [];
    if (hours.length < 3) return null;
    const count = new Array(24).fill(0) as number[];
    hours.forEach(h => count[h]++);
    let best = 0;
    for (let h = 1; h < 23; h++) if (count[h] + count[h + 1] > count[best] + count[best + 1]) best = h;
    const share = (count[best] + count[best + 1]) / hours.length;
    if (share < 0.4) return 'à des heures variées';
    const moment = best < 12 ? 'le matin' : best < 17 ? 'l’après-midi' : 'le soir';
    return `surtout ${moment}, entre ${best} h et ${best + 2} h`;
  });

  /** Les 30 derniers jours, du plus ancien au plus récent : venu ou absent */
  readonly visitGrid = computed(() => {
    const days = new Set(this.data()?.visitDays ?? []);
    const today = isoDate(new Date());
    return Array.from({ length: 30 }, (_, i) => {
      const day = addDays(today, i - 29);
      return { day, came: days.has(day), label: `${frDate(day)} : ${days.has(day) ? 'venu' : 'absent'}` };
    });
  });

  ngOnInit(): void {
    this.load();
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => this.gymName.set(s.name ?? 'la salle'));
  }

  load(): void {
    const id = Number(this.id());
    this.members
      .overview(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: d => this.data.set(d),
        error: () => this.error.set('Membre introuvable ou serveur indisponible.'),
      });
  }

  paymentDetail(p: Payment): string {
    const parts = [dayHour(p.createdAt), METHOD_LABELS[p.method].toLowerCase()];
    if (p.createdBy) parts.push(`saisi par ${p.createdBy}`);
    if (p.reference) parts.push(`réf. ${p.reference}`);
    if (p.status === 'CANCELLED') parts.push(`annulé par ${p.cancelledBy} : ${p.cancelReason}`);
    return parts.join(' · ');
  }

  /** Rappel WhatsApp manuel depuis la fiche */
  reminderLink(m: MemberDto): string {
    const when = m.state === 'EXPIRED' ? `a pris fin le ${frDate(m.expiryDate)}` : `se termine le ${frDate(m.expiryDate)}`;
    return whatsappLink(m.phone, `Bonjour ${m.firstName}, votre abonnement ${m.plan ?? ''} à ${this.gymName()} ${when}. Pensez à le renouveler à l’accueil ou par MoMo. À bientôt !`);
  }

  /** Envoi du QR code : le texte part par WhatsApp, l'image est enregistrée pour la joindre */
  qrLink(m: MemberDto): string {
    return whatsappLink(m.phone, `Bonjour ${m.firstName}, voici votre carte de membre ${this.gymName()} (N° ${m.memberNumber}). Présentez ce QR code à l’accueil à chaque visite : ${window.location.origin}/carte/${m.qrToken}`);
  }

  downloadQr(m: MemberDto): void {
    const png = this.qr()?.toPng();
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `qr-${m.memberNumber}.png`;
    a.click();
  }

  onPaid(p: Payment): void {
    this.paying.set(false);
    this.toast.success(p.status === 'PENDING' ? 'Lien de paiement créé.' : `${p.planName} encaissé, reçu ${p.receiptNumber}.`);
    this.tab.set('pay');
    this.load();
  }

  onCancelled(p: Payment): void {
    this.cancelling.set(null);
    this.toast.success(`Paiement annulé : ${p.cancelReason}`);
    this.load();
  }

  onSaved(): void {
    this.editing.set(false);
    this.photoVersion.update(v => v + 1);
    this.toast.success('Modifications enregistrées.');
    this.load();
  }

  openFreeze(): void {
    this.freezeDays.set(Math.min(14, this.data()?.freezeDaysLeft ?? 14));
    this.freezeReason.set('');
    this.freezeError.set(null);
    this.freezing.set(true);
  }

  /** Nouvelle fin si on gèle « freezeDays » jours */
  readonly freezeEnd = computed(() => {
    const m = this.member();
    const days = this.freezeDays() ?? 0;
    return m?.expiryDate && days > 0 ? addDays(m.expiryDate, days) : null;
  });

  saveFreeze(): void {
    const m = this.member();
    const days = Number(this.freezeDays());
    const max = this.data()?.freezeDaysLeft ?? 0;
    if (!m || this.freezeSaving()) return;
    if (!Number.isInteger(days) || days < 1 || days > max) {
      this.freezeError.set(`Indiquez un nombre de jours entre 1 et ${max}.`);
      return;
    }
    this.freezeSaving.set(true);
    this.members
      .freeze(m.id, days, this.freezeReason().trim() || null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.freezeSaving.set(false);
          this.freezing.set(false);
          this.toast.success(`Abonnement gelé ${days} jour${days > 1 ? 's' : ''} : nouvelle fin le ${frDate(updated.expiryDate)}.`);
          this.load();
        },
        error: err => {
          this.freezeSaving.set(false);
          this.freezeError.set(apiError(err, 'Gel impossible.'));
        },
      });
  }
}
