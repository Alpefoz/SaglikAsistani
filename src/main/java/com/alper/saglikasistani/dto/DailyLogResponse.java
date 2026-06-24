package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class DailyLogResponse {
    private Long id;
    private Long userId;
    private LocalDate tarih;
    private Double guncelKilo;
    private Integer icilenSuMiktari;
    private Integer toplamAlinanKalori;
    private Double toplamProtein;
}