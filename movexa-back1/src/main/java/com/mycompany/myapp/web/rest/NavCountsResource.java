package com.mycompany.myapp.web.rest;

import com.mycompany.myapp.repository.MemberRepository;
import com.mycompany.myapp.service.MemberViews;
import com.mycompany.myapp.service.ProspectService;
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
     */
    public record NavCounts(long prospectsToday, long expiringSoon) {}

    private final ProspectService prospectService;
    private final MemberRepository memberRepository;
    private final MemberViews views;

    public NavCountsResource(ProspectService prospectService, MemberRepository memberRepository, MemberViews views) {
        this.prospectService = prospectService;
        this.memberRepository = memberRepository;
        this.views = views;
    }

    @GetMapping("")
    @Transactional(readOnly = true)
    public NavCounts counts() {
        LocalDate today = LocalDate.now();
        return new NavCounts(
            prospectService.list("TODAY").size(),
            memberRepository.countByArchivedFalseAndExpiryDateBetween(today, today.plusDays(views.threshold()))
        );
    }
}
