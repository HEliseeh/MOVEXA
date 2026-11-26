package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.CheckIn;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
    @EntityGraph(attributePaths = { "member", "member.user" })
    Optional<CheckIn> findOneByClientId(String clientId);

    @EntityGraph(attributePaths = { "member", "member.user" })
    List<CheckIn> findAllByCheckedAtBetweenOrderByCheckedAtDesc(Instant from, Instant to);

    List<CheckIn> findAllByMemberIdAndCheckedAtAfterOrderByCheckedAtDesc(Long memberId, Instant after);

    /** Nombre d'entrées autorisées par membre depuis une date : [memberId, nombre]. */
    @Query(
        "select c.member.id, count(c) from CheckIn c where c.checkedAt >= :since " +
        "and c.result not in (com.mycompany.myapp.domain.enumeration.CheckInResult.REFUSED, com.mycompany.myapp.domain.enumeration.CheckInResult.REFUSED_ACTIVITY) group by c.member.id"
    )
    List<Object[]> countAllowedByMemberSince(@Param("since") Instant since);

    /** Entrées autorisées depuis une date (le regroupement par jour se fait en Java, dans le fuseau du Bénin). */
    @Query(
        "select c.checkedAt from CheckIn c where c.checkedAt >= :since " +
        "and c.result not in (com.mycompany.myapp.domain.enumeration.CheckInResult.REFUSED, com.mycompany.myapp.domain.enumeration.CheckInResult.REFUSED_ACTIVITY)"
    )
    List<Instant> findAllowedTimesSince(@Param("since") Instant since);

    /** Entrées autorisées avec une activité, sur une période : [activityId, memberId, checkedAt] (présence aux cours) */
    @Query(
        "select c.activity.id, c.member.id, c.checkedAt from CheckIn c where c.checkedAt >= :from and c.checkedAt < :to " +
        "and c.activity is not null and c.result not in (com.mycompany.myapp.domain.enumeration.CheckInResult.REFUSED, com.mycompany.myapp.domain.enumeration.CheckInResult.REFUSED_ACTIVITY)"
    )
    List<Object[]> findActivityEntriesBetween(@Param("from") Instant from, @Param("to") Instant to);
}
