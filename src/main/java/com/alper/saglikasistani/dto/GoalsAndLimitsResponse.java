package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GoalsAndLimitsResponse {
    private Long id;
    private Long userId;
    private Integer gunlukHedefKalori;
}

