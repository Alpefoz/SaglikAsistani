package com.alper.saglikasistani.dto;

import lombok.Data;

@Data
public class FoodEntryRequest {
    private Long dailyLogId;
    private Long foodId;
    private String ogunTipi;
    private Double miktar;
    /** İsteğe bağlı — porsiyon / yapılış detayı */
    private String aciklama;

    /**
     * Sepet satırında AI / kullanıcı tarafından ayarlanan birim makrolar (varsa sunucu listedeki besini değil bunları çarpar).
     * Yalnızca {@code ozellestirilenBirimKalori} doluysa geçerlidir.
     */
    private Double ozellestirilenBirimKalori;
    private Double ozellestirilenBirimProtein;
    private Double ozellestirilenBirimKarb;
    private Double ozellestirilenBirimYag;
}
