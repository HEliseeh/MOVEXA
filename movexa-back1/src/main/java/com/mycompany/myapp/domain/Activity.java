package com.mycompany.myapp.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import lombok.Getter;
import lombok.Setter;

/**
 * Activité de la salle (musculation et cardio, cours collectifs, sauna…).
 * Chaque formule inclut certaines activités ; le pointage vérifie que l'activité est incluse.
 * Une activité retirée (active = false) n'est plus proposée mais reste dans l'historique.
 */
@Getter
@Setter
@Entity
@Table(name = "activity")
public class Activity implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 60)
    @Column(name = "name", length = 60, nullable = false, unique = true)
    private String name;

    /** Ordre d'affichage */
    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
