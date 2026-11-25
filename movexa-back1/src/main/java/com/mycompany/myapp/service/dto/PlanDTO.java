package com.mycompany.myapp.service.dto;

import jakarta.validation.constraints.*;
import java.util.List;

/**
 * Formule vendue par la salle.
 * @param memberCount     membres dont c'est la formule en cours (lecture seule)
 * @param salesThisMonth  ventes payées depuis le 1er du mois (lecture seule)
 * @param activityIds     activités incluses (au moins une)
 * @param activityNames   leurs noms, dans l'ordre d'affichage (lecture seule)
 */
public record PlanDTO(
    Long id,
    @NotBlank(message = "Le nom de la formule est obligatoire") @Size(max = 100) String name,
    @NotNull(message = "Le prix est obligatoire") @Min(value = 0, message = "Le prix ne peut pas être négatif") Long price,
    @NotNull(message = "La durée est obligatoire") @Min(0) @Max(3660) Integer durationDays,
    Boolean active,
    Long memberCount,
    @Min(value = 0, message = "Les frais d'inscription ne peuvent pas être négatifs") Long registrationFee,
    Boolean freezeAllowed,
    List<Long> activityIds,
    List<String> activityNames,
    Long salesThisMonth
) {}
