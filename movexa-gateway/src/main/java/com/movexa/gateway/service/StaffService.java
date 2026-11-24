package com.movexa.gateway.service;

import com.movexa.gateway.config.Constants;
import com.movexa.gateway.domain.Authority;
import com.movexa.gateway.domain.User;
import com.movexa.gateway.repository.AuthorityRepository;
import com.movexa.gateway.repository.UserRepository;
import com.movexa.gateway.security.AuthoritiesConstants;
import com.movexa.gateway.security.PasswordPolicy;
import com.movexa.gateway.security.SecurityUtils;
import com.movexa.gateway.service.dto.StaffDTOs.*;
import com.movexa.gateway.web.rest.errors.BadRequestAlertException;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * Comptes du personnel : le gérant crée les comptes, choisit le rôle, désactive un compte
 * et remet un mot de passe. Pas d'e-mail envoyé : le gérant transmet lui-même le mot de passe.
 * <p>
 * Garde-fou : le gérant ne peut ni se désactiver ni se retirer le rôle de gérant. Comme seul un gérant
 * peut appeler ces actions, il reste donc toujours au moins un gérant actif.
 * <p>
 * Un changement de rôle ou une désactivation prend effet à la prochaine connexion de la personne
 * (le jeton déjà délivré reste valable jusqu'à son expiration).
 */
@Service
public class StaffService {

    private static final Logger LOG = LoggerFactory.getLogger(StaffService.class);
    private static final String ENTITY = "staff";

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public StaffService(
        UserRepository userRepository,
        AuthorityRepository authorityRepository,
        UserService userService,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.authorityRepository = authorityRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    public Mono<List<StaffAccount>> list() {
        return userRepository
            .findAllWithAuthorities(PageRequest.of(0, 500, Sort.by("login")))
            .map(StaffService::toAccount)
            .collectList();
    }

    @Transactional
    public Mono<StaffAccount> create(CreateStaffRequest req) {
        requireStrong(req.password());
        Set<String> authorities = authoritiesFor(req.role());
        String login = req.login().trim().toLowerCase(Locale.ROOT);
        String email = emailOrNull(req.email());

        Mono<Void> loginFree = userRepository
            .findOneByLogin(login)
            .flatMap(u -> Mono.<Void>error(bad("Cet identifiant est déjà utilisé.", "loginexists")));
        Mono<Void> emailFree = email == null
            ? Mono.empty()
            : userRepository.findOneByEmailIgnoreCase(email).flatMap(u -> Mono.<Void>error(bad("Cette adresse e-mail est déjà utilisée.", "emailexists")));

        return loginFree
            .then(emailFree)
            .then(Mono.fromCallable(() -> passwordEncoder.encode(req.password())).subscribeOn(Schedulers.boundedElastic()))
            .flatMap(hash -> {
                User user = new User();
                user.setLogin(login);
                user.setFirstName(clean(req.firstName()));
                user.setLastName(clean(req.lastName()));
                user.setEmail(email);
                user.setLangKey(Constants.DEFAULT_LANGUAGE);
                user.setActivated(true);
                user.setPassword(hash);
                return withAuthorities(user, authorities);
            })
            .flatMap(userService::saveUser)
            .doOnNext(u -> LOG.info("Compte {} créé ({})", u.getLogin(), req.role()))
            .map(StaffService::toAccount);
    }

    @Transactional
    public Mono<StaffAccount> update(Long id, UpdateStaffRequest req) {
        Set<String> authorities = authoritiesFor(req.role());
        String email = emailOrNull(req.email());

        return findWithAuthorities(id).zipWith(currentLogin()).flatMap(t -> {
            User user = t.getT1();
            boolean self = user.getLogin().equals(t.getT2());
            if (self && !req.activated()) {
                return Mono.error(bad("Vous ne pouvez pas désactiver votre propre compte.", "selfdeactivate"));
            }
            if (self && req.role() != StaffRole.MANAGER) {
                return Mono.error(bad("Vous ne pouvez pas retirer votre propre rôle de gérant.", "selfdemote"));
            }
            Mono<Void> emailFree = email == null
                ? Mono.empty()
                : userRepository
                    .findOneByEmailIgnoreCase(email)
                    .filter(other -> !other.getId().equals(user.getId()))
                    .flatMap(other -> Mono.<Void>error(bad("Cette adresse e-mail est déjà utilisée.", "emailexists")));
            return emailFree.then(
                Mono.defer(() -> {
                    user.setFirstName(clean(req.firstName()));
                    user.setLastName(clean(req.lastName()));
                    user.setEmail(email);
                    user.setActivated(req.activated());
                    user.getAuthorities().clear();
                    return userRepository.deleteUserAuthorities(user.getId()).then(withAuthorities(user, authorities));
                })
            );
        })
            .flatMap(userService::saveUser)
            .doOnNext(u -> LOG.info("Compte {} modifié ({}, actif : {})", u.getLogin(), req.role(), u.isActivated()))
            .map(StaffService::toAccount);
    }

    @Transactional
    public Mono<Void> resetPassword(Long id, ResetPasswordRequest req) {
        requireStrong(req.password());
        // findById ne charge pas les rôles : saveUser n'a donc rien à réinsérer dans jhi_user_authority
        return userRepository
            .findById(id)
            .switchIfEmpty(Mono.error(bad("Compte introuvable.", "notfound")))
            .flatMap(user ->
                Mono.fromCallable(() -> passwordEncoder.encode(req.password()))
                    .subscribeOn(Schedulers.boundedElastic())
                    .map(hash -> {
                        user.setPassword(hash);
                        user.setResetKey(null);
                        user.setResetDate(null);
                        return user;
                    })
            )
            .flatMap(userService::saveUser)
            .doOnNext(u -> LOG.info("Mot de passe du compte {} remis à zéro par le gérant", u.getLogin()))
            .then();
    }

    // ---------------------------------------------------------------------------------------------

    private Mono<User> findWithAuthorities(Long id) {
        return userRepository
            .findById(id)
            .flatMap(u -> userRepository.findOneWithAuthoritiesByLogin(u.getLogin()))
            .switchIfEmpty(Mono.error(bad("Compte introuvable.", "notfound")));
    }

    private Mono<String> currentLogin() {
        return SecurityUtils.getCurrentUserLogin().defaultIfEmpty("");
    }

    private Mono<User> withAuthorities(User user, Set<String> names) {
        return Flux.fromIterable(names)
            .flatMap(authorityRepository::findById)
            .collectList()
            .map(found -> {
                user.getAuthorities().addAll(found);
                return user;
            });
    }

    /** Même règle que pour l'utilisateur qui change son mot de passe (PasswordPolicy) */
    private static void requireStrong(String password) {
        if (!PasswordPolicy.isValid(password)) {
            throw bad(
                "Mot de passe trop faible : 8 caractères minimum, avec une majuscule, un chiffre et un caractère spécial.",
                "weakpassword"
            );
        }
    }

    private static Set<String> authoritiesFor(StaffRole role) {
        return switch (role) {
            case MANAGER -> Set.of(AuthoritiesConstants.ADMIN, AuthoritiesConstants.USER);
            case RECEPTION -> Set.of(AuthoritiesConstants.RECEPTION, AuthoritiesConstants.USER);
            case OTHER -> throw bad("Choisissez le rôle Gérant ou Réceptionniste.", "rolerequired");
        };
    }

    private static StaffAccount toAccount(User u) {
        Set<String> names = u.getAuthorities().stream().map(Authority::getName).collect(java.util.stream.Collectors.toSet());
        StaffRole role = names.contains(AuthoritiesConstants.ADMIN)
            ? StaffRole.MANAGER
            : names.contains(AuthoritiesConstants.RECEPTION) ? StaffRole.RECEPTION : StaffRole.OTHER;
        return new StaffAccount(
            u.getId(),
            u.getLogin(),
            u.getFirstName(),
            u.getLastName(),
            u.getEmail(),
            u.isActivated(),
            role,
            u.getCreatedDate(),
            u.getLastModifiedDate()
        );
    }

    private static String clean(String value) {
        return StringUtils.hasText(value) ? value.trim().replaceAll("\\s+", " ") : null;
    }

    private static String emailOrNull(String email) {
        return StringUtils.hasText(email) ? email.trim().toLowerCase(Locale.ROOT) : null;
    }

    private static BadRequestAlertException bad(String message, String key) {
        return new BadRequestAlertException(message, ENTITY, key);
    }
}
