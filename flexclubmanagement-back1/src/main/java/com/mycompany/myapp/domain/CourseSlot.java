package com.mycompany.myapp.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.LocalTime;
import lombok.Getter;
import lombok.Setter;

/** Créneau hebdomadaire d'un cours : chaque lundi à 18:00, par exemple. Salle et coach facultatifs (sinon ceux du cours). */
@Getter
@Setter
@Entity
@Table(name = "course_slot")
public class CourseSlot implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id")
    private Course course;

    /** 1 = lundi … 7 = dimanche */
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "room", length = 60)
    private String room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    private Coach coach;
}
