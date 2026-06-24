package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserResponse {
    private Long id;
    private String email;
    private String ad;
    private String soyad;
    private String rol;
    private Boolean emailDogrulandiMi;
}