import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ManagementStats, SalesStats, StatsPeriod } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { apiError, fcfa, initials, SOURCE_LABELS } from '@shared/format';

const PERIODS: { key: StatsPeriod; label: string; long: string }[] = [
  { key: 'MONTH', label: '30 jours', long: '30 derniers jours' },
  { key: 'QUARTER', label: 'Trimestre', long: '90 derniers jours' },
  { key: 'YEAR', label: 'Année', long: '12 derniers mois' },
];
const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
/** Affluence : une seule teinte, du clair au foncé */
const RAMP = ['#eef1f0', '#d3ece8', '#a6d8d0', '#6bbcb0', '#2f9a8c', '#0d6b60'];
const AVATARS = ['#e8f55a', '#c3b5f7', '#fde3c0', '#bfe3f5', '#f7c6d0'];

/** Graphique des revenus (viewBox) */
const W = 600;
const H = 220;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 30;
const PAD_B = 28;

/** « 2,94 M », « 450 k », « 900 » */
function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1_000) return Math.round(n / 1_000) + ' k';
  return String(n);
}

function pct(a: number, b: number): number {
  return b ? Math.round((100 * a) / b) : 0;
}

/**
 * Statistiques (maquette « Statistiques ») :
 * - Gestion (gérant) : argent, membres, fréquentation ;
 * - Commercial (gérant et commerciaux) : prospects, sources, équipe, relances.
 */
@Component({
  selector: 'app-stats',
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats implements OnInit {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CurrentUserStore);

  readonly periods = PERIODS;
  readonly ramp = RAMP;
  readonly fcfa = fcfa;
  readonly chartW = W;
  readonly chartH = H;

  readonly period = signal<StatsPeriod>('MONTH');
  readonly mgmt = signal<ManagementStats | null>(null);
  readonly sales = signal<SalesStats | null>(null);
  readonly mgmtError = signal<string | null>(null);
  readonly salesError = signal<string | null>(null);
  /** login → « Prénom Nom » (comptes du personnel, lisibles par le gérant) */
  private readonly names = signal<Map<string, string>>(new Map());

  readonly periodLong = computed(() => PERIODS.find(p => p.key === this.period())!.long);

  ngOnInit(): void {
    this.load();
    if (this.store.isManager()) {
      this.api
        .staff()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: list => this.names.set(new Map(list.map(a => [a.login, [a.firstName, a.lastName].filter(Boolean).join(' ') || a.login]))),
          error: () => {},
        });
    }
  }

  setPeriod(p: StatsPeriod): void {
    if (p === this.period()) return;
    this.period.set(p);
    this.load();
  }

  load(): void {
    const p = this.period();
    if (this.store.isManager()) {
      this.api
        .managementStats(p)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: s => {
            this.mgmt.set(s);
            this.mgmtError.set(null);
          },
          error: err => this.mgmtError.set(apiError(err, 'Statistiques de gestion indisponibles.')),
        });
    }
    this.api
      .salesStats(p)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: s => {
          this.sales.set(s);
          this.salesError.set(null);
        },
        error: err => this.salesError.set(apiError(err, 'Statistiques commerciales indisponibles.')),
      });
  }

  // ---------------------------------------------------------------- Gestion

  readonly kpis = computed(() => {
    const m = this.mgmt();
    if (!m) return null;
    const delta = m.revenuePrevious ? Math.round((100 * (m.revenue - m.revenuePrevious)) / m.revenuePrevious) : null;
    return {
      revenue: compact(m.revenue),
      revenueFull: fcfa(m.revenue),
      delta: delta === null ? null : (delta > 0 ? '+' : '') + delta + ' %',
      deltaUp: (delta ?? 0) >= 0,
      active: m.activeMembers,
      newMembers: m.newMembers,
      renewPct: m.renewalsDue ? pct(m.renewalsDone, m.renewalsDue) + ' %' : '—',
      renewDetail: m.renewalsDue ? `${m.renewalsDone} sur ${m.renewalsDue}` : 'aucune échéance sur la période',
      avgSpend: m.avgSpendPerMemberMonth === null ? '—' : m.avgSpendPerMemberMonth.toLocaleString('fr-FR'),
    };
  });

  readonly revenueChart = computed(() => {
    const months = this.mgmt()?.months ?? [];
    if (!months.length) return null;
    const max = Math.max(1, ...months.map(m => m.revenue));
    const step = (W - PAD_L - PAD_R) / Math.max(1, months.length - 1);
    const x = (i: number) => PAD_L + (months.length === 1 ? (W - PAD_L - PAD_R) / 2 : i * step);
    const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);
    const pts = months.map((m, i) => ({
      x: x(i),
      y: y(m.revenue),
      label: this.monthLabel(m.month),
      value: compact(m.revenue),
      tip: `${this.monthLabel(m.month)} : ${fcfa(m.revenue)}${i === months.length - 1 ? ' (en cours)' : ''}`,
      current: i === months.length - 1,
      // Valeur écrite sur le premier, le plus haut et le dernier point seulement
      showValue: i === 0 || i === months.length - 1 || m.revenue === max,
    }));
    const path = (list: typeof pts) => list.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    return {
      points: pts,
      line: path(pts.slice(0, -1)),
      // Le mois en cours n'est pas fini : dernier segment en pointillés
      dashed: pts.length > 1 ? path(pts.slice(-2)) : '',
      baseY: H - PAD_B,
      hitW: Math.max(24, step),
    };
  });

  readonly flux = computed(() => {
    const months = this.mgmt()?.months ?? [];
    const max = Math.max(1, ...months.flatMap(m => [m.joined, m.left]));
    return months.map(m => ({
      label: this.monthLabel(m.month),
      joined: m.joined,
      left: m.left,
      hIn: Math.round((120 * m.joined) / max),
      hOut: Math.round((120 * m.left) / max),
    }));
  });

  readonly heat = computed(() => {
    const m = this.mgmt();
    if (!m) return null;
    const weeks = m.heatmapWeeks || 1;
    let first = 23;
    let last = 0;
    m.heatmap.forEach(row => row.forEach((v, h) => {
      if (v > 0) {
        first = Math.min(first, h);
        last = Math.max(last, h);
      }
    }));
    // Sans données : plage habituelle d'une salle
    if (first > last) {
      first = 6;
      last = 21;
    }
    first = Math.min(first, 6);
    last = Math.max(last, 21);
    const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const max = Math.max(...m.heatmap.flat()) / weeks;
    const rows = DAYS.map((day, d) => ({
      day,
      cells: hours.map(h => {
        const avg = m.heatmap[d][h] / weeks;
        const bin = avg === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((5 * avg) / max));
        const txt = avg === 0 ? 'aucune entrée' : `${avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} entrée(s) en moyenne`;
        return { bg: RAMP[bin], tip: `${day} ${h} h : ${txt}` };
      }),
    }));
    const total = m.heatmap.flat().reduce((a, b) => a + b, 0);
    return { hours, rows, weeks, empty: total === 0 };
  });

  readonly plans = computed(() => {
    const list = this.mgmt()?.plans ?? [];
    const total = list.reduce((n, p) => n + p.members, 0);
    const max = Math.max(1, ...list.map(p => p.members));
    const rows = list.map(p => ({ name: p.plan, n: p.members, width: pct(p.members, max), share: pct(p.members, total) }));
    const top = rows[0];
    return {
      rows,
      total,
      note: top && total ? `${total} membres actifs. « ${top.name} » fait ${top.share} % des abonnements actifs.` : null,
    };
  });

  // ---------------------------------------------------------------- Commercial

  readonly funnel = computed(() => {
    const s = this.sales();
    if (!s) return null;
    return {
      steps: [
        { label: 'Prospects enregistrés', n: s.prospects, width: 100, conv: 'point de départ' },
        { label: 'Contactés ou relancés', n: s.contacted, width: pct(s.contacted, s.prospects), conv: `${pct(s.contacted, s.prospects)} % des prospects` },
        { label: 'Inscrits', n: s.converted, width: pct(s.converted, s.prospects), conv: `${pct(s.converted, s.contacted)} % des contactés` },
      ],
      headline: s.prospects
        ? `${pct(s.converted, s.prospects)} % des prospects deviennent membres` +
          (s.avgDaysToConvert !== null ? ` · ${s.avgDaysToConvert.toLocaleString('fr-FR')} jours en moyenne` : '')
        : 'Aucun prospect enregistré sur la période',
    };
  });

  readonly sources = computed(() => {
    const list = this.sales()?.sources ?? [];
    const max = Math.max(1, ...list.map(s => s.prospects));
    const rows = list.map(s => ({
      name: SOURCE_LABELS[s.source],
      p: s.prospects,
      i: s.converted,
      rate: pct(s.converted, s.prospects),
      wP: pct(s.prospects, max),
      wI: pct(s.converted, max),
    }));
    const best = rows.filter(r => r.p >= 2).sort((a, b) => b.rate - a.rate)[0];
    return { rows, note: best && best.rate > 0 ? `« ${best.name} » convertit le mieux : ${best.rate} % des prospects s’inscrivent.` : null };
  });

  readonly sellers = computed(() => {
    const me = this.store.user()?.login;
    return (this.sales()?.sellers ?? []).map((t, i) => {
      const name = t.login === me ? 'Vous' : (this.names().get(t.login) ?? t.login);
      const parts = name.split(/[\s@.]+/);
      return {
        name,
        ini: name === 'Vous' ? 'V' : initials(parts[0], parts[1]),
        bg: AVATARS[i % AVATARS.length],
        prospects: t.prospects,
        converted: t.converted,
        rate: pct(t.converted, t.prospects),
        onTime: t.onTimePct === null ? '—' : t.onTimePct + ' %',
      };
    });
  });

  readonly relances = computed(() => {
    const s = this.sales();
    if (!s) return null;
    return {
      backPct: s.lapsedReminded ? pct(s.lapsedCameBack, s.lapsedReminded) + ' %' : '—',
      backDetail: s.lapsedReminded
        ? `des membres expirés relancés ont repris un abonnement (${s.lapsedCameBack} sur ${s.lapsedReminded})`
        : 'aucun membre expiré relancé sur la période',
      sent: s.remindersSent,
      whatsapp: s.remindersWhatsapp,
    };
  });

  monthLabel(ym: string): string {
    return MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
  }
}
