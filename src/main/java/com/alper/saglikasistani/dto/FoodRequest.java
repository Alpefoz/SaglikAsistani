package com.alper.saglikasistani.dto;

import lombok.Data;

@Data
public class FoodRequest {
    private String yemekAdi;
    private String birimMiktar;
    private Integer birimKalori;
    private Double birimProtein;
    private Double birimKarb;
    private Double birimYag;
}
