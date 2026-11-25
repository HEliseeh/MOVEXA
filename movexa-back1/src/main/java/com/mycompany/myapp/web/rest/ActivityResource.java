package com.mycompany.myapp.web.rest;

import com.mycompany.myapp.security.AuthoritiesConstants;
import com.mycompany.myapp.service.ActivityService;
import com.mycompany.myapp.service.dto.ActivityDTO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.ResponseUtil;

/** Activités de la salle : lecture pour tous (pointage, formules), création et modification par le gérant. */
@RestController
@RequestMapping("/api/activities")
public class ActivityResource {

    private final ActivityService activityService;

    public ActivityResource(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping("")
    public List<ActivityDTO> list() {
        return activityService.list();
    }

    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public ActivityDTO create(@Valid @RequestBody ActivityDTO dto) {
        return activityService.create(dto);
    }

    @PutMapping("/{id}")
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public ResponseEntity<ActivityDTO> update(@PathVariable Long id, @Valid @RequestBody ActivityDTO dto) {
        return ResponseUtil.wrapOrNotFound(activityService.update(id, dto));
    }
}
