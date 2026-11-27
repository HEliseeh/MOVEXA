package com.mycompany.myapp.service;

import com.mycompany.myapp.domain.Activity;
import com.mycompany.myapp.domain.CheckIn;
import com.mycompany.myapp.domain.Member;
import com.mycompany.myapp.domain.Plan;
import com.mycompany.myapp.domain.Subscription;
import com.mycompany.myapp.domain.enumeration.CheckInResult;
import com.mycompany.myapp.domain.enumeration.SubscriptionState;
import com.mycompany.myapp.repository.ActivityRepository;
import com.mycompany.myapp.repository.CheckInRepository;
import com.mycompany.myapp.repository.MemberRepository;
import com.mycompany.myapp.repository.SubscriptionRepository;
import com.mycompany.myapp.service.dto.CheckInDtos.CheckInDTO;
import com.mycompany.myapp.service.dto.CheckInDtos.CheckInRequest;
import com.mycompany.myapp.service.util.Dates;
import com.mycompany.myapp.web.rest.errors.BadRequestAlertException;
import com.mycompany.myapp.web.rest.errors.NotFoundException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Pointage à l'entrée (module 4) : vérifie l'abonnement et enregistre le passage.
 * Vert = valide, orange = expire bientôt (entrée acceptée, proposer le renouvellement), rouge = refusé.
 */
@Service
@Transactional
public class CheckInService {

    private final CheckInRepository repository;
    private final MemberRepository memberRepository;
    private final SettingsService settingsService;
    private final MemberViews views;

    private final ActivityRepository activityRepository;
    private final SubscriptionRepository subscriptionRepository;

    public CheckInService(
        CheckInRepository repository,
        MemberRepository memberRepository,
        SettingsService settingsService,
        MemberViews views,
        ActivityRepository activityRepository,
        SubscriptionRepository subscriptionRepository
    ) {
        this.repository = repository;
        this.memberRepository = memberRepository;
        this.settingsService = settingsService;
        this.views = views;
        this.activityRepository = activityRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    public CheckInDTO checkIn(CheckInRequest request) {
        // Pointage hors ligne renvoyé une seconde fois : on rend le premier, sans doublon.
        if (StringUtils.hasText(request.clientId())) {
            var existing = repository.findOneByClientId(request.clientId());
            if (existing.isPresent()) return toDto(existing.orElseThrow(), views.threshold(), List.of());
        }

        Member member;
        if (request.memberId() != null) {
            member = memberRepository.findWithUserById(request.memberId()).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        } else if (StringUtils.hasText(request.qrToken())) {
            member = memberRepository
                .findOneWithUserByQrTokenAndArchivedFalse(request.qrToken().trim())
                .orElseThrow(() -> new NotFoundException("QR code inconnu : ce n'est pas une carte de membre de la salle"));
        } else {
            throw new BadRequestAlertException("Indiquez le membre ou le QR code", "checkin", "nomember");
        }
        if (member.isArchived()) {
            throw new BadRequestAlertException("Ce membre est archivé", "checkin", "archived");
        }

        // Heure réelle du passage (hors ligne), sans accepter une date dans le futur.
        Instant now = Instant.now();
        Instant at = request.checkedAt() != null && request.checkedAt().isBefore(now.plus(Duration.ofMinutes(5))) ? request.checkedAt() : now;
        LocalDate day = Dates.dayOf(at);
        int threshold = views.threshold();
        SubscriptionState state = settingsService.stateOn(member.getExpiryDate(), day, threshold);

        // Activité demandée : elle doit être incluse dans la formule en cours (sinon « Refusé, activité non incluse »)
        Activity activity = request.activityId() == null
            ? null
            : activityRepository.findById(request.activityId()).orElseThrow(() -> new NotFoundException("Activité introuvable"));
        // Droits : ceux choisis pour le membre, sinon ceux de sa formule en cours
        Plan plan = currentPlan(member);
        Set<Activity> rights = member.isCustomAccess() ? member.getActivities() : plan != null ? plan.getActivities() : null;
        boolean activityIncluded = activity == null || rights == null || rights.contains(activity);

        CheckIn c = new CheckIn();
        c.setMember(member);
        c.setCheckedAt(at);
        c.setMethod(request.method());
        c.setActivity(activity);
        c.setActivityName(activity != null ? activity.getName() : null);
        c.setResult(
            switch (state) {
                case ACTIVE -> activityIncluded ? CheckInResult.ALLOWED : CheckInResult.REFUSED_ACTIVITY;
                case EXPIRING_SOON -> activityIncluded ? CheckInResult.ALLOWED_EXPIRING : CheckInResult.REFUSED_ACTIVITY;
                case EXPIRED, NONE -> CheckInResult.REFUSED;
            }
        );
        c.setAgent(MemberViews.currentAgent());
        c.setClientId(StringUtils.hasText(request.clientId()) ? request.clientId() : null);
        repository.save(c);

        if (!c.getResult().isRefused() && (member.getLastVisitDate() == null || member.getLastVisitDate().isBefore(day))) {
            member.setLastVisitDate(day);
        }
        return toDto(c, threshold, includedActivities(rights));
    }

    /** Passages du jour, du plus récent au plus ancien. */
    @Transactional(readOnly = true)
    public List<CheckInDTO> today() {
        LocalDate today = Dates.today();
        int threshold = views.threshold();
        return repository
            .findAllByCheckedAtBetweenOrderByCheckedAtDesc(Dates.startOf(today), Dates.endOf(today))
            .stream()
            .map(c -> toDto(c, threshold, List.of()))
            .toList();
    }

    /**
     * Formule de l'abonnement en cours (le plus récent non annulé). Null si le membre n'en a pas
     * ou si son abonnement a été repris sans formule (import) : on ne vérifie alors pas l'activité.
     */
    private Plan currentPlan(Member member) {
        return subscriptionRepository.findFirstByMemberIdAndCancelledFalseOrderByEndDateDesc(member.getId()).map(Subscription::getPlan).orElse(null);
    }

    private static List<String> includedActivities(Set<Activity> rights) {
        if (rights == null) return List.of();
        return rights
            .stream()
            .filter(Activity::isActive)
            .sorted(Comparator.comparingInt(Activity::getPosition).thenComparing(Activity::getId))
            .map(Activity::getName)
            .toList();
    }

    private CheckInDTO toDto(CheckIn c, int threshold, List<String> includedActivities) {
        Member m = c.getMember();
        return new CheckInDTO(
            c.getId(),
            m.getId(),
            MemberViews.fullName(m),
            m.getMemberNumber(),
            m.getUser().getPhone(),
            c.getMethod(),
            c.getResult(),
            c.getCheckedAt(),
            c.getAgent(),
            settingsService.stateOf(m.getExpiryDate(), threshold),
            m.getPlan(),
            m.getExpiryDate(),
            MemberViews.daysLeft(m.getExpiryDate()),
            c.getActivityName(),
            includedActivities,
            m.isHasPhoto()
        );
    }
}
