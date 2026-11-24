package com.movexa.gateway.service.dto;

import com.movexa.gateway.config.Constants;
import jakarta.validation.constraints.*;
import java.time.Instant;

/** Comptes du personnel de la salle (écran Paramètres › Utilisateurs, réservé au gérant). */
public final class StaffDTOs {

    public static final int PASSWORD_MIN = 8;
    public static final int PASSWORD_MAX = 100;

    private StaffDTOs() {}

    /** Rôle dans la salle. OTHER : compte sans rôle MOVEXA (il ne peut rien faire dans l'application). */
    public enum StaffRole {
        MANAGER,
        RECEPTION,
        OTHER,
    }

    public record StaffAccount(
        Long id,
        String login,
        String firstName,
        String lastName,
        String email,
        boolean activated,
        StaffRole role,
        Instant createdDate,
        Instant lastModifiedDate
    ) {}

    public record CreateStaffRequest(
        @NotBlank(message = "L'identifiant est obligatoire")
        @Size(min = 3, max = 50, message = "Identifiant : 3 à 50 caractères")
        @Pattern(regexp = Constants.LOGIN_REGEX, message = "Identifiant : lettres, chiffres, point, tiret ou soulignement, sans espace")
        String login,
        @NotBlank(message = "Le prénom est obligatoire") @Size(max = 50) String firstName,
        @Size(max = 50) String lastName,
        @Email(message = "Adresse e-mail invalide") @Size(max = 254) String email,
        @NotNull(message = "Le rôle est obligatoire") StaffRole role,
        @NotBlank(message = "Le mot de passe est obligatoire")
        @Size(min = PASSWORD_MIN, max = PASSWORD_MAX, message = "Mot de passe : 8 caractères minimum")
        String password
    ) {}

    public record UpdateStaffRequest(
        @NotBlank(message = "Le prénom est obligatoire") @Size(max = 50) String firstName,
        @Size(max = 50) String lastName,
        @Email(message = "Adresse e-mail invalide") @Size(max = 254) String email,
        @NotNull(message = "Le rôle est obligatoire") StaffRole role,
        boolean activated
    ) {}

    public record ResetPasswordRequest(
        @NotBlank(message = "Le mot de passe est obligatoire")
        @Size(min = PASSWORD_MIN, max = PASSWORD_MAX, message = "Mot de passe : 8 caractères minimum")
        String password
    ) {}
}
