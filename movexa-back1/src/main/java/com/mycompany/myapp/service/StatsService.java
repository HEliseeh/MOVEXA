package com.mycompany.myapp.service;

import com.mycompany.myapp.domain.Payment;
import com.mycompany.myapp.domain.Prospect;
import com.mycompany.myapp.domain.Reminder;
import com.mycompany.myapp.domain.enumeration.ProspectSource;
import com.mycompany.myapp.domain.enumeration.ProspectStatus;
import com.mycompany.myapp.domain.enumeration.ReminderChannel;
import com.mycompany.myapp.domain.enumeration.ReminderRule;
import com.mycompany.myapp.repository.CheckInRepository;
import com.mycompany.myapp.repository.MemberRepository;
import com.mycompany.myapp.repository.PaymentRepository;
import com.mycompany.myapp.repository.ProspectRepository;
import com.mycompany.myapp.repository.ReminderRepository;
import com.mycompany.myapp.repository.SubscriptionRepository;
import com.mycompany.myapp.service.dto.StatsDtos.*;
import com.mycompany.myapp.service.util.Dates;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chiffres de la page Statistiques. Une salle a quelques centaines de membres :
 * les regroupements (par mois, par heure, par personne) se font en Java, dans le fuseau du Bénin.
 */
@Service
@Transactional(readOnly = true)
public class StatsService {

    private static final List<ProspectStatus> CLOSED = List.of(ProspectStatus.CONVERTED, ProspectStatus.LOST);
    private static final int HEATMAP_WEEKS = 4;

    private final PaymentRepository paymentRepository;
    private final MemberRepository memberRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final CheckInRepository checkInRepository;
    private final ProspectRepository prospectRepository;
    private final ReminderRepository reminderRepository;

    public StatsService(
        PaymentRepository paymentRepository,
        MemberRepository memberRepository,
        SubscriptionRepository subscriptionRepository,
        CheckInRepository checkInRepository,
        ProspectRepository prospectRepository,
        ReminderRepository reminderRepository
    ) {
        this.paymentRepository = paymentRepository;
        this.memberRepository = memberRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.checkInRepository = checkInRepository;
        this.prospectRepository = prospectRepository;
        this.reminderRepository = reminderRepository;
    }

    /** MONTH = 30 jours, QUARTER = 90 jours, YEAR = 365 jours, aujourd'hui compris. */
    private static String normalize(String period) {
        String p = period == null ? "MONTH" : period.toUpperCase(Locale.ROOT);
        return switch (p) {
            case "QUARTER", "YEAR" -> p;
            default -> "MONTH";
        };
    }

    private static int days(String period) {
        return switch (period) {
            case "QUARTER" -> 90;
            case "YEAR" -> 365;
            default -> 30;
        };
    }

    // ---------------------------------------------------------------- Gestion

    public ManagementStatsDTO management(String period) {
        String p = normalize(period);
        int days = days(p);
        LocalDate today = Dates.today();
        LocalDate from = today.minusDays(days - 1L);
        LocalDate prevFrom = from.minusDays(days);

        long revenue = sumPaid(Dates.startOf(from), Dates.endOf(today));
        long revenuePrevious = sumPaid(Dates.startOf(prevFrom), Dates.startOf(from));
        long active = memberRepository.countByArchivedFalseAndExpiryDateGreaterThanEqual(today);
        long joined = memberRepository.countByArchivedFalseAndJoinDateGreaterThanEqual(from);

        long due = 0;
        long renewed = 0;
        for (Object[] row : subscriptionRepository.findDueWithRenewals(from, today)) {
            due++;
            if (((Number) row[1]).longValue() > 0) renewed++;
        }

        Long avgSpend = active == 0 ? null : Math.round(revenue / (double) active / (days / 30.0));

        return new ManagementStatsDTO(
            p,
            from,
            today,
            revenue,
            revenuePrevious,
            active,
            joined,
            due,
            renewed,
            avgSpend,
            months(today, "YEAR".equals(p) ? 12 : 6),
            heatmap(today),
            HEATMAP_WEEKS,
            memberRepository
                .countActiveByPlan(today)
                .stream()
                .map(r -> new PlanCount(r[0] == null ? "Sans formule" : (String) r[0], ((Number) r[1]).longValue()))
                .sorted(Comparator.comparingLong(PlanCount::members).reversed())
                .toList()
        );
    }

    private long sumPaid(Instant from, Instant to) {
        long total = 0;
        for (Object[] row : paymentRepository.sumPaidByMethod(from, to)) total += ((Number) row[1]).longValue();
        return total;
    }

    /** Les n derniers mois (le mois en cours en dernier). */
    private List<MonthStat> months(LocalDate today, int n) {
        YearMonth current = YearMonth.from(today);
        YearMonth first = current.minusMonths(n - 1L);
        LocalDate start = first.atDay(1);
        Map<YearMonth, long[]> m = new TreeMap<>();
        for (int i = 0; i < n; i++) m.put(first.plusMonths(i), new long[3]);

        for (Object[] row : paymentRepository.findPaidAmountsSince(Dates.startOf(start))) {
            long[] c = m.get(YearMonth.from(Dates.dayOf((Instant) row[0])));
            if (c != null) c[0] += ((Number) row[1]).longValue();
        }
        for (LocalDate d : memberRepository.findJoinDatesSince(start)) {
            long[] c = m.get(YearMonth.from(d));
            if (c != null) c[1]++;
        }
        for (LocalDate d : memberRepository.findLapsedExpiryDates(start, today)) {
            long[] c = m.get(YearMonth.from(d));
            if (c != null) c[2]++;
        }
        return m.entrySet().stream().map(e -> new MonthStat(e.getKey().toString(), e.getValue()[0], e.getValue()[1], e.getValue()[2])).toList();
    }

    /** Entrées autorisées des 4 dernières semaines, par jour (lundi = 0) et par heure. */
    private long[][] heatmap(LocalDate today) {
        long[][] grid = new long[7][24];
        Instant since = Dates.startOf(today.minusDays(HEATMAP_WEEKS * 7L - 1));
        for (Instant t : checkInRepository.findAllowedTimesSince(since)) {
            ZonedDateTime z = t.atZone(Dates.ZONE);
            grid[z.getDayOfWeek().getValue() - 1][z.getHour()]++;
        }
        return grid;
    }

    // ---------------------------------------------------------------- Commercial

    public SalesStatsDTO sales(String period) {
        String p = normalize(period);
        LocalDate today = Dates.today();
        LocalDate from = today.minusDays(days(p) - 1L);
        Instant start = Dates.startOf(from);

        List<Prospect> prospects = prospectRepository.findAllByCreatedAtGreaterThanEqual(start);
        long contacted = 0;
        long converted = 0;
        long convertedDays = 0;
        Map<ProspectSource, long[]> bySource = new EnumMap<>(ProspectSource.class);
        Map<String, long[]> bySeller = new TreeMap<>();
        for (Prospect pr : prospects) {
            boolean isConverted = pr.getStatus() == ProspectStatus.CONVERTED;
            if (pr.getStatus() != ProspectStatus.NEW || pr.getFollowUpStep() > 0) contacted++;
            if (isConverted) {
                converted++;
                LocalDate closed = pr.getClosedAt() == null ? today : Dates.dayOf(pr.getClosedAt());
                convertedDays += Math.max(0, ChronoUnit.DAYS.between(pr.getFirstContactDate(), closed));
            }
            long[] s = bySource.computeIfAbsent(pr.getSource(), k -> new long[2]);
            s[0]++;
            if (isConverted) s[1]++;
            long[] t = bySeller.computeIfAbsent(seller(pr), k -> new long[2]);
            t[0]++;
            if (isConverted) t[1]++;
        }

        // Relances à l'heure : parmi les prospects ouverts avec une relance prévue, ceux qui ne sont pas en retard.
        Map<String, long[]> onTime = new HashMap<>();
        for (Prospect pr : prospectRepository.findOpenWithFollowUp(CLOSED)) {
            long[] c = onTime.computeIfAbsent(seller(pr), k -> new long[2]);
            c[0]++;
            if (!pr.getNextFollowUp().isBefore(today)) c[1]++;
            bySeller.computeIfAbsent(seller(pr), k -> new long[2]);
        }

        List<SourceStat> sources = Arrays.stream(ProspectSource.values())
            .map(src -> {
                long[] c = bySource.getOrDefault(src, new long[2]);
                return new SourceStat(src, c[0], c[1]);
            })
            .filter(s -> s.prospects() > 0)
            .sorted(Comparator.comparingLong(SourceStat::prospects).reversed())
            .toList();

        List<SellerStat> sellers = bySeller
            .entrySet()
            .stream()
            .map(e -> {
                long[] o = onTime.get(e.getKey());
                Integer pct = o == null || o[0] == 0 ? null : (int) Math.round(100.0 * o[1] / o[0]);
                return new SellerStat(e.getKey(), e.getValue()[0], e.getValue()[1], pct);
            })
            .sorted(Comparator.comparingLong(SellerStat::prospects).reversed())
            .toList();

        // Relances des membres sur la période ; « revenus » = un paiement après leur première relance « expiré ».
        List<Reminder> reminders = reminderRepository.findAllBySentAtAfterOrderBySentAtDesc(start);
        long whatsapp = reminders.stream().filter(r -> r.getChannel() == ReminderChannel.WHATSAPP).count();
        Map<Long, Instant> firstLapsedReminder = new HashMap<>();
        for (Reminder r : reminders) {
            if (r.getRule() == ReminderRule.AFTER_1 || r.getRule() == ReminderRule.AFTER_7) {
                firstLapsedReminder.merge(r.getMember().getId(), r.getSentAt(), (a, b) -> a.isBefore(b) ? a : b);
            }
        }
        Set<Long> cameBack = new HashSet<>();
        if (!firstLapsedReminder.isEmpty()) {
            for (Payment pay : paymentRepository.findPaidForMembersSince(firstLapsedReminder.keySet(), start)) {
                Long memberId = pay.getMember().getId();
                Instant sent = firstLapsedReminder.get(memberId);
                if (sent != null && pay.getPaidAt() != null && !pay.getPaidAt().isBefore(sent)) cameBack.add(memberId);
            }
        }

        return new SalesStatsDTO(
            p,
            from,
            today,
            prospects.size(),
            contacted,
            converted,
            converted == 0 ? null : Math.round(10.0 * convertedDays / converted) / 10.0,
            sources,
            sellers,
            reminders.size(),
            whatsapp,
            firstLapsedReminder.size(),
            cameBack.size()
        );
    }

    private static String seller(Prospect p) {
        return p.getCreatedBy() == null || p.getCreatedBy().isBlank() ? "inconnu" : p.getCreatedBy();
    }
}
