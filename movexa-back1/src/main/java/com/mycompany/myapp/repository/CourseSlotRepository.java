package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.CourseSlot;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CourseSlotRepository extends JpaRepository<CourseSlot, Long> {
    @Query("select s from CourseSlot s join fetch s.course c order by s.dayOfWeek, s.startTime")
    List<CourseSlot> findAllWithCourse();
}
