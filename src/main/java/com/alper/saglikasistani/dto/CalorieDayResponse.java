package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class CalorieDayResponse {
    private LocalDate tarih;
    private Integer kalori;
}

