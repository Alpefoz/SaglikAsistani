package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.GoalsAndLimitsRequest;
import com.alper.saglikasistani.dto.GoalsAndLimitsResponse;
import com.alper.saglikasistani.service.GoalsAndLimitsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class GoalsAndLimitsController {

    private final GoalsAndLimitsService goalsAndLimitsService;

    @PostMapping
    public ResponseEntity<GoalsAndLimitsResponse> kaydet(@RequestBody GoalsAndLimitsRequest request) {
        return ResponseEntity.ok(goalsAndLimitsService.kaydet(request));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<GoalsAndLimitsResponse> getir(@PathVariable Long userId) {
        return ResponseEntity.ok(goalsAndLimitsService.getir(userId));
    }
}
