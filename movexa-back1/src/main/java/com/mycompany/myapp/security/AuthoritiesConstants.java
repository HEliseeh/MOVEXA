package com.mycompany.myapp.security;

/**
 * Constants for Spring Security authorities.
 */
public final class AuthoritiesConstants {

    public static final String ADMIN = "ROLE_ADMIN";

    public static final String USER = "ROLE_USER";

    /** Réceptionniste : inscrit, encaisse, pointe. Le gérant de la salle a ROLE_ADMIN. */
    public static final String RECEPTION = "ROLE_RECEPTION";

    /** Commercial : membres, prospects, relances, statistiques commerciales. N'encaisse pas, ne pointe pas. */
    public static final String COMMERCIAL = "ROLE_COMMERCIAL";

    /** Expression @PreAuthorize réservant une action au gérant. */
    public static final String IS_MANAGER = "hasAuthority('ROLE_ADMIN')";

    /** Expression @PreAuthorize pour le travail à l'accueil (pointage, encaissement, caisse) : gérant ou réceptionniste. */
    public static final String IS_DESK = "hasAnyAuthority('ROLE_ADMIN','ROLE_RECEPTION')";

    /** Personnel de la salle : seuls ces rôles accèdent à l'API métier. */
    public static final String[] STAFF = { ADMIN, RECEPTION, COMMERCIAL };

    public static final String ANONYMOUS = "ROLE_ANONYMOUS";

    private AuthoritiesConstants() {}
}
