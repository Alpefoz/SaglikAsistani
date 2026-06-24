package com.alper.saglikasistani.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BarcodeProductResponse {

    /** EAN / UPC (normalize edilmiş rakamlar) */
    private String barkod;

    private String urunAdi;

    private String marka;

    /** Örn: "100 g" veya "100 ml" — besin tablosunun referansına göre */
    private String birimAciklama;

    /** 100 g veya (içecekte) 100 ml başına yaklaşık değerler */
    private double kcal;

    private double protein;
    private double karb;
    private double yag;

    /** Veri kaynağı kullanıcıya gösterim için */
    private String kaynak;

    /** Küçük ürün görseli URL (varsa) */
    private String resimUrl;

    /** OFF’ta kayıtlı ürün var ama makro eksik → kullanıcı etiketi girsin */
    @Builder.Default
    private boolean besinTablosuEksik = false;

    /** Eksikse kullanıcıya gösterilen kısa açıklama */
    private String uyari;

    /** OPEN_COMMUNITY_DB (Open Facts ailesi) | AI_TAHMIN */
    private String makroKaynagi;
}
