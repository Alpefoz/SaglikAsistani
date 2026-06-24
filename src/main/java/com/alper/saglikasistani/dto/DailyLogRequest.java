package com.alper.saglikasistani.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class DailyLogRequest {
    private Long userId;
    private LocalDate tarih;
    private Double guncelKilo;
    private Integer icilenSuMiktari;
}