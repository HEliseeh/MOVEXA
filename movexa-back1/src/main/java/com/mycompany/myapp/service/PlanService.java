package com.mycompany.myapp.service;

import com.mycompany.myapp.domain.Activity;
import com.mycompany.myapp.domain.Plan;
import com.mycompany.myapp.repository.PaymentRepository;
import com.mycompany.myapp.repository.PlanRepository;
import com.mycompany.myapp.service.dto.PlanDTO;
import com.mycompany.myapp.service.util.Dates;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catalogue des formules. Une formule n'est jamais supprimée (elle figure dans l'historique) :
 * on la désactive pour ne plus la proposer.
 */
@Service
@Transactional
public class PlanService {

    private final PlanRepository repository;
    private final PaymentRepository paymentRepository;
    private final ActivityService activityService;

    public PlanService(PlanRepository repository, PaymentRepository paymentRepository, ActivityService activityService) {
        this.repository = repository;
        this.paymentRepository = paymentRepository;
        this.activityService = activityService;
    }

    @Transactional(readOnly = true)
    public List<PlanDTO> list(boolean includeInactive) {
        Map<String, Long> members = new HashMap<>();
        for (Object[] row : repository.countMembersByPlanName()) {
            members.put((String) row[0], (Long) row[1]);
        }
        Map<Long, Long> sales = salesThisMonth();
        List<Plan> plans = includeInactive
            ? repository.findAllByOrderByDurationDaysAscPriceAsc()
            : repository.findAllByActiveTrueOrderByDurationDaysAscPriceAsc();
        return plans.stream().map(p -> toDto(p, members.getOrDefault(p.getName(), 0L), sales.getOrDefault(p.getId(), 0L))).toList();
    }

    public PlanDTO create(PlanDTO dto) {
        Plan plan = new Plan();
        apply(plan, dto);
        return toDto(repository.save(plan), 0L, 0L);
    }

    /** Un nouveau prix ne s'applique qu'aux prochains achats : les abonnements en cours gardent le leur. */
    public Optional<PlanDTO> update(Long id, PlanDTO dto) {
        return repository
            .findById(id)
            .map(plan -> {
                apply(plan, dto);
                return toDto(plan, null, null);
            });
    }

    private void apply(Plan plan, PlanDTO dto) {
        plan.setName(dto.name().trim());
        plan.setPrice(dto.price());
        plan.setDurationDays(dto.durationDays());
        plan.setActive(dto.active() == null || dto.active());
        plan.setRegistrationFee(dto.registrationFee() == null ? 0L : dto.registrationFee());
        plan.setFreezeAllowed(Boolean.TRUE.equals(dto.freezeAllowed()));
        plan.getActivities().clear();
        plan.getActivities().addAll(activityService.require(dto.activityIds()));
    }

    private Map<Long, Long> salesThisMonth() {
        Map<Long, Long> sales = new HashMap<>();
        for (Object[] row : paymentRepository.countPaidByPlanSince(Dates.startOf(Dates.today().withDayOfMonth(1)))) {
            sales.put((Long) row[0], (Long) row[1]);
        }
        return sales;
    }

    static PlanDTO toDto(Plan p, Long memberCount, Long salesThisMonth) {
        List<Activity> activities = p
            .getActivities()
            .stream()
            .sorted(Comparator.comparingInt(Activity::getPosition).thenComparing(Activity::getId))
            .toList();
        return new PlanDTO(
            p.getId(),
            p.getName(),
            p.getPrice(),
            p.getDurationDays(),
            p.isActive(),
            memberCount,
            p.getRegistrationFee(),
            p.isFreezeAllowed(),
            activities.stream().map(Activity::getId).toList(),
            activities.stream().map(Activity::getName).toList(),
            salesThisMonth
        );
    }
}
