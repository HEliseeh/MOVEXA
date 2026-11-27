import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Course, CourseSession, Dashboard as DashboardData, DueMember } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { Fab, FabAction } from '@shared/fab/fab';
import { apiError, fcfa, initials, isoDate, shortDate, whatsappLink } from '@shared/format';

interface Goal {
  n: string;
  label: string;
  detail: string;
  /** Avancement 0–100, ou null quand il n'y a pas d'objectif chiffré */
  pct: number | null;
  tone: 'lavender' | 'peach' | 'lime';
  icon: string;
}

interface CalendarDay {
  n: number;
  iso: string;
  out: boolean;
  today: boolean;
}

const PASTELS = ['peach', 'lavender', 'lime'] as const;

/** « 2,94 M », « 450 k » */
function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1_000) return Math.round(n / 1_000) + ' k';
  return String(n);
}
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Taille du mini-graphique d'entrées (viewBox) */
const SPARK_W = 160;
const SPARK_H = 70;

/**
 * Tableau de bord du gérant (maquette « Flex Club · E2 ») : bandeau « Ma salle aujourd'hui »
 * avec trois cartes d'objectif, statistiques, membres à renouveler, calendrier.
 * Réservé au gérant (contrôlé aussi par le backend).
 */
@Component({
  selector: 'app-dashboard',
  imports: [Fab, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly router = inject(Router);
  private readonly store = inject(CurrentUserStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly weekdays = WEEKDAYS;

  readonly today = signal<DashboardData | null>(null);
  readonly month = signal<DashboardData | null>(null);
  readonly error = signal<string | null>(null);
  /** Nombre de jours de l'alerte « expire bientôt » (Paramètres) */
  readonly expiringDays = signal(7);
  private gymName = 'la salle';

  /** Ligne dont le menu « ··· » est ouvert */
  readonly openMenu = signal<number | null>(null);
  readonly sent = signal<ReadonlySet<number>>(new Set());

  readonly firstName = computed(() => this.store.user()?.firstName || this.store.user()?.login || '');

  // ---------- Bandeau ----------

  /** Entrées du jour = dernier point de la fréquentation (aujourd'hui) */
  readonly entriesToday = computed(() => this.today()?.attendance.at(-1)?.count ?? 0);
  readonly paymentsToday = computed(() => this.today()?.paymentsCount ?? 0);

  readonly headline = computed(() => {
    const e = this.entriesToday();
    const p = this.paymentsToday();
    return `${e} ${e > 1 ? 'entrées' : 'entrée'} et ${p} ${p > 1 ? 'abonnements payés' : 'abonnement payé'} aujourd'hui.`;
  });

  /** Objectifs du mois : renouvellements, encaissement et nouveaux membres (objectifs fixés dans Paramètres) */
  readonly goals = computed<Goal[]>(() => {
    const m = this.month();
    if (!m) return [];
    const pct = (a: number, b: number) => Math.min(100, Math.round((100 * a) / b));
    const renewPct = m.renewalsDue ? pct(m.renewalsDone, m.renewalsDue) : null;
    const revPct = m.revenueGoal ? pct(m.totalPaid, m.revenueGoal) : null;
    const newPct = m.newMembersGoal ? pct(m.newMembers, m.newMembersGoal) : null;
    return [
      {
        n: '01',
        label: 'Renouvellements du mois',
        detail: m.renewalsDue ? `${m.renewalsDone} sur ${m.renewalsDue} échéances | ${renewPct} %` : 'Aucune échéance passée ce mois-ci',
        pct: renewPct,
        tone: 'lavender',
        icon: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
      },
      {
        n: '02',
        label: m.revenueGoal ? 'Objectif de revenus' : 'Encaissé ce mois-ci',
        detail: m.revenueGoal
          ? `${compact(m.totalPaid)} sur ${compact(m.revenueGoal)} FCFA | ${revPct} %`
          : `${fcfa(m.totalPaid)} · objectif à fixer dans Paramètres`,
        pct: revPct,
        tone: 'peach',
        icon: 'M2 7h20v12H2zM2 11h20M6 15h4',
      },
      {
        n: '03',
        label: 'Nouveaux membres',
        detail: m.newMembersGoal
          ? `${m.newMembers} sur ${m.newMembersGoal} visés | ${newPct} %`
          : `${m.newMembers} ${m.newMembers > 1 ? 'inscrits' : 'inscrit'} ce mois-ci`,
        pct: newPct,
        tone: 'lime',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6',
      },
    ];
  });

  // ---------- Statistiques ----------

  /** 7 derniers jours de fréquentation (le backend en renvoie 14) */
  private readonly week = computed(() => (this.month()?.attendance ?? []).slice(-7));

  readonly averageEntries = computed(() => {
    const w = this.week();
    return w.length ? Math.round(w.reduce((s, d) => s + d.count, 0) / w.length) : 0;
  });

  readonly spark = computed(() => {
    const w = this.week();
    if (w.length < 2) return null;
    const max = Math.max(10, ...w.map(d => d.count));
    const xs = w.map((_, i) => 4 + (i * (SPARK_W - 8)) / (w.length - 1));
    const ys = w.map(d => SPARK_H - 6 - (d.count / max) * (SPARK_H - 12));
    let line = `M${xs[0]},${ys[0]}`;
    for (let i = 1; i < w.length; i++) {
      const cx = (xs[i - 1] + xs[i]) / 2;
      line += ` C${cx},${ys[i - 1]} ${cx},${ys[i]} ${xs[i]},${ys[i]}`;
    }
    const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' });
    const counts = w.map(d => d.count);
    const lo = w[counts.indexOf(Math.min(...counts))];
    const hi = w[counts.indexOf(Math.max(...counts))];
    return {
      line,
      area: `${line} L${xs.at(-1)},${SPARK_H} L${xs[0]},${SPARK_H} Z`,
      aria: `Entrées des 7 derniers jours : de ${lo.count} ${day(lo.day)} à ${hi.count} ${day(hi.day)}`,
    };
  });

  readonly expiringLabel = computed(() =>
    this.expiringDays() === 7 ? 'Expirent cette semaine' : `Expirent sous ${this.expiringDays()} jours`,
  );

  // ---------- À renouveler ----------

  readonly renew = computed(() =>
    (this.month()?.expiring ?? []).slice(0, 3).map((d, i) => ({
      due: d,
      id: d.member.id,
      name: `${d.member.firstName} ${d.member.lastName}`,
      ini: initials(d.member.firstName, d.member.lastName),
      plan: d.member.planName ?? 'Sans formule',
      date: this.expiryText(d),
      tone: PASTELS[i % PASTELS.length],
    })),
  );

  // ---------- Calendrier ----------

  /** Premier jour du mois affiché */
  readonly shownMonth = signal(this.firstOfMonth(new Date()));
  readonly selectedDay = signal(isoDate(new Date()));

  readonly monthLabel = computed(() => {
    const label = this.shownMonth().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly calendar = computed<CalendarDay[]>(() => {
    const first = this.shownMonth();
    const todayIso = isoDate(new Date());
    // Semaine du lundi au dimanche
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const days: CalendarDay[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = isoDate(d);
      days.push({ n: d.getDate(), iso, out: d.getMonth() !== first.getMonth(), today: iso === todayIso });
    }
    return days;
  });

  /** Cours proposés : un point sous les jours de la semaine où il y a au moins une séance */
  private readonly courses = signal<Course[]>([]);
  private readonly courseDays = computed(() => new Set(this.courses().filter(c => c.active).flatMap(c => c.slots.map(s => s.dayOfWeek))));
  /** Séances du jour choisi (planning du club) */
  readonly daySessions = signal<CourseSession[] | null>(null);

  hasCourses(day: CalendarDay): boolean {
    const dow = ((new Date(day.iso + 'T12:00:00').getDay() + 6) % 7) + 1;
    return !day.out && this.courseDays().has(dow);
  }

  readonly selectedLabel = computed(() =>
    new Date(this.selectedDay() + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  );

  readonly fabActions: FabAction[] = [
    { id: 'member', label: 'Nouveau membre', iconPath: 'M12 5v14M5 12h14' },
    { id: 'pay', label: 'Encaisser', iconPath: 'M2 7h20v12H2zM2 11h20M6 15h4' },
    { id: 'checkin', label: 'Pointer une entrée', iconPath: 'M3 8V4h5M16 3h5v5M21 16v5h-5M8 21H3v-5' },
    { id: 'reminders', label: 'Faire les relances', iconPath: 'M22 2L11 13M22 2l-7 20-4-9-9-4z' },
  ];

  ngOnInit(): void {
    this.load();
    this.api
      .courses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: c => this.courses.set(c), error: () => {} });
    this.loadSessions(this.selectedDay());
    this.api
      .settings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(s => {
        this.gymName = s.name ?? 'la salle';
        this.expiringDays.set(s.expiringSoonDays);
      });
  }

  load(): void {
    forkJoin({ day: this.api.dashboard('DAY'), month: this.api.dashboard('MONTH') })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ day, month }) => {
          this.today.set(day);
          this.month.set(month);
          this.error.set(null);
        },
        error: err => this.error.set(apiError(err, 'Impossible de charger le tableau de bord.')),
      });
  }

  changeMonth(delta: number): void {
    const m = this.shownMonth();
    this.shownMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  pickDay(day: CalendarDay): void {
    if (day.out) return;
    this.selectedDay.set(day.iso);
    this.loadSessions(day.iso);
  }

  private loadSessions(iso: string): void {
    this.daySessions.set(null);
    this.api
      .planning(iso)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: w => {
          if (this.selectedDay() !== iso) return;
          this.daySessions.set(w.sessions.filter(s => s.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime)));
        },
        error: () => this.daySessions.set([]),
      });
  }

  sessionText(s: CourseSession): string {
    const who = s.coachName ? ` avec ${s.coachName}` : '';
    const fill = s.present !== null ? `${s.present} présents sur ${s.capacity}` : `${s.capacity} places`;
    return `${s.courseName}${who} · ${fill}`;
  }

  dayAria(day: CalendarDay): string {
    const label = new Date(day.iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${day.out ? 'Hors mois, ' : ''}${label}${day.today ? ", aujourd'hui" : ''}${this.hasCourses(day) ? ', cours prévus' : ''}`;
  }

  toggleMenu(id: number): void {
    this.openMenu.update(current => (current === id ? null : id));
  }

  /** Relance WhatsApp immédiate depuis « À renouveler », enregistrée côté serveur */
  remind(d: DueMember): void {
    this.openMenu.set(null);
    const m = d.member;
    const when = m.daysLeft === 0 ? 'aujourd’hui' : m.daysLeft === 1 ? 'demain' : `le ${shortDate(m.endDate)}`;
    const message = `Bonjour ${m.firstName}, votre abonnement ${m.planName ?? ''} à ${this.gymName} se termine ${when}. Renouvelez à l’accueil ou par MoMo. À bientôt !`;
    window.open(whatsappLink(m.phone, message), '_blank', 'noopener');
    this.api
      .reminderSent({ memberId: m.id, rule: (m.daysLeft ?? 9) <= 1 ? 'BEFORE_1' : 'BEFORE_7', channel: 'WHATSAPP', targetEndDate: m.endDate, message })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sent.update(s => new Set(s).add(m.id)));
  }

  onFabAction(action: FabAction): void {
    const routes: Record<string, [string, object?]> = {
      member: ['/members', { new: 1 }],
      pay: ['/payments', { pay: 1 }],
      checkin: ['/access'],
      reminders: ['/reminders'],
    };
    const [path, queryParams] = routes[action.id];
    this.router.navigate([path], { queryParams });
  }

  private expiryText(d: DueMember): string {
    const left = d.member.daysLeft;
    if (left === 0) return "Expire aujourd'hui";
    if (left === 1) return 'Expire demain';
    return `Expire le ${shortDate(d.member.endDate)}`;
  }

  private firstOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
}
