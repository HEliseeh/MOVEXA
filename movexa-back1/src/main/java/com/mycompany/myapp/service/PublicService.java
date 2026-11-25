package com.mycompany.myapp.service;

import com.mycompany.myapp.domain.GymSettings;
import com.mycompany.myapp.domain.Member;
import com.mycompany.myapp.domain.Payment;
import com.mycompany.myapp.domain.Subscription;
import com.mycompany.myapp.domain.enumeration.PaymentMethod;
import com.mycompany.myapp.domain.enumeration.PaymentStatus;
import com.mycompany.myapp.repository.MemberRepository;
import com.mycompany.myapp.repository.PaymentRepository;
import com.mycompany.myapp.service.dto.PublicDtos.PublicCardDTO;
import com.mycompany.myapp.service.dto.PublicDtos.PublicReceiptDTO;
import com.mycompany.myapp.web.rest.errors.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Carte et reçu ouverts par le membre depuis un lien WhatsApp (sans connexion). */
@Service
@Transactional(readOnly = true)
public class PublicService {

    /** Les jetons font 32 caractères hexadécimaux : on refuse le reste sans interroger la base. */
    private static final String TOKEN = "^[a-f0-9]{32}$";

    private final MemberRepository memberRepository;
    private final PaymentRepository paymentRepository;
    private final SettingsService settingsService;

    public PublicService(MemberRepository memberRepository, PaymentRepository paymentRepository, SettingsService settingsService) {
        this.memberRepository = memberRepository;
        this.paymentRepository = paymentRepository;
        this.settingsService = settingsService;
    }

    public PublicCardDTO card(String token) {
        if (token == null || !token.matches(TOKEN)) throw new NotFoundException("Carte introuvable");
        Member m = memberRepository.findOneWithUserByQrTokenAndArchivedFalse(token).orElseThrow(() -> new NotFoundException("Carte introuvable"));
        GymSettings s = settingsService.get();
        return new PublicCardDTO(
            m.getUser().getFirstName(),
            m.getUser().getLastName(),
            m.getMemberNumber(),
            s.getName(),
            m.getExpiryDate(),
            m.getExpiryDate() == null ? null : settingsService.stateOf(m.getExpiryDate()),
            m.getQrToken()
        );
    }

    public PublicReceiptDTO receipt(String token) {
        if (token == null || !token.matches(TOKEN)) throw new NotFoundException("Reçu introuvable");
        Payment p = paymentRepository.findWithDetailsByShareToken(token).orElseThrow(() -> new NotFoundException("Reçu introuvable"));
        GymSettings s = settingsService.get();
        Subscription sub = p.getSubscription();
        Member m = p.getMember();
        return new PublicReceiptDTO(
            p.getReceiptNumber(),
            p.getStatus(),
            p.getPaidAt(),
            p.getAmount(),
            p.getRegistrationFee(),
            p.getMethod(),
            MemberViews.fullName(m),
            p.getPlanName(),
            sub != null ? sub.getStartDate() : null,
            sub != null ? sub.getEndDate() : null,
            p.getMethod() == PaymentMethod.PAYMENT_LINK && p.getTransactionId() != null ? "Paiement en ligne" : p.getCreatedBy(),
            s.getName(),
            s.getAddress(),
            s.getPhone(),
            s.getReceiptFooter(),
            p.getStatus() == PaymentStatus.PAID && !m.isArchived() ? m.getQrToken() : null
        );
    }
}
