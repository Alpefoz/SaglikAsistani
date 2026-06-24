package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.BarcodeProductResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Barkod → Open Facts ailesi (gıda, kozmetik, pet; aynı ürün API şeması).
 */
@Service
@RequiredArgsConstructor
public class OpenFoodFactsService {

    private record OpenFactsEndpoint(String apiBaseUrl, String displayName) {}

    private static final List<OpenFactsEndpoint> OPEN_FACTS_CHAIN = List.of(
            new OpenFactsEndpoint("https://world.openfoodfacts.org", "Open Food Facts"),
            new OpenFactsEndpoint("https://world.openbeautyfacts.org", "Open Beauty Facts"),
            new OpenFactsEndpoint("https://world.openpetfoodfacts.org", "Open Pet Food Facts"));

    private static final String USER_AGENT = "SaglikAsistani/1.0 (contact:https://github.com)";

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Open Facts zincirinde ilk eşleşen ürün. Hiçbirinde kayıt yoksa {@link Optional#empty()}.
     */
    public Optional<BarcodeProductResponse> tryLookupBarcodeAcrossOpenFactsFamilies(String rawCode) {
        String code = normalizeBarcode(rawCode);
        for (OpenFactsEndpoint ep : OPEN_FACTS_CHAIN) {
            JsonNode root = fetchProductJson(ep.apiBaseUrl(), code);
            if (root == null || root.isMissingNode()) {
                continue;
            }
            if (root.path("status").asInt(0) != 1) {
                continue;
            }
            JsonNode prod = root.path("product");
            if (prod.isMissingNode() || prod.isNull()) {
                continue;
            }
            return Optional.of(buildBarcodeResponseFromProduct(code, prod, ep.displayName()));
        }
        return Optional.empty();
    }

    private static String normalizeBarcode(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new IllegalArgumentException("Barkod boş olamaz.");
        }
        String code = rawCode.replaceAll("\\D", "");
        if (code.length() < 8 || code.length() > 14) {
            throw new IllegalArgumentException("Barkod 8–14 hane olmalıdır.");
        }
        return code;
    }

    private JsonNode fetchProductJson(String apiBaseUrl, String code) {
        String url = apiBaseUrl + "/api/v2/product/" + UriUtils.encodePathSegment(code, StandardCharsets.UTF_8) + ".json";
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
        HttpEntity<Void> req = new HttpEntity<>(headers);
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, req, String.class);
            String body = response.getBody();
            if (body == null || body.isBlank()) {
                return null;
            }
            return objectMapper.readTree(body);
        } catch (Exception ex) {
            return null;
        }
    }

    private BarcodeProductResponse buildBarcodeResponseFromProduct(String code, JsonNode prod, String kaynakEtiketi) {
        JsonNode n = prod.path("nutriments");

        ParsedMacros g = macrosForSuffix(n, false);
        ParsedMacros ml = macrosForSuffix(n, true);

        ParsedMacros picked = null;
        String birimAciklama = "100 g";
        boolean makroOfftaYok = true;

        if (g.hasAnyNutrient()) {
            picked = g;
            birimAciklama = "100 g";
            makroOfftaYok = false;
        } else if (ml.hasAnyNutrient()) {
            picked = ml;
            birimAciklama = "100 ml";
            makroOfftaYok = false;
        }

        ParsedMacros srv = tryServingToPer100Macros(n, prod);
        if (picked == null && srv != null && srv.hasAnyNutrient()) {
            picked = srv;
            birimAciklama = "100 g — porsiyon üzerinden hesap";
            makroOfftaYok = false;
        }

        boolean besinTablosuEksik = makroOfftaYok;
        ParsedMacros kullan = picked != null ? picked : new ParsedMacros();

        String nameTr = prod.path("product_name_tr").asText("").trim();
        String name = prod.path("product_name").asText("").trim();
        String productName = !nameTr.isBlank() ? nameTr : (!name.isBlank() ? name : ("Ürün " + code));

        String brands = prod.path("brands").asText("").trim();
        if (brands.contains(",")) {
            brands = brands.split(",")[0].trim();
        }

        String imgSmall = prod.path("image_front_small_url").asText("").trim();
        if (imgSmall.isBlank()) {
            imgSmall = prod.path("image_url").asText("").trim();
        }

        return BarcodeProductResponse.builder()
                .barkod(code)
                .urunAdi(productName)
                .marka(brands.isBlank() ? null : brands)
                .birimAciklama(besinTablosuEksik ? "100 g için (makro sonra doldurulacak)" : birimAciklama)
                .kcal(rd(kullan.kcal))
                .protein(rd(kullan.protein))
                .karb(rd(kullan.karb))
                .yag(rd(kullan.yag))
                .kaynak(kaynakEtiketi)
                .resimUrl(imgSmall.isBlank() ? null : imgSmall)
                .besinTablosuEksik(besinTablosuEksik)
                .uyari(null)
                .makroKaynagi(besinTablosuEksik ? null : "OPEN_COMMUNITY_DB")
                .build();
    }

    /**
     * Yalnızca porsiyon başına değer varsa (ör. "30 g" + energy-kcal_serving) 100 g’e ölçekler.
     */
    private ParsedMacros tryServingToPer100Macros(JsonNode n, JsonNode prod) {
        if (n == null || n.isMissingNode()) {
            return null;
        }
        double serveG = parseServingSizeGramsApprox(prod, n);
        if (serveG <= 0) {
            return null;
        }

        double kcalS = pick(n, "energy-kcal_serving");
        double pS = pick(n, "proteins_serving");
        double kS = pick(n, "carbohydrates_serving");
        double yS = pick(n, "fat_serving");

        if (kcalS <= 0 && pS <= 0 && kS <= 0 && yS <= 0) {
            return null;
        }

        double scale = 100.0 / serveG;
        ParsedMacros x = new ParsedMacros();
        x.kcal = kcalS > 0 ? kcalS * scale : 0;
        x.protein = pS > 0 ? pS * scale : 0;
        x.karb = kS > 0 ? kS * scale : 0;
        x.yag = yS > 0 ? yS * scale : 0;
        return x;
    }

    /** Porsiyon büyüklüğü (g veya yaklaşık ml→g için g) — önce ürün, sonra nutriments metinleri. */
    private double parseServingSizeGramsApprox(JsonNode prod, JsonNode nutriments) {
        JsonNode sqn = prod.get("serving_quantity");
        double srvQty = readPositiveDoubleField(sqn);
        if (srvQty > 0) {
            String u = prod.path("serving_quantity_unit").asText("").trim().toLowerCase(Locale.ROOT);
            return convertToGramMlBasis(srvQty, u);
        }
        String servingSizeProd = prod.path("serving_size").asText("").trim();
        if (!servingSizeProd.isBlank()) {
            double g = parseAmountWithUnit(servingSizeProd);
            if (g > 0) {
                return g;
            }
        }
        String fromNu = nutriments.path("serving_size").asText("").trim();
        if (!fromNu.isBlank()) {
            return parseAmountWithUnit(fromNu);
        }
        return 0;
    }

    private static double convertToGramMlBasis(double v, String u) {
        if (v <= 0) {
            return 0;
        }
        if ("ml".equals(u) || "cl".equals(u) || "l".equals(u)) {
            double ml = v;
            if ("cl".equals(u)) {
                ml = v * 10;
            } else if ("l".equals(u)) {
                ml = v * 1000;
            }
            return ml;
        }
        if ("g".equals(u) || "gram".equals(u) || u.isBlank()) {
            return v;
        }
        return 0;
    }

    private static final Pattern AMOUNT_UNIT = Pattern.compile(
            "([\\d.]+)\\s*(g|gram|grams|mg|kg|ml|mL|cl|l)\\b",
            Pattern.CASE_INSENSITIVE);

    private static double parseAmountWithUnit(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        String q = raw.toLowerCase(Locale.ROOT).replace(',', '.').trim();
        Matcher m = AMOUNT_UNIT.matcher(q);
        if (!m.find()) {
            return 0;
        }
        try {
            double amount = Double.parseDouble(m.group(1));
            String unit = m.group(2).toLowerCase(Locale.ROOT);
            return switch (unit) {
                case "kg" -> amount * 1000;
                case "mg" -> amount / 1000;
                case "ml" -> amount;
                case "cl" -> amount * 10;
                case "l" -> amount * 1000;
                case "gram", "grams", "g" -> amount;
                default -> amount;
            };
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private ParsedMacros macrosForSuffix(JsonNode n, boolean perMl) {
        String u = perMl ? "100ml" : "100g";
        ParsedMacros x = new ParsedMacros();
        x.kcal = kcalPer100(n, perMl);
        x.protein = pick(n, "proteins_" + u);
        x.karb = pick(n, "carbohydrates_" + u);
        x.yag = pick(n, "fat_" + u);
        return x;
    }

    /** kcal; önce doğrudan kcal anahtarı, sonra kJ’den çevirme */
    private double kcalPer100(JsonNode n, boolean perMl) {
        String u = perMl ? "100ml" : "100g";
        double kcal = pick(n, "energy-kcal_" + u);
        if (kcal > 0) {
            return kcal;
        }
        double kj = pick(n, "energy-kj_" + u);
        if (kj <= 0) {
            kj = pick(n, "energy_" + u);
        }
        if (kj > 0) {
            return kj / 4.184;
        }
        return 0;
    }

    private static double pick(JsonNode nutriments, String key) {
        if (nutriments == null || nutriments.isMissingNode()) {
            return 0;
        }
        JsonNode v = nutriments.path(key);
        if (v.isMissingNode() || v.isNull()) {
            return 0;
        }
        if (v.isNumber()) {
            return v.asDouble();
        }
        String t = v.asText("").trim().replace(',', '.');
        if (t.isBlank()) {
            return 0;
        }
        try {
            return Double.parseDouble(t);
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private static double readPositiveDoubleField(JsonNode node) {
        if (node == null || node.isNull()) {
            return 0;
        }
        if (node.isNumber()) {
            double v = node.asDouble();
            return v > 0 ? v : 0;
        }
        if (node.isTextual()) {
            String t = node.asText("").replace(',', '.').trim();
            if (t.isBlank()) {
                return 0;
            }
            try {
                double v = Double.parseDouble(t);
                return v > 0 ? v : 0;
            } catch (NumberFormatException ex) {
                return 0;
            }
        }
        return 0;
    }

    private double rd(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static final class ParsedMacros {
        double kcal;
        double protein;
        double karb;
        double yag;

        boolean hasAnyNutrient() {
            return kcal > 0 || protein > 0 || karb > 0 || yag > 0;
        }
    }
}
