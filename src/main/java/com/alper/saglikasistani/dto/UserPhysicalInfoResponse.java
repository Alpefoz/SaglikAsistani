package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class UserPhysicalInfoResponse {
    private Long id;
    private Long userId;
    private LocalDate dogumTarihi;
    private String cinsiyet;
    private Double boy;
    private Double hedefKilo;
    private String aktiviteSeviyesi;
}