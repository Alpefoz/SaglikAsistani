package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.UserPhysicalInfoRequest;
import com.alper.saglikasistani.dto.UserPhysicalInfoResponse;
import com.alper.saglikasistani.service.UserPhysicalInfoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/physical-info")
@RequiredArgsConstructor
public class UserPhysicalInfoController {

    private final UserPhysicalInfoService userPhysicalInfoService;

    @PostMapping
    public ResponseEntity<UserPhysicalInfoResponse> kaydet(@RequestBody UserPhysicalInfoRequest request) {
        return ResponseEntity.ok(userPhysicalInfoService.kaydet(request));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserPhysicalInfoResponse> getir(@PathVariable Long userId) {
        return ResponseEntity.ok(userPhysicalInfoService.getir(userId));
    }
}