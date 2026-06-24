package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.CalorieDayResponse;
import com.alper.saglikasistani.dto.MacroSummaryResponse;
import com.alper.saglikasistani.dto.ProgressResponse;
import com.alper.saglikasistani.dto.WeightPointResponse;
import com.alper.saglikasistani.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/{userId}/weights")
    public ResponseEntity<List<WeightPointResponse>> kiloSerisi(@PathVariable Long userId) {
        return ResponseEntity.ok(reportService.kiloSerisi(userId));
    }

    @GetMapping("/{userId}/calories/last7days")
    public ResponseEntity<List<CalorieDayResponse>> son7GunKalori(@PathVariable Long userId) {
        return ResponseEntity.ok(reportService.son7GunKalori(userId));
    }

    @GetMapping("/{userId}/macros/last7days")
    public ResponseEntity<MacroSummaryResponse> son7GunMakro(@PathVariable Long userId) {
        return ResponseEntity.ok(reportService.son7GunMakro(userId));
    }

    @GetMapping("/{userId}/progress")
    public ResponseEntity<ProgressResponse> hedefIlerleme(@PathVariable Long userId) {
        return ResponseEntity.ok(reportService.hedefIlerleme(userId));
    }
}
