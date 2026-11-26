package com.mycompany.myapp.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** Photo facultative du membre (aide l'accueil à le reconnaître). Une ligne par membre. */
@Getter
@Setter
@Entity
@Table(name = "member_photo")
public class MemberPhoto implements Serializable {

    private static final long serialVersionUID = 1L;

    /** Même identifiant que le membre */
    @Id
    @Column(name = "member_id")
    private Long memberId;

    @Column(name = "data", nullable = false)
    private byte[] data;

    @Column(name = "content_type", length = 50, nullable = false)
    private String contentType;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
