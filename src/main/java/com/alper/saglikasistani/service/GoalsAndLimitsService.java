package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.GoalsAndLimitsRequest;
import com.alper.saglikasistani.dto.GoalsAndLimitsResponse;
import com.alper.saglikasistani.entity.GoalsAndLimits;
import com.alper.saglikasistani.repository.GoalsAndLimitsRepository;
import com.alper.saglikasistani.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class GoalsAndLimitsService {

    private final GoalsAndLimitsRepository goalsAndLimitsRepository;
    private final UserRepository userRepository;

    public GoalsAndLimitsResponse kaydet(GoalsAndLimitsRequest request) {
        var user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));

        var now = LocalDateTime.now();

        GoalsAndLimits record = goalsAndLimitsRepository.findByUserId(request.getUserId())
                .orElse(GoalsAndLimits.builder()
                        .user(user)
                        .createdAt(now)
                        .build());

        record.setGunlukHedefKalori(request.getGunlukHedefKalori());
        record.setUpdatedAt(now);

        var saved = goalsAndLimitsRepository.save(record);
        return toResponse(saved);
    }

    public GoalsAndLimitsResponse getir(Long userId) {
        var record = goalsAndLimitsRepository.findByUserId(userId)
                .orElse(null);

        if (record == null) {
            // Default: 2000 kcal
            var user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));
            var now = LocalDateTime.now();
            record = goalsAndLimitsRepository.save(GoalsAndLimits.builder()
                    .user(user)
                    .gunlukHedefKalori(2000)
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        }

        return toResponse(record);
    }

    private GoalsAndLimitsResponse toResponse(GoalsAndLimits g) {
        return GoalsAndLimitsResponse.builder()
                .id(g.getId())
                .userId(g.getUser().getId())
                .gunlukHedefKalori(g.getGunlukHedefKalori())
                .build();
    }
}

