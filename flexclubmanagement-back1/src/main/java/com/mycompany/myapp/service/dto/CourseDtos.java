package com.mycompany.myapp.service.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

/** Cours collectifs et planning du club. */
public final class CourseDtos {

    private CourseDtos() {}

    /** Créneau hebdomadaire. startTime au format HH:mm ; room et coachId vides = ceux du cours. */
    public record SlotDTO(
        Long id,
        Long courseId,
        @NotNull @Min(value = 1, message = "Jour invalide") @Max(value = 7, message = "Jour invalide") Integer dayOfWeek,
        @NotBlank @Pattern(regexp = "^([01][0-9]|2[0-3]):[0-5][0-9]$", message = "Heure au format 18:00") String startTime,
        @Size(max = 60) String room,
        Long coachId,
        String coachName
    ) {}

    /**
     * Cours collectif.
     * @param avgFillPct remplissage moyen des 4 dernières semaines (présents / places), null si non mesuré (lecture seule)
     */
    public record CourseDTO(
        Long id,
        @NotBlank(message = "Le nom du cours est obligatoire") @Size(max = 80) String name,
        @Size(max = 120) String description,
        Long coachId,
        String coachName,
        Long activityId,
        String activityName,
        @NotNull @Min(value = 15, message = "15 minutes au moins") @Max(value = 300, message = "5 heures au plus") Integer durationMinutes,
        @NotNull @Min(value = 1, message = "Au moins 1 place") @Max(value = 500) Integer capacity,
        @Size(max = 60) String room,
        @Size(max = 20) String color,
        Boolean active,
        List<SlotDTO> slots,
        Integer avgFillPct
    ) {}

    /**
     * Une séance précise dans le planning (créneau × date).
     * @param present membres pointés sur l'activité du cours pendant la séance (null si à venir ou non mesuré)
     */
    public record SessionDTO(
        Long slotId,
        Long courseId,
        String courseName,
        LocalDate date,
        String startTime,
        String endTime,
        String coachName,
        String room,
        int capacity,
        String color,
        Integer present
    ) {}

    public record WeekDTO(LocalDate weekStart, List<SessionDTO> sessions) {}
}
