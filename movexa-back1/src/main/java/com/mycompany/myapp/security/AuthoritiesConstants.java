package com.mycompany.myapp.security;

/**
 * Constants for Spring Security authorities.
 */
public final class AuthoritiesConstants {

    public static final String ADMIN = "ROLE_ADMIN";

    public static final String USER = "ROLE_USER";

    /** Réceptionniste : inscrit, encaisse, pointe. Le gérant de la salle a ROLE_ADMIN. */
    public static final String RECEPTION = "ROLE_RECEPTION";

    /** Expression @PreAuthorize réservant une action au gérant. */
    public static final String IS_MANAGER = "hasAuthority('ROLE_ADMIN')";

    /** Personnel de la salle : gérant ou réceptionniste. Seuls ces rôles accèdent à l'API métier. */
    public static final String[] STAFF = { ADMIN, RECEPTION };

    public static final String ANONYMOUS = "ROLE_ANONYMOUS";

    private AuthoritiesConstants() {}
}
