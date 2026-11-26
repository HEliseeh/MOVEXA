package com.mycompany.myapp.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** Gel d'un abonnement : la fin est repoussée de « days » jours (voyage, blessure…). */
@Getter
@Setter
@Entity
@Table(name = "subscription_freeze")
public class SubscriptionFreeze implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subscription_id")
    private Subscription subscription;

    @Column(name = "days", nullable = false)
    private int days;

    @Column(name = "reason", length = 200)
    private String reason;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
