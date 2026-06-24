package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FoodResponse {
    private Long id;
    private String yemekAdi;
    private String birimMiktar;
    private Integer birimKalori;
    private Double birimProtein;
    private Double birimKarb;
    private Double birimYag;
}
