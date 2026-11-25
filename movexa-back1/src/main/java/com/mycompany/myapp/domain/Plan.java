package com.mycompany.myapp.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;

/** Formule d'abonnement vendue par la salle (séance, semaine, mois…), prix en FCFA. */
@Getter
@Setter
@Entity
@Table(name = "plan")
public class Plan implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @NotNull
    @Min(0)
    @Column(name = "price", nullable = false)
    private Long price;

    /** Durée en jours ; 0 = valable le jour même (séance unique). */
    @NotNull
    @Min(0)
    @Column(name = "duration_days", nullable = false)
    private Integer durationDays;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /** Frais d'inscription ajoutés au prix quand c'est la première formule du membre (0 = aucun). */
    @NotNull
    @Min(0)
    @Column(name = "registration_fee", nullable = false)
    private Long registrationFee = 0L;

    /** Le membre peut suspendre (geler) son abonnement, par exemple pendant un voyage. */
    @Column(name = "freeze_allowed", nullable = false)
    private boolean freezeAllowed = false;

    /** Activités incluses, vérifiées à chaque pointage. */
    @ManyToMany
    @JoinTable(name = "plan_activity", joinColumns = @JoinColumn(name = "plan_id"), inverseJoinColumns = @JoinColumn(name = "activity_id"))
    private Set<Activity> activities = new LinkedHashSet<>();
}
