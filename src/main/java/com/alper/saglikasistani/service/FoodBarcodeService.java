package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.AiFoodItemResponse;
import com.alper.saglikasistani.dto.BarcodeProductResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Optional;

/**
 * Barkod: Open Facts ailesi zinciri → ürün yoksa yapay zeka ile tamamen tahmin; makro eksikse AI ile tamamlama.
 */
@Service
@RequiredArgsConstructor
public class FoodBarcodeService {

    private final OpenFoodFactsService openFoodFactsService;
    private final PhotoAnalysisService photoAnalysisService;

    public BarcodeProductResponse cozumle(String rawCode) {
        BarcodeProductResponse r;

        Optional<BarcodeProductResponse> dbHit;
        try {
            dbHit = openFoodFactsService.tryLookupBarcodeAcrossOpenFactsFamilies(rawCode);
        } catch (IllegalArgumentException ex) {
            throw ex;
        }

        if (dbHit.isPresent()) {
            r = dbHit.get();
        } else {
            try {
                r = yapayZekaIleTaninmayanBarkod(normalizeDigits(rawCode));
            } catch (IOException e) {
                throw new IllegalArgumentException(
                        "Bu barkod açık veritabanlarında yoktu; yapay zeka bağlantısı veya anahtarı ile tahmin oluşturulamadı.");
            }
        }

        if (!r.isBesinTablosuEksik()) {
            if (r.getMakroKaynagi() == null || r.getMakroKaynagi().isBlank()) {
                r.setMakroKaynagi("OPEN_COMMUNITY_DB");
            }
            return r;
        }

        String etiket = paketEtiketi(r);
        try {
            AiFoodItemResponse ai = photoAnalysisService.suggestNutritionForBarcodeProduct(etiket);
            aiMakrolariUygula(r, ai);
        } catch (IOException e) {
            throw new IllegalArgumentException("Makrolar yapay zeka ile üretilemedi. Bağlantı veya API anahtarını kontrol edin.");
        }
        return r;
    }

    private BarcodeProductResponse yapayZekaIleTaninmayanBarkod(String code) throws IOException {
        AiFoodItemResponse ai = photoAnalysisService.suggestNutritionForBarcodeProduct(
                "Paket GTIN/EAN barkod kodu: " + code
                        + ". Ürün Open Food Facts / Open Beauty Facts / Open Pet Food Facts kayıtlarında yok."
                        + " Olası market ürünü için makul bir kısa ad ve 100 g besin tahmini oluştur.");

        String ad = ai.getAd() != null ? ai.getAd().trim() : "";

        return BarcodeProductResponse.builder()
                .barkod(code)
                .urunAdi(ad.isBlank() ? ("Ürün " + code) : ad)
                .marka(null)
                .birimAciklama("100 g (AI tahmini)")
                .kcal(rd(ai.getKcal()))
                .protein(rd(ai.getProtein()))
                .karb(rd(ai.getKarb()))
                .yag(rd(ai.getYag()))
                .kaynak("Yapay zeka tahmini")
                .resimUrl(null)
                .besinTablosuEksik(false)
                .uyari("Bu barkod açık gıda / kozmetik / pet veritabanlarında bulunmadı."
                        + " Ürün adı ve makrolar tamamen tahmindir — etiketle mutlaka karşılaştırın.")
                .makroKaynagi("AI_TAHMIN")
                .build();
    }

    private static String normalizeDigits(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new IllegalArgumentException("Barkod boş olamaz.");
        }
        String code = rawCode.replaceAll("\\D", "");
        if (code.length() < 8 || code.length() > 14) {
            throw new IllegalArgumentException("Barkod 8–14 hane olmalıdır.");
        }
        return code;
    }

    private static String paketEtiketi(BarcodeProductResponse r) {
        String marka = r.getMarka() != null ? r.getMarka().trim() : "";
        String ad = r.getUrunAdi() != null ? r.getUrunAdi().trim() : "";
        if (!marka.isBlank() && !ad.isBlank()) {
            return marka + " " + ad;
        }
        if (!ad.isBlank()) {
            return ad;
        }
        return "Barkod " + r.getBarkod();
    }

    private static void aiMakrolariUygula(BarcodeProductResponse r, AiFoodItemResponse ai) {
        String src = r.getKaynak() != null && !r.getKaynak().isBlank() ? r.getKaynak() : "Veritabanı";
        r.setKcal(rd(ai.getKcal()));
        r.setProtein(rd(ai.getProtein()));
        r.setKarb(rd(ai.getKarb()));
        r.setYag(rd(ai.getYag()));
        r.setBesinTablosuEksik(false);
        r.setMakroKaynagi("AI_TAHMIN");
        r.setBirimAciklama("100 g (AI tahmini)");
        r.setKaynak(src + " (ürün kaydı) · AI (makro tahmini)");
        r.setUyari(src + " kaydında makro eksikti; yapay zeka 100 g için tahmin oluşturdu. Paket etiketi ile karşılaştırın.");
    }

    private static double rd(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
