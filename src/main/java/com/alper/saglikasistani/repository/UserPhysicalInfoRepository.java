package com.alper.saglikasistani.repository;

import com.alper.saglikasistani.entity.UserPhysicalInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserPhysicalInfoRepository extends JpaRepository<UserPhysicalInfo, Long> {
    Optional<UserPhysicalInfo> findByUserId(Long userId);
    Optional<UserPhysicalInfo> findTopByUserIdOrderByUpdatedAtDesc(Long userId);
    List<UserPhysicalInfo> findAllByUserIdOrderByUpdatedAtDesc(Long userId);
}