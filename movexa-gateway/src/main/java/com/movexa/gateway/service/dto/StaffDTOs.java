package com.movexa.gateway.service.dto;

import com.movexa.gateway.security.PasswordPolicy;
import jakarta.validation.constraints.*;
import java.time.Instant;

/** Comptes du personnel de la salle (écran Paramètres › Utilisateurs, réservé au gérant). */
public final class StaffDTOs {

    public static final int PASSWORD_MIN = PasswordPolicy.MIN_LENGTH;
    public static final int PASSWORD_MAX = PasswordPolicy.MAX_LENGTH;

    private StaffDTOs() {}

    /** Rôle dans la salle. OTHER : compte sans rôle MOVEXA (il ne peut rien faire dans l'application). */
    public enum StaffRole {
        MANAGER,
        RECEPTION,
        COMMERCIAL,
        OTHER,
    }

    public record StaffAccount(
        Long id,
        String login,
        String firstName,
        String lastName,
        String email,
        String phone,
        boolean activated,
        StaffRole role,
        Instant createdDate,
        Instant lastModifiedDate,
        Instant lastLoginAt
    ) {}

    /** On se connecte avec son adresse e-mail : elle est obligatoire et sert aussi d'identifiant. */
    public record CreateStaffRequest(
        @NotBlank(message = "Le prénom est obligatoire") @Size(max = 50) String firstName,
        @Size(max = 50) String lastName,
        @NotBlank(message = "L'adresse e-mail est obligatoire : elle sert à se connecter")
        @Email(message = "Adresse e-mail invalide")
        @Size(max = 50, message = "Adresse e-mail : 50 caractères maximum")
        String email,
        @Size(max = 20, message = "Téléphone : 20 caractères maximum") String phone,
        @NotNull(message = "Le rôle est obligatoire") StaffRole role,
        @NotBlank(message = "Le mot de passe est obligatoire")
        @Size(min = PASSWORD_MIN, max = PASSWORD_MAX, message = "Mot de passe : 8 caractères minimum")
        String password
    ) {}

    public record UpdateStaffRequest(
        @NotBlank(message = "Le prénom est obligatoire") @Size(max = 50) String firstName,
        @Size(max = 50) String lastName,
        @NotBlank(message = "L'adresse e-mail est obligatoire : elle sert à se connecter")
        @Email(message = "Adresse e-mail invalide")
        @Size(max = 254)
        String email,
        @Size(max = 20, message = "Téléphone : 20 caractères maximum") String phone,
        @NotNull(message = "Le rôle est obligatoire") StaffRole role,
        boolean activated
    ) {}

    public record ResetPasswordRequest(
        @NotBlank(message = "Le mot de passe est obligatoire")
        @Size(min = PASSWORD_MIN, max = PASSWORD_MAX, message = "Mot de passe : 8 caractères minimum")
        String password
    ) {}
}
