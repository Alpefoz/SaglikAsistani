package com.alper.saglikasistani.repository;

import com.alper.saglikasistani.entity.FoodEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FoodEntryRepository extends JpaRepository<FoodEntry, Long> {
    List<FoodEntry> findByDailyLogIdOrderByCreatedAtDesc(Long dailyLogId);
    List<FoodEntry> findByDailyLog_User_IdAndDailyLog_TarihBetween(
        Long userId,
        java.time.LocalDate from,
        java.time.LocalDate to
    );
}
