package com.mycompany.myapp.web.rest;

import com.mycompany.myapp.security.AuthoritiesConstants;
import com.mycompany.myapp.service.CourseService;
import com.mycompany.myapp.service.dto.CourseDtos.CourseDTO;
import com.mycompany.myapp.service.dto.CourseDtos.SlotDTO;
import com.mycompany.myapp.service.dto.CourseDtos.WeekDTO;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.ResponseUtil;

/** Cours collectifs et planning : lecture pour l'accueil et le gérant, modifications par le gérant. */
@RestController
@RequestMapping("/api")
@PreAuthorize(AuthoritiesConstants.IS_DESK)
public class CourseResource {

    private final CourseService courseService;

    public CourseResource(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping("/courses")
    public List<CourseDTO> list() {
        return courseService.list();
    }

    @PostMapping("/courses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public CourseDTO create(@Valid @RequestBody CourseDTO dto) {
        return courseService.create(dto);
    }

    @PutMapping("/courses/{id}")
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public ResponseEntity<CourseDTO> update(@PathVariable Long id, @Valid @RequestBody CourseDTO dto) {
        return ResponseUtil.wrapOrNotFound(courseService.update(id, dto));
    }

    @PostMapping("/courses/{id}/slots")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public SlotDTO addSlot(@PathVariable Long id, @Valid @RequestBody SlotDTO dto) {
        return courseService.addSlot(id, dto);
    }

    @PutMapping("/course-slots/{id}")
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public ResponseEntity<SlotDTO> updateSlot(@PathVariable Long id, @Valid @RequestBody SlotDTO dto) {
        return ResponseUtil.wrapOrNotFound(courseService.updateSlot(id, dto));
    }

    @DeleteMapping("/course-slots/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public void deleteSlot(@PathVariable Long id) {
        courseService.deleteSlot(id);
    }

    /** GET /api/planning?week=2026-11-23 : séances de la semaine (du lundi au dimanche) contenant ce jour */
    @GetMapping("/planning")
    public WeekDTO planning(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return courseService.week(week);
    }
}
