package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.DailyLogRequest;
import com.alper.saglikasistani.dto.DailyLogResponse;
import com.alper.saglikasistani.dto.DailyLogUpdateRequest;
import com.alper.saglikasistani.service.DailyLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/daily-logs")
@RequiredArgsConstructor
public class DailyLogController {

    private final DailyLogService dailyLogService;

    @PostMapping
    public ResponseEntity<DailyLogResponse> olustur(@RequestBody DailyLogRequest request) {
        return ResponseEntity.ok(dailyLogService.olustur(request));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<DailyLogResponse>> kullanicininLoglari(@PathVariable Long userId) {
        return ResponseEntity.ok(dailyLogService.kullanicininLoglari(userId));
    }

    @GetMapping("/{userId}/today")
    public ResponseEntity<DailyLogResponse> bugunGetirVeyaOlustur(@PathVariable Long userId) {
        return ResponseEntity.ok(dailyLogService.bugunGetirVeyaOlustur(userId));
    }

    @PatchMapping("/{logId}")
    public ResponseEntity<DailyLogResponse> guncelle(@PathVariable Long logId,
                                                    @RequestBody DailyLogUpdateRequest request) {
        return ResponseEntity.ok(dailyLogService.guncelle(logId, request));
    }

    @PostMapping("/{logId}/water")
    public ResponseEntity<DailyLogResponse> suEkle(@PathVariable Long logId,
                                                  @RequestParam int deltaMl) {
        return ResponseEntity.ok(dailyLogService.suEkle(logId, deltaMl));
    }
}