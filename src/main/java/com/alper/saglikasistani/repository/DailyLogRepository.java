package com.alper.saglikasistani.repository;

import com.alper.saglikasistani.entity.DailyLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyLogRepository extends JpaRepository<DailyLog, Long> {
    Optional<DailyLog> findByUserIdAndTarih(Long userId, LocalDate tarih);
    List<DailyLog> findByUserIdOrderByTarihDesc(Long userId);
}