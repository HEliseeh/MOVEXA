package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.SubscriptionFreeze;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubscriptionFreezeRepository extends JpaRepository<SubscriptionFreeze, Long> {
    @Query("select f from SubscriptionFreeze f join fetch f.subscription s where s.member.id = :memberId order by f.createdAt desc")
    List<SubscriptionFreeze> findAllByMemberId(@Param("memberId") Long memberId);
}
