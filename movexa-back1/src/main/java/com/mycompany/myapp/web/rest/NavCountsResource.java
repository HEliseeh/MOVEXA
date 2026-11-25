package com.mycompany.myapp.web.rest;

import com.mycompany.myapp.domain.enumeration.PaymentMethod;
import com.mycompany.myapp.domain.enumeration.PaymentStatus;
import com.mycompany.myapp.repository.MemberRepository;
import com.mycompany.myapp.repository.PaymentRepository;
import com.mycompany.myapp.service.MemberViews;
import com.mycompany.myapp.service.ProspectService;
import com.mycompany.myapp.service.ReminderService;
import com.mycompany.myapp.service.util.Dates;
import java.time.LocalDate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pastilles du menu latéral : ce qui attend une action aujourd'hui.
 * Appelé à chaque changement de page, donc volontairement léger.
 */
@RestController
@RequestMapping("/api/nav-counts")
public class NavCountsResource {

    /**
     * @param prospectsToday prospects à relancer aujourd'hui (Clients › Prospects)
     * @param expiringSoon   abonnements qui finissent dans le seuil « expire bientôt » (Abonnements et échéances)
     * @param remindersToSend relances de membres à envoyer aujourd'hui (enveloppe de la barre du haut)
     * @param pendingLinks   liens de paiement envoyés, pas encore payés
     */
    public record NavCounts(long prospectsToday, long expiringSoon, long remindersToSend, long pendingLinks) {}

    private final ProspectService prospectService;
    private final MemberRepository memberRepository;
    private final MemberViews views;
    private final ReminderService reminderService;
    private final PaymentRepository paymentRepository;

    public NavCountsResource(
        ProspectService prospectService,
        MemberRepository memberRepository,
        MemberViews views,
        ReminderService reminderService,
        PaymentRepository paymentRepository
    ) {
        this.prospectService = prospectService;
        this.memberRepository = memberRepository;
        this.views = views;
        this.reminderService = reminderService;
        this.paymentRepository = paymentRepository;
    }

    @GetMapping("")
    @Transactional(readOnly = true)
    public NavCounts counts() {
        LocalDate today = Dates.today();
        return new NavCounts(
            prospectService.list("TODAY").size(),
            memberRepository.countByArchivedFalseAndExpiryDateBetween(today, today.plusDays(views.threshold())),
            reminderService.queue().size(),
            paymentRepository.countByStatusAndMethod(PaymentStatus.PENDING, PaymentMethod.PAYMENT_LINK)
        );
    }
}
