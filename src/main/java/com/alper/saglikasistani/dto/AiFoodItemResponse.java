package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiFoodItemResponse {
    private String ad;
    private double kcal;
    private double protein;
    private double karb;
    private double yag;
    private double gram;
}
