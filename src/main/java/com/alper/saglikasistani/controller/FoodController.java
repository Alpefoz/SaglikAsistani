package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.BarcodeProductResponse;
import com.alper.saglikasistani.dto.FoodRequest;
import com.alper.saglikasistani.dto.FoodResponse;
import com.alper.saglikasistani.service.FoodBarcodeService;
import com.alper.saglikasistani.service.FoodService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/foods")
@RequiredArgsConstructor
public class FoodController {

    private final FoodService foodService;
    private final FoodBarcodeService foodBarcodeService;

    @PostMapping
    public ResponseEntity<FoodResponse> ekle(@RequestBody FoodRequest request) {
        return ResponseEntity.ok(foodService.ekle(request));
    }

    @GetMapping
    public ResponseEntity<List<FoodResponse>> tumBesinleriGetir() {
        return ResponseEntity.ok(foodService.tumBesinleriGetir());
    }

    @GetMapping("/ara")
    public ResponseEntity<List<FoodResponse>> adaGoreAra(@RequestParam String yemekAdi) {
        return ResponseEntity.ok(foodService.adaGoreAra(yemekAdi));
    }

    /** Barkod: Open Facts zinciri → yoksa veya eksik makroda AI tamamlama. */
    @GetMapping("/barcode/{code}")
    public ResponseEntity<BarcodeProductResponse> barkoddanGetir(@PathVariable String code) {
        return ResponseEntity.ok(foodBarcodeService.cozumle(code));
    }
}
