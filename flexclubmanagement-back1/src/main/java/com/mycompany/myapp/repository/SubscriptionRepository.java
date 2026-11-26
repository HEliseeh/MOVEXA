package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.Subscription;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    List<Subscription> findAllByMemberIdOrderByStartDateDesc(Long memberId);

    /** La période valide la plus lointaine : c'est elle qui fixe la date de fin du membre. */
    Optional<Subscription> findFirstByMemberIdAndCancelledFalseOrderByEndDateDesc(Long memberId);

    /**
     * Abonnements arrivés à échéance sur une période : [id, nombre de périodes payées ensuite par le même membre].
     * Un abonnement est « renouvelé » quand une période qui commence après lui existe.
     */
    @Query(
        "select s.id, (select count(n) from Subscription n where n.member = s.member and n.cancelled = false and n.startDate > s.startDate) " +
        "from Subscription s where s.cancelled = false and s.endDate between :from and :to"
    )
    List<Object[]> findDueWithRenewals(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
