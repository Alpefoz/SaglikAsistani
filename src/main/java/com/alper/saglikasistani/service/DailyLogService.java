package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.DailyLogRequest;
import com.alper.saglikasistani.dto.DailyLogResponse;
import com.alper.saglikasistani.dto.DailyLogUpdateRequest;
import com.alper.saglikasistani.entity.DailyLog;
import com.alper.saglikasistani.entity.User;
import com.alper.saglikasistani.repository.DailyLogRepository;
import com.alper.saglikasistani.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DailyLogService {

    private final DailyLogRepository dailyLogRepository;
    private final UserRepository userRepository;

    public DailyLogResponse olustur(DailyLogRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));

        DailyLog log = dailyLogRepository
                .findByUserIdAndTarih(request.getUserId(), request.getTarih())
                .orElse(DailyLog.builder()
                        .user(user)
                        .tarih(request.getTarih())
                        .toplamAlinanKalori(0)
                        .toplamProtein(0.0)
                        .createdAt(LocalDateTime.now())
                        .build());

        log.setGuncelKilo(request.getGuncelKilo());
        log.setIcilenSuMiktari(request.getIcilenSuMiktari());

        DailyLog saved = dailyLogRepository.save(log);
        return toResponse(saved);
    }

    public List<DailyLogResponse> kullanicininLoglari(Long userId) {
        return dailyLogRepository.findByUserIdOrderByTarihDesc(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public DailyLogResponse bugunGetirVeyaOlustur(Long userId) {
        var today = java.time.LocalDate.now();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));

        DailyLog log = dailyLogRepository
                .findByUserIdAndTarih(userId, today)
                .orElseGet(() -> dailyLogRepository.save(DailyLog.builder()
                        .user(user)
                        .tarih(today)
                        .guncelKilo(null)
                        .icilenSuMiktari(0)
                        .toplamAlinanKalori(0)
                        .toplamProtein(0.0)
                        .createdAt(LocalDateTime.now())
                        .build()));

        return toResponse(log);
    }

    public DailyLogResponse guncelle(Long logId, DailyLogUpdateRequest request) {
        DailyLog log = dailyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Günlük kayıt bulunamadı!"));

        if (request.getGuncelKilo() != null) {
            log.setGuncelKilo(request.getGuncelKilo());
        }
        if (request.getIcilenSuMiktari() != null) {
            log.setIcilenSuMiktari(Math.max(0, request.getIcilenSuMiktari()));
        }

        DailyLog saved = dailyLogRepository.save(log);
        return toResponse(saved);
    }

    public DailyLogResponse suEkle(Long logId, int deltaMl) {
        DailyLog log = dailyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Günlük kayıt bulunamadı!"));

        int current = log.getIcilenSuMiktari() == null ? 0 : log.getIcilenSuMiktari();
        int updated = Math.max(0, current + deltaMl);
        log.setIcilenSuMiktari(updated);

        DailyLog saved = dailyLogRepository.save(log);
        return toResponse(saved);
    }

    private DailyLogResponse toResponse(DailyLog log) {
        return DailyLogResponse.builder()
                .id(log.getId())
                .userId(log.getUser().getId())
                .tarih(log.getTarih())
                .guncelKilo(log.getGuncelKilo())
                .icilenSuMiktari(log.getIcilenSuMiktari())
                .toplamAlinanKalori(log.getToplamAlinanKalori())
                .toplamProtein(log.getToplamProtein())
                .build();
    }
}