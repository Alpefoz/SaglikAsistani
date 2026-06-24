package com.alper.saglikasistani.dto;

import lombok.Data;

@Data
public class UserRegisterRequest {
    private String email;
    private String password;
    private String ad;
    private String soyad;
}