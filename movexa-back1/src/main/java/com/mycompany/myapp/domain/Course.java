package com.mycompany.myapp.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** Cours collectif de la salle (Zumba, cardio-boxe…). Ses créneaux hebdomadaires sont dans CourseSlot. */
@Getter
@Setter
@Entity
@Table(name = "course")
public class Course implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 80)
    @Column(name = "name", length = 80, nullable = false)
    private String name;

    /** Niveau ou intensité : « Tous niveaux · intense », « Débutants bienvenus »… */
    @Size(max = 120)
    @Column(name = "description", length = 120)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    private Coach coach;

    /** Activité pointée pour ce cours : sert à compter les présents */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id")
    private Activity activity;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes = 60;

    @Column(name = "capacity", nullable = false)
    private int capacity = 20;

    @Size(max = 60)
    @Column(name = "room", length = 60)
    private String room;

    /** Couleur de la case dans le planning (clé de la palette du front) */
    @Column(name = "color", length = 20, nullable = false)
    private String color = "mint";

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
