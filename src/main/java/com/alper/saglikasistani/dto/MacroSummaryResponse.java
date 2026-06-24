package com.alper.saglikasistani.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MacroSummaryResponse {
    private Double toplamProtein;
    private Double toplamKarb;
    private Double toplamYag;
}
