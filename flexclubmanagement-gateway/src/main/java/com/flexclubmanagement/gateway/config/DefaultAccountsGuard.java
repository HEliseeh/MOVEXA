package com.flexclubmanagement.gateway.config;

import com.flexclubmanagement.gateway.domain.User;
import com.flexclubmanagement.gateway.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import tech.jhipster.config.JHipsterConstants;

/**
 * Production uniquement : neutralise les comptes de démonstration créés par JHipster.
 * <ul>
 *   <li>le compte « user » (mot de passe « user ») est désactivé ;</li>
 *   <li>si le compte « admin » a encore le mot de passe « admin », il reçoit celui de la variable
 *       d'environnement FLEXCLUBMANAGEMENT_ADMIN_INITIAL_PASSWORD. Sans cette variable, l'application refuse de démarrer.</li>
 * </ul>
 * Une fois le mot de passe admin changé, la variable n'est plus utilisée : un changement fait plus tard
 * dans l'application n'est jamais écrasé.
 */
@Component
@Profile(JHipsterConstants.SPRING_PROFILE_PRODUCTION)
public class DefaultAccountsGuard implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DefaultAccountsGuard.class);

    private static final String ADMIN_LOGIN = "admin";
    private static final String DEFAULT_ADMIN_PASSWORD = "admin";
    private static final String DEMO_LOGIN = "user";
    private static final int MIN_PASSWORD_LENGTH = 10;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String initialAdminPassword;

    public DefaultAccountsGuard(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        @Value("${flexclubmanagement.admin.initial-password:}") String initialAdminPassword
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.initialAdminPassword = initialAdminPassword == null ? "" : initialAdminPassword.trim();
    }

    @Override
    public void run(ApplicationArguments args) {
        disableDemoUser();
        secureAdmin();
    }

    private void disableDemoUser() {
        userRepository
            .findOneByLogin(DEMO_LOGIN)
            .filter(User::isActivated)
            .flatMap(user -> {
                user.setActivated(false);
                user.setLastModifiedBy(Constants.SYSTEM);
                return userRepository.save(user);
            })
            .doOnNext(user -> LOG.warn("Compte de démonstration « {} » désactivé.", DEMO_LOGIN))
            .block();
    }

    private void secureAdmin() {
        User admin = userRepository.findOneByLogin(ADMIN_LOGIN).block();
        if (admin == null || !passwordEncoder.matches(DEFAULT_ADMIN_PASSWORD, admin.getPassword())) {
            return; // mot de passe déjà personnalisé
        }
        if (initialAdminPassword.isEmpty()) {
            throw new IllegalStateException(
                "Le compte « admin » a toujours le mot de passe par défaut. " +
                "Définissez FLEXCLUBMANAGEMENT_ADMIN_INITIAL_PASSWORD (" + MIN_PASSWORD_LENGTH + " caractères minimum) puis redémarrez."
            );
        }
        if (initialAdminPassword.length() < MIN_PASSWORD_LENGTH || DEFAULT_ADMIN_PASSWORD.equalsIgnoreCase(initialAdminPassword)) {
            throw new IllegalStateException(
                "FLEXCLUBMANAGEMENT_ADMIN_INITIAL_PASSWORD est trop faible : " + MIN_PASSWORD_LENGTH + " caractères minimum, et différent de « admin »."
            );
        }
        admin.setPassword(passwordEncoder.encode(initialAdminPassword));
        admin.setLastModifiedBy(Constants.SYSTEM);
        userRepository.save(admin).block();
        LOG.warn("Mot de passe du compte « admin » initialisé depuis FLEXCLUBMANAGEMENT_ADMIN_INITIAL_PASSWORD.");
    }
}
