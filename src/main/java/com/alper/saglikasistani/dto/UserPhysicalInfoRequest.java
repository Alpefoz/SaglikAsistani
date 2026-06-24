package com.alper.saglikasistani.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class UserPhysicalInfoRequest {
    private Long userId;
    private LocalDate dogumTarihi;
    private String cinsiyet;
    private Double boy;
    private Double hedefKilo;
    private String aktiviteSeviyesi;
}