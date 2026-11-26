package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.Course;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, Long> {
    List<Course> findAllByOrderByActiveDescNameAsc();
}
