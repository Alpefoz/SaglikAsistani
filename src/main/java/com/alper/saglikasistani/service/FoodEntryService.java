package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.FoodEntryRequest;
import com.alper.saglikasistani.dto.FoodEntryResponse;
import com.alper.saglikasistani.entity.FoodEntry;
import com.alper.saglikasistani.repository.DailyLogRepository;
import com.alper.saglikasistani.repository.FoodEntryRepository;
import com.alper.saglikasistani.repository.FoodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FoodEntryService {

    private final FoodEntryRepository foodEntryRepository;
    private final DailyLogRepository dailyLogRepository;
    private final FoodRepository foodRepository;

    public FoodEntryResponse ekle(FoodEntryRequest request) {
        var dailyLog = dailyLogRepository.findById(request.getDailyLogId())
                .orElseThrow(() -> new RuntimeException("Günlük kayıt bulunamadı!"));

        var food = foodRepository.findById(request.getFoodId())
                .orElseThrow(() -> new RuntimeException("Besin bulunamadı!"));

        boolean ozellesti = request.getOzellestirilenBirimKalori() != null;
        double birimK = ozellesti ? request.getOzellestirilenBirimKalori() : food.getBirimKalori();
        double birimP = ozellesti
                ? nz(request.getOzellestirilenBirimProtein())
                : nz(food.getBirimProtein());
        double birimKr = ozellesti
                ? nz(request.getOzellestirilenBirimKarb())
                : nz(food.getBirimKarb());
        double birimY = ozellesti
                ? nz(request.getOzellestirilenBirimYag())
                : nz(food.getBirimYag());

        var toplamKalori = (int) Math.round(birimK * request.getMiktar());
        var toplamProtein = birimP * request.getMiktar();
        var toplamKarb = birimKr * request.getMiktar();
        var toplamYag = birimY * request.getMiktar();

        String aciklama = normalizeAciklama(request.getAciklama());

        var entry = FoodEntry.builder()
                .dailyLog(dailyLog)
                .food(food)
                .ogunTipi(request.getOgunTipi())
                .miktar(request.getMiktar())
                .aciklama(aciklama)
                .toplamKalori(toplamKalori)
                .toplamProtein(toplamProtein)
                .toplamKarb(toplamKarb)
                .toplamYag(toplamYag)
                .createdAt(LocalDateTime.now())
                .build();

        var saved = foodEntryRepository.save(entry);
        return toResponse(saved);
    }

    public List<FoodEntryResponse> gunlukLogaGoreGetir(Long dailyLogId) {
        return foodEntryRepository.findByDailyLogIdOrderByCreatedAtDesc(dailyLogId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public FoodEntryResponse guncelle(Long entryId, Double yeniMiktar) {
        var entry = foodEntryRepository.findById(entryId)
                .orElseThrow(() -> new RuntimeException("Kayıt bulunamadı!"));

        var food = entry.getFood();

        // Yeni miktara göre yeniden hesapla
        entry.setMiktar(yeniMiktar);
        entry.setToplamKalori((int) (food.getBirimKalori() * yeniMiktar));
        entry.setToplamProtein(food.getBirimProtein() != null ? food.getBirimProtein() * yeniMiktar : 0.0);
        entry.setToplamKarb(food.getBirimKarb() != null ? food.getBirimKarb() * yeniMiktar : 0.0);
        entry.setToplamYag(food.getBirimYag() != null ? food.getBirimYag() * yeniMiktar : 0.0);

        var updated = foodEntryRepository.save(entry);
        return toResponse(updated);
    }

    public void sil(Long entryId) {
        if (!foodEntryRepository.existsById(entryId)) {
            throw new RuntimeException("Kayıt bulunamadı!");
        }
        foodEntryRepository.deleteById(entryId);
    }

    private static double nz(Double v) {
        return v != null ? v : 0.0;
    }

    private static String normalizeAciklama(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isBlank() ? null : t;
    }

    private FoodEntryResponse toResponse(FoodEntry entry) {
        return FoodEntryResponse.builder()
                .id(entry.getId())
                .dailyLogId(entry.getDailyLog().getId())
                .foodId(entry.getFood().getId())
                .yemekAdi(entry.getFood().getYemekAdi())
                .birimMiktar(entry.getFood().getBirimMiktar())
                .ogunTipi(entry.getOgunTipi())
                .miktar(entry.getMiktar())
                .aciklama(entry.getAciklama())
                .toplamKalori(entry.getToplamKalori())
                .toplamProtein(entry.getToplamProtein())
                .toplamKarb(entry.getToplamKarb())
                .toplamYag(entry.getToplamYag())
                .build();
    }
}
