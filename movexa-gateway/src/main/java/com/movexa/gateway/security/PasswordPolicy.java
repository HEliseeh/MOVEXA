package com.movexa.gateway.security;

import java.util.regex.Pattern;

/**
 * Règles d'un nouveau mot de passe (inscription, changement, réinitialisation) :
 * au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.
 * Le front applique les mêmes règles (movexa-front, features/auth/password-policy.ts).
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;

    public static final int MAX_LENGTH = 100;

    private static final Pattern UPPERCASE = Pattern.compile("\\p{Lu}");

    private static final Pattern DIGIT = Pattern.compile("\\p{Nd}");

    /** Tout ce qui n'est ni une lettre, ni un chiffre, ni un espace : ! @ # - _ . € … */
    private static final Pattern SPECIAL = Pattern.compile("[^\\p{L}\\p{N}\\s]");

    private PasswordPolicy() {}

    public static boolean isValid(String password) {
        return (
            password != null &&
            password.length() >= MIN_LENGTH &&
            password.length() <= MAX_LENGTH &&
            UPPERCASE.matcher(password).find() &&
            DIGIT.matcher(password).find() &&
            SPECIAL.matcher(password).find()
        );
    }
}
