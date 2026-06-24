package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FoodEntryResponse {
    private Long id;
    private Long dailyLogId;
    private Long foodId;
    private String yemekAdi;
    private String birimMiktar;
    private String ogunTipi;
    private Double miktar;
    private String aciklama;
    private Integer toplamKalori;
    private Double toplamProtein;
    private Double toplamKarb;
    private Double toplamYag;
}
