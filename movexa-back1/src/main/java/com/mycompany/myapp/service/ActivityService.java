package com.mycompany.myapp.service;

import com.mycompany.myapp.domain.Activity;
import com.mycompany.myapp.repository.ActivityRepository;
import com.mycompany.myapp.repository.PlanRepository;
import com.mycompany.myapp.service.dto.ActivityDTO;
import com.mycompany.myapp.web.rest.errors.BadRequestAlertException;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Activités de la salle : le gérant les ajoute, les renomme ou les retire de la vente. */
@Service
@Transactional
public class ActivityService {

    private static final String ENTITY = "activity";

    private final ActivityRepository repository;
    private final PlanRepository planRepository;

    public ActivityService(ActivityRepository repository, PlanRepository planRepository) {
        this.repository = repository;
        this.planRepository = planRepository;
    }

    @Transactional(readOnly = true)
    public List<ActivityDTO> list() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : planRepository.countPlansByActivity()) counts.put((Long) row[0], (Long) row[1]);
        return repository.findAllByOrderByPositionAscIdAsc().stream().map(a -> toDto(a, counts.getOrDefault(a.getId(), 0L))).toList();
    }

    public ActivityDTO create(ActivityDTO dto) {
        String name = clean(dto.name());
        requireUnique(name, null);
        Activity a = new Activity();
        a.setName(name);
        a.setActive(true);
        a.setPosition(repository.findAllByOrderByPositionAscIdAsc().stream().mapToInt(Activity::getPosition).max().orElse(0) + 1);
        return toDto(repository.save(a), 0L);
    }

    public Optional<ActivityDTO> update(Long id, ActivityDTO dto) {
        return repository
            .findById(id)
            .map(a -> {
                String name = clean(dto.name());
                requireUnique(name, id);
                a.setName(name);
                a.setActive(dto.active() == null || dto.active());
                return toDto(a, null);
            });
    }

    /** Activités choisies pour une formule : elles doivent exister (une activité retirée reste acceptée si elle y était déjà) */
    @Transactional(readOnly = true)
    public Set<Activity> require(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestAlertException("Cochez au moins une activité incluse dans la formule", ENTITY, "noactivity");
        }
        List<Activity> found = repository.findAllById(new LinkedHashSet<>(ids));
        if (found.size() != new HashSet<>(ids).size()) {
            throw new BadRequestAlertException("Activité introuvable", ENTITY, "notfound");
        }
        return new LinkedHashSet<>(found);
    }

    private void requireUnique(String name, Long selfId) {
        repository
            .findOneByNameIgnoreCase(name)
            .filter(other -> !other.getId().equals(selfId))
            .ifPresent(other -> {
                throw new BadRequestAlertException("Cette activité existe déjà", ENTITY, "exists");
            });
    }

    private static String clean(String value) {
        String s = value.trim().replaceAll("\s+", " ");
        return s.substring(0, 1).toUpperCase(Locale.FRENCH) + s.substring(1);
    }

    private static ActivityDTO toDto(Activity a, Long planCount) {
        return new ActivityDTO(a.getId(), a.getName(), a.isActive(), planCount);
    }
}
