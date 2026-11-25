package com.movexa.gateway.security;

/**
 * Constants for Spring Security authorities.
 */
public final class AuthoritiesConstants {

    public static final String ADMIN = "ROLE_ADMIN";

    public static final String SUPER_ADMIN = "ROLE_SUPER_USER";

    public static final String USER = "ROLE_USER";

    /** Réceptionniste de la salle (le gérant a ROLE_ADMIN) */
    public static final String RECEPTION = "ROLE_RECEPTION";

    /** Commercial : membres, prospects, relances et statistiques commerciales (n'encaisse pas, ne pointe pas) */
    public static final String COMMERCIAL = "ROLE_COMMERCIAL";
    
    public static final String COACH = "ROLE_COACH";
    
    public static final String MENBER = "ROLE_MEMBER";

    public static final String ANONYMOUS = "ROLE_ANONYMOUS";

    private AuthoritiesConstants() {}
}
