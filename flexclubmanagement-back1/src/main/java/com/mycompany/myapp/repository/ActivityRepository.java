package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.Activity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    List<Activity> findAllByOrderByPositionAscIdAsc();

    Optional<Activity> findOneByNameIgnoreCase(String name);
}
