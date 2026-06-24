package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProgressResponse {
    private Double baslangicKilo;
    private Double mevcutKilo;
    private Double hedefKilo;
    /** 0-100 */
    private Double yuzde;
}

