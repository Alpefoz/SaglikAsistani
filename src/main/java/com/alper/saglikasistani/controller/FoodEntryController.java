package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.FoodEntryRequest;
import com.alper.saglikasistani.dto.FoodEntryResponse;
import com.alper.saglikasistani.service.FoodEntryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/food-entries")
@RequiredArgsConstructor
public class FoodEntryController {

    private final FoodEntryService foodEntryService;

    @PostMapping
    public ResponseEntity<FoodEntryResponse> ekle(@RequestBody FoodEntryRequest request) {
        return ResponseEntity.ok(foodEntryService.ekle(request));
    }

    @GetMapping("/{dailyLogId}")
    public ResponseEntity<List<FoodEntryResponse>> gunlukLogaGoreGetir(@PathVariable Long dailyLogId) {
        return ResponseEntity.ok(foodEntryService.gunlukLogaGoreGetir(dailyLogId));
    }

    @PatchMapping("/{entryId}")
    public ResponseEntity<FoodEntryResponse> guncelle(
            @PathVariable Long entryId,
            @RequestParam Double miktar) {
        return ResponseEntity.ok(foodEntryService.guncelle(entryId, miktar));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> sil(@PathVariable Long entryId) {
        foodEntryService.sil(entryId);
        return ResponseEntity.noContent().build();
    }
}
