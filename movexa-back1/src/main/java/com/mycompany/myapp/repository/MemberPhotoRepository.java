package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.MemberPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberPhotoRepository extends JpaRepository<MemberPhoto, Long> {}
