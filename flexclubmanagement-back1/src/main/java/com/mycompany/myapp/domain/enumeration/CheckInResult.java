package com.mycompany.myapp.domain.enumeration;

/** Réponse donnée à l'accueil : vert, orange ou rouge. */
public enum CheckInResult {
    ALLOWED,
    ALLOWED_EXPIRING,
    /** Abonnement expiré ou inexistant */
    REFUSED,
    /** Abonnement valable, mais l'activité demandée n'est pas incluse dans la formule */
    REFUSED_ACTIVITY;

    /** Le membre n'est pas entré (rouge à l'accueil) */
    public boolean isRefused() {
        return this == REFUSED || this == REFUSED_ACTIVITY;
    }
}
