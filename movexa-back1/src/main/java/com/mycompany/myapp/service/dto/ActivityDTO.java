package com.mycompany.myapp.service.dto;

import jakarta.validation.constraints.*;

/**
 * Activité de la salle.
 * @param planCount nombre de formules qui l'incluent (lecture seule)
 */
public record ActivityDTO(
    Long id,
    @NotBlank(message = "Le nom de l'activité est obligatoire") @Size(max = 60, message = "60 caractères maximum") String name,
    Boolean active,
    Long planCount
) {}
