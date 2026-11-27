import { Component, computed, DestroyRef, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Activity, CheckIn, CheckInMethod, CheckInResult, MemberLite, Payment, SubscriptionState } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { OfflineService } from '@core/offline/offline.service';
import { ToastService } from '@core/notifications/toast.service';
import { apiError, clientId, fcfa, frDate, hour, longToday, STATE_TONES, todayIso } from '@shared/format';
import { PayDialog } from '@shared/pay-dialog/pay-dialog';
import { MemberPhoto } from '@shared/member-photo/member-photo';

/** Une ligne du journal du jour (venue du serveur ou en attente de synchronisation) */
interface JournalRow {
  key: string;
  /** Instant ISO du passage */
  at: string;
  time: string;
  memberId: number | null;
  name: string;
  method: CheckInMethod;
  result: CheckInResult;
  /** Activité pointée (null si non précisée) */
  activity: string | null;
  pending: boolean;
}

/** Ce qu'affiche le grand bloc de réponse */
interface Answer {
  result: CheckInResult;
  member: MemberLite;
  /** Activités incluses dans la formule (« Droits de la formule ») */
  rights?: string[];
  text: string;
  pending: boolean;
}

type JournalFilter = 'all' | 'allowed' | 'refused';

const RESULT_LABELS: Record<CheckInResult, string> = {
  ALLOWED: 'Autorisé',
  ALLOWED_EXPIRING: 'Autorisé, expire bientôt',
  REFUSED: 'Refusé',
  REFUSED_ACTIVITY: 'Refusé, activité non incluse',
};

/** Le membre n'est pas entré (abonnement expiré, absent, ou activité non incluse) */
function isRefused(r: CheckInResult): boolean {
  return r === 'REFUSED' || r === 'REFUSED_ACTIVITY';
}

/** Activité choisie au poste d'accueil, gardée d'une visite à l'autre sur cet appareil */
const ACTIVITY_KEY = 'flexclubmanagement.access.activity';

/** Icônes du bloc de réponse (trait, grille de 24) */
const ICONS = {
  ok: 'M20 6L9 17l-5-5',
  soon: 'M12 8v5M12 16.5v.5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  ko: 'M6 6l12 12M18 6L6 18',
  wait: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',
  idle: 'M3 8V4h5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 12h8',
};

/** Plage horaire minimale du graphique « Passages par heure » */
const FIRST_HOUR = 6;
const LAST_HOUR = 21;

/**
 * Contrôle d'accès et présence (maquette « Flex Club · E2 ») : scanner le QR code avec la caméra,
 * une douchette, ou chercher par nom / téléphone. Réponse immédiate vert / orange / rouge,
 * encaissement direct, passages par heure et journal du jour.
 * Fonctionne hors ligne grâce à la copie locale des membres (OfflineService).
 */
@Component({
  selector: 'app-access',
  imports: [FormsModule, RouterLink, PayDialog, MemberPhoto],
  templateUrl: './access.html',
  styleUrl: './access.css',
})
export class Access implements OnInit, OnDestroy {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly offline = inject(OfflineService);

  readonly tones = STATE_TONES;
  readonly resultLabels = RESULT_LABELS;
  readonly today = longToday();
  readonly fcfa = fcfa;

  readonly mode = signal<'scan' | 'search'>('scan');
  readonly query = signal('');
  readonly matches = signal<MemberLite[]>([]);
  readonly scanInput = signal('');
  readonly answer = signal<Answer | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly journal = signal<JournalRow[]>([]);
  readonly paying = signal<MemberLite | null>(null);
  readonly waitingLink = signal<Payment | null>(null);
  readonly paymentsToday = signal<number | null>(null);
  readonly filter = signal<JournalFilter>('all');
  readonly isRefused = isRefused;

  // ---- Activité vérifiée au pointage ----
  readonly activities = signal<Activity[]>([]);
  /** null = pointer sans vérifier l'activité */
  readonly activityId = signal<number | null>(null);

  // ---- Caméra ----
  readonly cameraOn = signal(false);
  readonly cameraError = signal<string | null>(null);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastToken = '';
  private lastTokenAt = 0;
  private threshold = 7;

  /** Capacité de la salle (Paramètres › Ma salle), pour « Dans la salle maintenant » */
  readonly capacity = signal<number | null>(null);
  /** Heure courante, rafraîchie chaque minute (estimation « dans la salle ») */
  private readonly now = signal(Date.now());
  private clock: ReturnType<typeof setInterval> | null = null;
  /** Suivi d'un lien de paiement en attente : vérifié toutes les 5 secondes */
  private linkPoll: ReturnType<typeof setInterval> | null = null;

  readonly rows = computed<JournalRow[]>(() => {
    const pending = this.offline.pending().map(p => ({
      key: p.clientId,
      at: p.checkedAt,
      time: hour(p.checkedAt),
      memberId: p.memberId ?? null,
      name: p.memberName,
      method: p.method,
      result: 'ALLOWED' as CheckInResult,
      activity: null,
      pending: true,
    }));
    return [...pending.reverse(), ...this.journal()];
  });

  readonly filters: { id: JournalFilter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'allowed', label: 'Autorisés' },
    { id: 'refused', label: 'Refusés' },
  ];

  readonly filteredRows = computed(() => {
    const f = this.filter();
    if (f === 'all') return this.rows();
    return this.rows().filter(r => (f === 'refused') === isRefused(r.result));
  });

  readonly entries = computed(() => this.rows().filter(r => !isRefused(r.result)).length);
  readonly refused = computed(() => this.rows().filter(r => isRefused(r.result)).length);
  readonly expiring = computed(() => this.rows().filter(r => r.result === 'ALLOWED_EXPIRING').length);

  /**
   * Personnes probablement dans la salle : entrées des 90 dernières minutes (durée habituelle d'une séance).
   * Estimation, faute de pointage à la sortie.
   */
  readonly inside = computed(() => {
    const since = this.now() - 90 * 60_000;
    return this.rows().filter(r => !isRefused(r.result) && Date.parse(r.at) >= since).length;
  });

  readonly kpis = computed(() => [
    { label: 'Entrées aujourd’hui', value: String(this.entries()), hint: 'membres autorisés depuis minuit' },
    {
      label: 'Dans la salle maintenant',
      value: this.capacity() ? `${this.inside()} / ${this.capacity()}` : String(this.inside()),
      hint: this.capacity()
        ? `occupation ${Math.round((100 * this.inside()) / this.capacity()!)} % · entrés depuis 1 h 30`
        : 'entrés depuis 1 h 30 (estimation)',
    },
    { label: 'Expirent bientôt', value: String(this.expiring()), hint: 'entrés, à qui proposer le renouvellement' },
    { label: 'Entrées refusées', value: String(this.refused()), hint: 'expiré, sans abonnement ou activité non incluse' },
    {
      label: 'Paiements aujourd’hui',
      value: this.paymentsToday() === null ? '–' : String(this.paymentsToday()),
      hint: 'encaissés à l’accueil ou en ligne',
    },
  ]);

  /** Passages autorisés par heure, de 6 h à la dernière heure utile */
  readonly hours = computed(() => {
    const counts = new Map<number, number>();
    for (const r of this.rows()) {
      if (isRefused(r.result)) continue;
      const h = new Date(r.at).getHours();
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const now = new Date().getHours();
    const seen = [...counts.keys()];
    const first = Math.min(FIRST_HOUR, ...seen);
    const last = Math.max(Math.min(LAST_HOUR, Math.max(now, FIRST_HOUR + 12)), ...seen);
    const max = Math.max(1, ...counts.values());
    const bars = [];
    for (let h = first; h <= last; h++) {
      const v = counts.get(h) ?? 0;
      bars.push({ h, label: `${h}h`, v, pct: Math.round((v / max) * 78), current: h === now, tip: `${h} h : ${v} ${v > 1 ? 'entrées' : 'entrée'}` });
    }
    return bars;
  });

  readonly peak = computed(() => {
    const bars = this.hours();
    const best = bars.reduce((a, b) => (b.v > a.v ? b : a), bars[0]);
    return best && best.v > 0 ? best : null;
  });

  readonly chartLabel = computed(() => {
    const p = this.peak();
    return p ? `Entrées par heure aujourd’hui : pic de ${p.v} entrées à ${p.h} h` : 'Aucune entrée aujourd’hui pour l’instant';
  });

  /** Bloc de réponse : couleur, icône, titre */
  readonly answerView = computed(() => {
    if (this.error()) return { tone: 'ko', icon: ICONS.ko, title: 'Pointage impossible' };
    if (this.waitingLink()) return { tone: 'wait', icon: ICONS.wait, title: 'Paiement en attente' };
    const a = this.answer();
    if (!a) return { tone: 'idle', icon: ICONS.idle, title: this.busy() ? 'Vérification…' : 'En attente d’un membre' };
    if (a.result === 'ALLOWED') return { tone: 'ok', icon: ICONS.ok, title: 'Accès autorisé' };
    if (a.result === 'ALLOWED_EXPIRING') return { tone: 'soon', icon: ICONS.soon, title: 'Accès autorisé, expire bientôt' };
    if (a.result === 'REFUSED_ACTIVITY') return { tone: 'ko', icon: ICONS.ko, title: 'Refusé, activité non incluse' };
    return { tone: 'ko', icon: ICONS.ko, title: 'Accès refusé' };
  });

  constructor() {
    // Recherche : sur le serveur en ligne, dans la copie locale hors ligne
    toObservable(this.query)
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap(q => {
          const text = q.trim();
          if (text.length < 2) return of([] as MemberLite[]);
          return this.offline.online() ? this.api.searchMembers(text, 6) : of(this.searchCache(text));
        }),
        takeUntilDestroyed(),
      )
      .subscribe(list => this.matches.set(list));

    // Retour du réseau : les pointages envoyés reviennent du serveur dans le journal
    effect(() => {
      if (this.offline.lastSynced() > 0) this.loadJournal();
    });
  }

  ngOnInit(): void {
    if (this.offline.online()) {
      this.offline.refreshCache();
      void this.offline.sync();
    }
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      this.threshold = s.expiringSoonDays;
      this.capacity.set(s.capacity ?? null);
    });
    this.clock = setInterval(() => this.now.set(Date.now()), 60_000);
    this.loadActivities();
    this.loadJournal();
    this.loadPayments();
    // Arrivée depuis une fiche ou une liste (« Pointer ») : /access?member=12
    const memberId = Number(this.route.snapshot.queryParamMap.get('member'));
    if (memberId) {
      this.mode.set('search');
      this.checkIn({ memberId }, 'SEARCH');
    }
  }

  /** Activités proposées au poste ; on reprend celle choisie la dernière fois sur cet appareil */
  private loadActivities(): void {
    this.api.activities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        const active = list.filter(a => a.active);
        this.activities.set(active);
        let saved: number | null = null;
        try {
          const raw = localStorage.getItem(ACTIVITY_KEY);
          saved = raw ? Number(raw) : null;
        } catch {
          /* stockage indisponible : on prend la première activité */
        }
        const keep = saved !== null && active.some(a => a.id === saved);
        this.activityId.set(keep ? saved : (active[0]?.id ?? null));
      },
      error: () => this.activities.set([]),
    });
  }

  pickActivity(id: number | null): void {
    this.activityId.set(id);
    try {
      localStorage.setItem(ACTIVITY_KEY, id === null ? '' : String(id));
    } catch {
      /* préférence locale seulement */
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.stopLinkPoll();
    if (this.clock) clearInterval(this.clock);
  }

  loadJournal(): void {
    this.api
      .checkInsToday()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => this.journal.set(list.map(c => this.toRow(c))),
        error: () => {
          /* hors ligne : on garde le journal affiché */
        },
      });
  }

  private loadPayments(): void {
    this.api
      .receptionToday()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: t => this.paymentsToday.set(t.paymentsToday), error: () => {} });
  }

  setMode(mode: 'scan' | 'search'): void {
    this.mode.set(mode);
    if (mode === 'search') this.stopCamera();
  }

  pick(m: MemberLite): void {
    this.query.set('');
    this.matches.set([]);
    this.checkIn({ memberId: m.id }, 'SEARCH', m);
  }

  /** Code saisi au clavier ou par une douchette USB / Bluetooth (qui « tape » le contenu du QR) */
  submitCode(): void {
    const token = this.scanInput().trim();
    if (!token) return;
    this.scanInput.set('');
    this.checkIn({ qrToken: token }, 'QR');
  }

  /**
   * Pointe un membre. En ligne : le serveur décide et enregistre.
   * Hors ligne : décision locale avec la copie des membres, et mise en file d'attente.
   */
  checkIn(target: { memberId?: number; qrToken?: string }, method: CheckInMethod, known?: MemberLite): void {
    this.error.set(null);
    this.waitingLink.set(null);
    if (!this.offline.online()) {
      this.checkInOffline(target, method, known);
      return;
    }
    this.busy.set(true);
    this.api
      .checkIn({ ...target, method, clientId: clientId(), activityId: this.activityId() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => {
          this.busy.set(false);
          this.answer.set({
            result: c.result,
            member: this.liteFrom(c),
            rights: c.includedActivities,
            text: this.answerText(c.result, c.memberName, c.endDate, c.activityName),
            pending: false,
          });
          this.journal.update(list => [this.toRow(c), ...list]);
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          if (err.status === 0) {
            this.offline.online.set(false);
            this.checkInOffline(target, method, known);
          } else {
            this.answer.set(null);
            this.error.set(apiError(err, 'Pointage impossible.'));
          }
        },
      });
  }

  /** Encaisser depuis l'écran orange ou rouge */
  /**
   * Lien de paiement envoyé : on interroge le serveur toutes les 5 secondes.
   * Dès que l'agrégateur confirme, l'écran passe au vert et l'entrée est pointée. Abandon après 15 minutes.
   */
  private startLinkPoll(p: Payment): void {
    this.stopLinkPoll();
    const started = Date.now();
    this.linkPoll = setInterval(() => {
      if (Date.now() - started > 15 * 60_000 || this.waitingLink()?.id !== p.id) {
        this.stopLinkPoll();
        return;
      }
      this.api.paymentLinks().subscribe({
        next: links => {
          const now = links.find(l => l.id === p.id);
          if (!now || now.status === 'PENDING') return;
          this.stopLinkPoll();
          this.waitingLink.set(null);
          if (now.status === 'PAID') {
            this.toast.success(`Paiement confirmé par l’agrégateur, reçu ${now.receiptNumber}.`);
            this.paymentsToday.update(n => (n ?? 0) + 1);
            this.checkIn({ memberId: now.memberId }, 'SEARCH');
          } else {
            this.error.set('Le lien de paiement a été annulé.');
          }
        },
        error: () => {},
      });
    }, 5000);
  }

  private stopLinkPoll(): void {
    if (this.linkPoll) clearInterval(this.linkPoll);
    this.linkPoll = null;
  }

  openPay(): void {
    const a = this.answer();
    if (a) this.paying.set(a.member);
  }

  /** Après paiement : l'écran passe au vert et l'entrée est enregistrée */
  onPaid(p: Payment): void {
    this.paying.set(null);
    if (p.status === 'PENDING') {
      this.waitingLink.set(p);
      this.startLinkPoll(p);
      return;
    }
    this.toast.success(`Paiement enregistré, reçu ${p.receiptNumber}.`);
    this.paymentsToday.update(n => (n ?? 0) + 1);
    this.checkIn({ memberId: p.memberId }, 'SEARCH');
  }

  // ---- Caméra (jsQR chargé à la demande pour ne pas alourdir le reste de l'application) ----

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Ce navigateur ne donne pas accès à la caméra (il faut une adresse en https ou localhost).');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.cameraOn.set(true);
      // Le <video> n'existe qu'une fois cameraOn passé à vrai
      setTimeout(() => {
        const video = this.video()?.nativeElement;
        if (!video || !this.stream) return;
        video.srcObject = this.stream;
        void video.play();
      });
      const { default: jsQR } = await import('jsqr');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.timer = setInterval(() => {
        const video = this.video()?.nativeElement;
        if (!video || !ctx || video.readyState < 2) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) this.onScanned(code.data);
      }, 250);
    } catch {
      this.cameraError.set('Caméra refusée ou indisponible. Autorise la caméra, ou cherche le membre par son nom.');
      this.stopCamera();
    }
  }

  stopCamera(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.cameraOn.set(false);
  }

  private onScanned(token: string): void {
    // Le même QR reste devant la caméra : on ne le pointe qu'une fois toutes les 5 secondes
    const now = Date.now();
    if (token === this.lastToken && now - this.lastTokenAt < 5000) return;
    this.lastToken = token;
    this.lastTokenAt = now;
    navigator.vibrate?.(80);
    this.checkIn({ qrToken: token }, 'QR');
  }

  // ---- Hors ligne ----

  private checkInOffline(target: { memberId?: number; qrToken?: string }, method: CheckInMethod, known?: MemberLite): void {
    const m = known ?? (target.qrToken ? this.offline.findCachedByQr(target.qrToken) : this.offline.cachedMembers().find(x => x.id === target.memberId));
    if (!m) {
      this.error.set('Hors ligne : membre absent de la copie locale. Cherche-le par son nom, ou attends le retour du réseau.');
      return;
    }
    const state = this.stateOf(m.endDate);
    const result: CheckInResult = state === 'ACTIVE' ? 'ALLOWED' : state === 'EXPIRING_SOON' ? 'ALLOWED_EXPIRING' : 'REFUSED';
    const name = `${m.firstName} ${m.lastName}`;
    if (result !== 'REFUSED') {
      this.offline.enqueue({ clientId: clientId(), memberId: m.id, method, checkedAt: new Date().toISOString(), memberName: name });
    }
    this.answer.set({ result, member: { ...m, state }, text: this.answerText(result, name, m.endDate), pending: result !== 'REFUSED' });
  }

  private stateOf(endDate: string | null): SubscriptionState {
    if (!endDate) return 'NONE';
    const today = todayIso();
    if (endDate < today) return 'EXPIRED';
    const days = (Date.parse(endDate) - Date.parse(today)) / 86_400_000;
    return days <= this.threshold ? 'EXPIRING_SOON' : 'ACTIVE';
  }

  private searchCache(text: string): MemberLite[] {
    const q = text.toLowerCase();
    const digits = q.replace(/\D/g, '');
    return this.offline
      .cachedMembers()
      .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || (digits.length >= 2 && (m.phone ?? '').replace(/\D/g, '').includes(digits)))
      .slice(0, 6);
  }

  private answerText(result: CheckInResult, name: string, endDate: string | null, activity: string | null = null): string {
    switch (result) {
      case 'REFUSED_ACTIVITY':
        return `${name} : « ${activity ?? 'cette activité'} » n’est pas inclus dans sa formule. Aucune entrée enregistrée.`;
      case 'ALLOWED':
        return `${name}, valide jusqu’au ${frDate(endDate)}. Entrée enregistrée à ${hour(new Date().toISOString())}.`;
      case 'ALLOWED_EXPIRING':
        return `${name}, fin le ${frDate(endDate)}. Entrée enregistrée. Propose le renouvellement.`;
      default:
        return endDate ? `${name}, abonnement expiré le ${frDate(endDate)}.` : `${name} n’a pas d’abonnement en cours.`;
    }
  }

  private liteFrom(c: CheckIn): MemberLite {
    const [firstName, ...rest] = c.memberName.split(' ');
    return {
      id: c.memberId,
      memberNumber: c.memberNumber,
      firstName,
      lastName: rest.join(' '),
      phone: c.memberPhone,
      planName: c.planName,
      endDate: c.endDate,
      state: c.state,
      daysLeft: c.daysLeft,
      qrToken: '',
      hasPhoto: c.memberHasPhoto,
    };
  }

  private toRow(c: CheckIn): JournalRow {
    return {
      key: String(c.id),
      at: c.checkedAt,
      time: hour(c.checkedAt),
      memberId: c.memberId,
      name: c.memberName,
      method: c.method,
      result: c.result,
      activity: c.activityName,
      pending: false,
    };
  }
}
