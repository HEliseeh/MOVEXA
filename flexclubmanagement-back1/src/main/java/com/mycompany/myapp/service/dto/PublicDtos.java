package com.mycompany.myapp.service.dto;

import com.mycompany.myapp.domain.enumeration.PaymentMethod;
import com.mycompany.myapp.domain.enumeration.PaymentStatus;
import com.mycompany.myapp.domain.enumeration.SubscriptionState;
import java.time.Instant;
import java.time.LocalDate;

/** Données visibles sans connexion : le strict nécessaire, sans téléphone ni notes. */
public final class PublicDtos {

    private PublicDtos() {}

    /** Carte du membre : son nom, sa date de fin et le QR code présenté à l'accueil. */
    public record PublicCardDTO(
        String firstName,
        String lastName,
        String memberNumber,
        String gymName,
        LocalDate endDate,
        SubscriptionState state,
        String qrToken
    ) {}

    /** Reçu partagé. cardToken mène à la carte du membre (bouton « Mon QR code »). */
    public record PublicReceiptDTO(
        String number,
        PaymentStatus status,
        Instant paidAt,
        Long amount,
        Long registrationFee,
        PaymentMethod method,
        String memberName,
        String planName,
        LocalDate validFrom,
        LocalDate validTo,
        String agent,
        String gymName,
        String gymAddress,
        String gymPhone,
        String footer,
        String cardToken
    ) {}
}
