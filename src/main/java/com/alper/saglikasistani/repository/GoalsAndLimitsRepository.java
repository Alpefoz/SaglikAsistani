package com.alper.saglikasistani.repository;

import com.alper.saglikasistani.entity.GoalsAndLimits;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GoalsAndLimitsRepository extends JpaRepository<GoalsAndLimits, Long> {
    Optional<GoalsAndLimits> findByUserId(Long userId);
}

