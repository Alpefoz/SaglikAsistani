package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.AiFoodItemResponse;
import com.alper.saglikasistani.service.PhotoAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class PhotoAnalysisController {

    private final PhotoAnalysisService photoAnalysisService;

    @PostMapping("/analyze-food")
    public ResponseEntity<?> analyzeFood(@RequestParam("image") MultipartFile image) {
        try {
            String result = photoAnalysisService.analyzeFood(image);
            return ResponseEntity.ok(Map.of("result", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/analyze-food-items")
    public ResponseEntity<?> analyzeFoodItems(@RequestParam("image") MultipartFile image,
                                              @RequestParam(value = "mode", defaultValue = "auto") String mode) {
        try {
            List<AiFoodItemResponse> items = photoAnalysisService.analyzeFoodItems(image, mode);
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Yemek adından besin değeri tahmini (DB'de bulunamayan yemekler için)
    @PostMapping("/suggest-nutrition")
    public ResponseEntity<?> suggestNutrition(@RequestBody Map<String, String> body) {
        try {
            String foodName = body.get("foodName");
            if (foodName == null || foodName.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "foodName boş olamaz"));
            }
            AiFoodItemResponse result = photoAnalysisService.suggestNutrition(foodName);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
