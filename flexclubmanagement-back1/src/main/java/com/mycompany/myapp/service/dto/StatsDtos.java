package com.mycompany.myapp.service.dto;

import com.mycompany.myapp.domain.enumeration.ProspectSource;
import java.time.LocalDate;
import java.util.List;

/** Page Statistiques : partie gestion (gérant) et partie commerciale (gérant, commercial). */
public final class StatsDtos {

    private StatsDtos() {}

    /** Un mois : encaissé, nouveaux membres, membres partis (fin d'abonnement passée sans renouvellement). */
    public record MonthStat(String month, long revenue, long joined, long left) {}

    public record PlanCount(String plan, long members) {}

    /**
     * Gestion. period : MONTH (30 jours), QUARTER (90 jours) ou YEAR (365 jours), comparés à la période d'avant.
     * heatmap[jour 0 = lundi][heure 0-23] : entrées autorisées sur les 4 dernières semaines.
     */
    public record ManagementStatsDTO(
        String period,
        LocalDate from,
        LocalDate to,
        long revenue,
        long revenuePrevious,
        long activeMembers,
        long newMembers,
        long renewalsDue,
        long renewalsDone,
        Long avgSpendPerMemberMonth,
        List<MonthStat> months,
        long[][] heatmap,
        int heatmapWeeks,
        List<PlanCount> plans
    ) {}

    public record SourceStat(ProspectSource source, long prospects, long converted) {}

    /** Une personne de l'équipe (identifiée par son login) et les prospects qu'elle a enregistrés. */
    public record SellerStat(String login, long prospects, long converted, Integer onTimePct) {}

    public record SalesStatsDTO(
        String period,
        LocalDate from,
        LocalDate to,
        long prospects,
        long contacted,
        long converted,
        Double avgDaysToConvert,
        List<SourceStat> sources,
        List<SellerStat> sellers,
        long remindersSent,
        long remindersWhatsapp,
        long lapsedReminded,
        long lapsedCameBack
    ) {}
}
