package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.FoodRequest;
import com.alper.saglikasistani.dto.FoodResponse;
import com.alper.saglikasistani.entity.Food;
import com.alper.saglikasistani.repository.FoodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FoodService {

    private final FoodRepository foodRepository;

    public FoodResponse ekle(FoodRequest request) {
        var food = Food.builder()
                .yemekAdi(request.getYemekAdi())
                .birimMiktar(request.getBirimMiktar())
                .birimKalori(request.getBirimKalori())
                .birimProtein(request.getBirimProtein())
                .birimKarb(request.getBirimKarb())
                .birimYag(request.getBirimYag())
                .build();

        var saved = foodRepository.save(food);
        return toResponse(saved);
    }

    public List<FoodResponse> tumBesinleriGetir() {
        return uniqueByName(foodRepository.findAll());
    }

    public List<FoodResponse> adaGoreAra(String yemekAdi) {
        return uniqueByName(foodRepository.findByYemekAdiContainingIgnoreCase(yemekAdi));
    }

    private List<FoodResponse> uniqueByName(List<Food> foods) {
        Map<String, Food> byName = new LinkedHashMap<>();
        foods.stream()
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .forEach(food -> {
                    String key = normalizeFoodName(food.getYemekAdi());
                    byName.putIfAbsent(key, food);
                });
        return byName.values().stream().map(this::toResponse).collect(Collectors.toList());
    }

    private String normalizeFoodName(String name) {
        if (name == null) return "";
        return name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private FoodResponse toResponse(Food food) {
        return FoodResponse.builder()
                .id(food.getId())
                .yemekAdi(food.getYemekAdi())
                .birimMiktar(food.getBirimMiktar())
                .birimKalori(food.getBirimKalori())
                .birimProtein(food.getBirimProtein())
                .birimKarb(food.getBirimKarb())
                .birimYag(food.getBirimYag())
                .build();
    }
}
