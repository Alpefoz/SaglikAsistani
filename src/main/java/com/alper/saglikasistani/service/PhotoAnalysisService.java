package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.AiFoodItemResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;

@Service
public class PhotoAnalysisService {

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.model:meta-llama/llama-4-scout-17b-16e-instruct}")
    private String model;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

    // ---------------------------------------------------------------
    // Fotoğraf analizi — modal kamerasından gelen görüntü için
    // ---------------------------------------------------------------
    public List<AiFoodItemResponse> analyzeFoodItems(MultipartFile image) throws IOException {
        return analyzeFoodItems(image, "auto");
    }

    public List<AiFoodItemResponse> analyzeFoodItems(MultipartFile image, String mode) throws IOException {
        String base64 = Base64.getEncoder().encodeToString(image.getBytes());
        String mimeType = image.getContentType() != null ? image.getContentType() : "image/jpeg";

        String m = mode == null ? "auto" : mode.trim().toLowerCase(Locale.ROOT);
        boolean packagedMode = "packaged".equals(m) || "barkodlu".equals(m);
        boolean autoMode = "auto".equals(m) || m.isBlank();

        final String prompt;
        if (packagedMode) {
            prompt = """
                Bu goruntu paketli urun ETIKET/BESIN TABLOSU analizi olarak islenecek.
                Kurallar:
                - ONCELIKLE besin degerleri tablosunu oku.
                - Tabloda "bir porsiyon", "porsiyon (250 ml)", "1 kutu" gibi satir varsa:
                  o satirdaki ENERJI (kcal) ve protein/karbonhidrat/yagi kullan;
                  son sutunda gorunen ml veya gram rakamini (orn. 250) gram alanina yaz.
                - Sadece porsiyon satiri yoksa "100 g" veya "100 ml" satirina gec;
                  bu durumda degerler 100 g/ml basina olmali ve gram alani 100 yaz.
                - Paket urun adini etiketten yaz (marka + tur).
                - Sadece tek satir don (tek paket urun).
                SADECE su formatta yaz:
                BESIN: {Turkce urun adi} | {bu satir icin kcal} | {protein g} | {karb g} | {yag g} | {rakam ml veya g}
                """;
        } else if (autoMode) {
            prompt = """
                    Bu goruntu HEM paket/kutu besin bilgi paneli HEM hazir tabak olabilir. Once hangisi olduguna karar ver.

                    ETIKET / PAKET / SISE / KUTU:
                    - Urun adini etiketten yaz (marka + cesit).
                    - Tabloda bir porsiyon satiri netse (250 ml, bir porsiyon vb.) oradaki kcal ve makrolari yaz;
                      gram sutununa bu satirin ml veya gram rakamini koy (orn. 250).
                    - Sadece 100 ml / 100 g satiri varsa bu satirin degerlerini kullan ve gram sutununa 100 yaz.
                    FORMAT: BESIN: {urun adi} | {bu satirin kcal} | {protein g} | {karb g} | {yag g} | {rakam ml veya g}

                    TABAK / HAZIR YEMEK:
                    - Her ogeyi ayri satir yaz (pilav+tavukta iki veya daha cok satir).
                    FORMAT: BESIN: {yemek} | {kalori tahmini} | {protein} | {karb} | {yag} | {gram}

                    SADECE BESIN satirlari yaz, baska aciklama yazma.
                    """;
        } else {
            prompt = """
                Bu yemek fotoğrafını analiz et. Gördüğün her yiyeceği AYRI SATIR olarak listele.
                COK ONEMLI KURAL:
                - Pilavli/karisik tabaklarda tek satir "pirinc pilavi" yazip gecme.
                - Tabakta tavuk + pilav + brokoli gibi birden fazla parca varsa her birini AYRI yaz.
                - Ornek: "Tavuk Pilav" gorduysen bunu "Tavuk Gogsu" ve "Pirinc Pilavi" olarak ayir.
                - Yan urun veya garnitur gorduysen (brokoli, salata vb.) ayri satir yaz.
                Her bir yiyecek icin fotografdaki tahmini miktara gore deger ver.
                SADECE asagidaki formatta yaz, baska hicbir sey yazma:
                BESIN: {Türkçe yemek adı} | {kalori sayı} | {protein gram sayı} | {karbonhidrat gram sayı} | {yağ gram sayı} | {tahmini gram sayı}

                Ornek:
                BESIN: Tavuk Gogsu | 200 | 38 | 0 | 5 | 150
                BESIN: Pirinc Pilavi | 280 | 5 | 60 | 2 | 180
                BESIN: Brokoli | 55 | 4 | 10 | 1 | 120
                """;
        }

        String raw = callGroqWithImage(prompt, base64, mimeType);
        List<AiFoodItemResponse> firstPass = parseBesinLines(raw);

        AiFoodItemResponse visionSingle = null;
        boolean usedOffSingle = false;

        if (packagedMode && !firstPass.isEmpty()) {
            List<AiFoodItemResponse> enriched = new ArrayList<>();
            boolean[] dummy = { false };
            for (AiFoodItemResponse it : firstPass) {
                enriched.add(mergeOpenFoodFactsScaled(it, dummy, true));
            }
            firstPass = enriched;
        } else if (autoMode && firstPass.size() == 1 && !firstPass.isEmpty()) {
            visionSingle = firstPass.get(0);
            boolean[] usedOff = { false };
            firstPass = List.of(mergeOpenFoodFactsScaled(visionSingle, usedOff, false));
            usedOffSingle = usedOff[0];
        }

        // Tek ogeli sonucta gereksiz "tabagi bol" ikinci foto gecisini atlama kosullari
        boolean skipPlateFallback = packagedMode || (autoMode && visionSingle != null
                && shouldSkipPlateFallbackForSingle(visionSingle, usedOffSingle));
        if (!skipPlateFallback && firstPass.size() <= 1) {
            String fallbackPrompt = """
                    Bu tabakta birden fazla yiyecek olma ihtimali yuksek.
                    Ozellikle su gruplari AYRI AYRI kontrol et ve varsa ayri satir yaz:
                    - Tavuk / et / balik
                    - Pilav / bulgur / makarna / patates
                    - Sebze (brokoli, salata, garnitur)
                    
                    COK ONEMLI:
                    - Tek satir "Tavuk Pilav" yazma.
                    - Eger tavuk + pilav goruyorsan iki satir yaz.
                    - Tahmini gramlar gercekci olsun, toplam tabak 250-500g araligini gecmesin.
                    
                    SADECE su formatta yaz:
                    BESIN: {yemek adi} | {kalori} | {protein} | {karbonhidrat} | {yag} | {gram}
                    """;
            String fallbackRaw = callGroqWithImage(fallbackPrompt, base64, mimeType);
            List<AiFoodItemResponse> secondPass = parseBesinLines(fallbackRaw);
            if (secondPass.size() > firstPass.size()) {
                return secondPass;
            }
            if (!secondPass.isEmpty() && !firstPass.isEmpty()) {
                return mergeUniqueFoods(firstPass, secondPass);
            }
        }

        return firstPass;
    }

    /** Auto mod tek satir: OFF isabet ettiyse veya etiket/porsiyon olcutu anlasildiysa tabak fallback atlanir. */
    private static boolean shouldSkipPlateFallbackForSingle(AiFoodItemResponse visionBeforeMerge, boolean offApplied) {
        if (visionBeforeMerge == null) return false;
        if (offApplied) return true;
        double g = visionBeforeMerge.getGram();
        if (Double.isFinite(g)) {
            if (g >= 95 && g <= 105) return true;
            if (g >= 200 && g <= 330) return true;
        }
        return false;
    }

    private static double roundNutrient(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    // ---------------------------------------------------------------
    // Metin tabanlı besin değeri tahmini — yemek adı yazıldığında
    // ---------------------------------------------------------------
    public AiFoodItemResponse suggestNutrition(String foodName) throws IOException {
        boolean structured = isStructuredNutritionRequest(foodName);
        // Uzun / sepet-bağlamlı sorgularda OFF ilk eşleşme yanlış veya 100 g değerini porsiyon sandırır; Groq’a bırak.
        AiFoodItemResponse fromWeb = structured ? null : lookupOpenFoodFactsByName(foodName);
        if (fromWeb != null) return fromWeb;

        final String prompt;
        if (structured) {
            prompt = """
                    Sen deneyimli bir klinik beslenme asistanısın. Aşağıdaki blok bir mobil kalori uygulamasından geliyor.

                    ---
                    """ + foodName + """
                    ---

                    GÖREV: Kullanıcının USER_NOTE ve taban makroları birlikte okuyarak, tariflenen TEK mantıklı öğün/porsiyon için tahmini kalori ve makroları ver.

                    ZORUNLU KURALLAR:
                    1) BASE_MACROS_PER_APP_UNIT sadece referanstır; liste genelde küçük porsiyon veya kısaltılmış başlık için olabilir. USER_NOTE açık malzeme miktarı veriyorsa (ör. «10 yumurta», «5 dilim peynir») bunları gerçekçi besin değerleriyle hesaba kat. Taban 320 kcal iken not 10 yumurta diyorsa, yaklaşık 10 orta yumurta kalorisini (≈750–780 kcal sadece yumurta için) eksik düşürme — diğer malzemeleri (füme hindi, labne vb.) uygun düzeyde ekle.
                    2) İsim hem «yumurtalı» diyip hem kullanıcı 10 yumurta diyorsa, yumurta miktarını NOT’taki TOPlam adede göre al; isimde geçen ‘yumurtalı’ küçük porsiyon varsayımına düşme.
                    3) QTY_MULTIPLIER 1’den büyükse, kullanıcı aynı tanımlandığı tabağı o kadar yemiş mantığıyla uyumlu olarak ölçekle veya bağlam net değilse en mantıklı yorumu seçip BESIN satırında yaz.
                    4) Sonuç, nottaki bileşen toplamlarıyla çelişecek kadar küçük olmasın.

                    Sadece aşağıdaki formatta 1 satır yaz, başka hiçbir şey yazma:
                    BESIN: {yemek adı} | {kalori} | {protein gram} | {karbonhidrat gram} | {yağ gram} | {tahmini porsiyon gram}
                    Örnek: BESIN: Omlet kahvaltı tabağı | 1120 | 62 | 8 | 88 | 420
                    """;
        } else {
            prompt = String.format("""
                    Türk mutfağında "%s" için 1 standart porsiyon besin değerlerini ver.
                    Sadece aşağıdaki formatta 1 satır yaz, başka hiçbir şey yazma:
                    BESIN: {yemek adı} | {kalori} | {protein gram} | {karbonhidrat gram} | {yağ gram} | {gram}
                    
                    Örnek:
                    BESIN: Tavuk Pilav | 450 | 28 | 55 | 10 | 300
                    """, foodName);
        }

        String raw = callGroqText(prompt);
        List<AiFoodItemResponse> items = parseBesinLines(raw);
        if (!items.isEmpty()) return items.get(0);

        // Fallback: boş cevap gelirse minimum değerlerle döndür
        return AiFoodItemResponse.builder()
                .ad(foodName)
                .kcal(0).protein(0).karb(0).yag(0).gram(100)
                .build();
    }

    /**
     * Barkodlu paket ürün: OFF’ta makro yokken yalnızca Groq ile 100 g (veya ml) tipik değer tahmini.
     * Open Food Facts araması yapılmaz (çift eşleşme riski).
     */
    public AiFoodItemResponse suggestNutritionForBarcodeProduct(String packLabel) throws IOException {
        if (packLabel == null || packLabel.isBlank()) {
            return AiFoodItemResponse.builder()
                    .ad("Paket ürün")
                    .kcal(0).protein(0).karb(0).yag(0).gram(100)
                    .build();
        }
        String safe = packLabel.trim().replace("\"", "'");
        String prompt = String.format("""
                Asagidaki PAKETLI / hazir gida urunu icin 100 gram (sivi ise 100 ml) icin
                makul TIPIK besin degerlerini TAHMIN et. Gercek etiketle birebir olmayabilir.

                Urun: "%s"

                Sadece 1 satir, baska hicbir sey yazma:
                BESIN: {kisa urun adi} | {kcal} | {protein g} | {karb g} | {yag g} | 100
                """, safe);

        String raw = callGroqText(prompt);
        List<AiFoodItemResponse> items = parseBesinLines(raw);
        if (!items.isEmpty()) {
            return items.get(0);
        }
        return AiFoodItemResponse.builder()
                .ad(packLabel.trim())
                .kcal(0).protein(0).karb(0).yag(0).gram(100)
                .build();
    }

    // ---------------------------------------------------------------
    // Raporlar sayfası — eski metin analizi (geriye dönük uyumluluk)
    // ---------------------------------------------------------------
    public String analyzeFood(MultipartFile image) throws IOException {
        List<AiFoodItemResponse> items = analyzeFoodItems(image);
        if (items.isEmpty()) return "Yemek tespit edilemedi.";

        StringBuilder sb = new StringBuilder("BESINLER:\n");
        double totalKcal = 0, totalP = 0, totalK = 0, totalY = 0;
        for (AiFoodItemResponse it : items) {
            sb.append(String.format("- %s: %.0f kcal, protein %.1fg, karb %.1fg, yağ %.1fg%n",
                    it.getAd(), it.getKcal(), it.getProtein(), it.getKarb(), it.getYag()));
            totalKcal += it.getKcal();
            totalP += it.getProtein();
            totalK += it.getKarb();
            totalY += it.getYag();
        }
        sb.append(String.format("TOPLAM: %.0f kcal, protein %.1fg, karb %.1fg, yağ %.1fg",
                totalKcal, totalP, totalK, totalY));
        return sb.toString();
    }

    // ---------------------------------------------------------------
    // İç yardımcılar
    // ---------------------------------------------------------------
    private String callGroqWithImage(String prompt, String base64, String mimeType) throws IOException {
        String dataUrl = "data:" + mimeType + ";base64," + base64;
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of(
                                "role", "user",
                                "content", List.of(
                                        Map.of("type", "text", "text", prompt),
                                        Map.of("type", "image_url", "image_url", Map.of("url", dataUrl))
                                )
                        )
                ),
                "temperature", 0.2,
                "max_tokens", 1024
        );
        return callGroq(body);
    }

    private String callGroqText(String prompt) throws IOException {
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.2,
                "max_tokens", 1024
        );
        return callGroq(body);
    }

    private String callGroq(Map<String, Object> body) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        String requestJson = objectMapper.writeValueAsString(body);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    GROQ_URL, HttpMethod.POST,
                    new HttpEntity<>(requestJson, headers),
                    String.class
            );
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode choices = root.path("choices");
            if (choices.isEmpty()) {
                throw new IOException("Groq yanıtı boş döndü.");
            }
            JsonNode contentNode = choices.get(0).path("message").path("content");
            if (contentNode.isTextual()) {
                return contentNode.asText("");
            }
            if (contentNode.isArray()) {
                StringBuilder sb = new StringBuilder();
                for (JsonNode node : contentNode) {
                    String part = node.path("text").asText("");
                    if (!part.isBlank()) sb.append(part).append("\n");
                }
                return sb.toString().trim();
            }
            return "";
        } catch (HttpStatusCodeException ex) {
            String bodyText = ex.getResponseBodyAsString();
            if (bodyText == null || bodyText.isBlank()) bodyText = ex.getStatusCode().toString();
            throw new IOException("Groq hatası: " + bodyText);
        } catch (Exception ex) {
            throw new IOException("Groq isteği başarısız: " + ex.getMessage(), ex);
        }
    }

    private List<AiFoodItemResponse> parseBesinLines(String raw) {
        List<AiFoodItemResponse> items = new ArrayList<>();
        Pattern p = Pattern.compile(
                "BESIN:\\s*(.+?)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)",
                Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(raw);
        while (m.find()) {
            try {
                items.add(AiFoodItemResponse.builder()
                        .ad(m.group(1).trim())
                        .kcal(Double.parseDouble(m.group(2)))
                        .protein(Double.parseDouble(m.group(3)))
                        .karb(Double.parseDouble(m.group(4)))
                        .yag(Double.parseDouble(m.group(5)))
                        .gram(Double.parseDouble(m.group(6)))
                        .build());
            } catch (NumberFormatException ignored) {}
        }
        return items;
    }

    private List<AiFoodItemResponse> mergeUniqueFoods(List<AiFoodItemResponse> first, List<AiFoodItemResponse> second) {
        Map<String, AiFoodItemResponse> merged = new LinkedHashMap<>();
        for (AiFoodItemResponse item : first) {
            merged.put(normalizeFoodName(item.getAd()), item);
        }
        for (AiFoodItemResponse item : second) {
            merged.putIfAbsent(normalizeFoodName(item.getAd()), item);
        }
        return new ArrayList<>(merged.values());
    }

    private String normalizeFoodName(String name) {
        if (name == null) return "";
        return name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    /** Istemciden yapilandirilmis blok; OFF aramasina sokma. */
    private boolean isStructuredNutritionRequest(String foodName) {
        if (foodName == null || foodName.isBlank()) return false;
        return foodName.contains("DISH:") && foodName.contains("BASE_MACROS_PER_APP_UNIT:");
    }

    /** Metin onerisi icin guvenilir bir OFF kaydi bulunursa 100 g / 100 ml degerleri. */
    private AiFoodItemResponse lookupOpenFoodFactsByName(String query) {
        if (query == null || query.trim().isBlank()) return null;
        try {
            String q = query.trim();
            List<AiFoodItemResponse> cands = fetchOpenFoodFactsCandidates(q, false);
            OpenFoodPick pick = pickBestOpenFood(q, cands);
            if (pick == null || pick.item() == null || !trustOpenFoodForVision(q, pick, false)) {
                return null;
            }
            AiFoodItemResponse w = pick.item();
            return AiFoodItemResponse.builder()
                    .ad(w.getAd())
                    .kcal(w.getKcal())
                    .protein(w.getProtein())
                    .karb(w.getKarb())
                    .yag(w.getYag())
                    .gram(100)
                    .build();
        } catch (Exception ignored) {
            return null;
        }
    }

    private record OpenFoodPick(AiFoodItemResponse item, double score) {}

    /**
     * Open Food Facts 100 g / 100 ml degerleri ile AI satirini birlestirir.
     * Gorseldeki miktar sutunu (vision gram) kullanarak per-100 degerleri oleekler (orn. 250 ml -> factor 2.5).
     */
    private AiFoodItemResponse mergeOpenFoodFactsScaled(
            AiFoodItemResponse aiItem, boolean[] offAppliedFlag, boolean packagedProductFlow) {
        if (aiItem == null || aiItem.getAd() == null || aiItem.getAd().isBlank()) {
            if (offAppliedFlag != null && offAppliedFlag.length > 0) {
                offAppliedFlag[0] = false;
            }
            return aiItem;
        }
        try {
            List<AiFoodItemResponse> cands =
                    fetchOpenFoodFactsCandidates(aiItem.getAd(), packagedProductFlow);
            OpenFoodPick pick = pickBestOpenFood(aiItem.getAd(), cands);
            if (pick == null || pick.item() == null || !trustOpenFoodForVision(aiItem.getAd(), pick, packagedProductFlow)) {
                if (offAppliedFlag != null && offAppliedFlag.length > 0) {
                    offAppliedFlag[0] = false;
                }
                return aiItem;
            }
            AiFoodItemResponse web = pick.item();

            double gVision = aiItem.getGram();
            if (!Double.isFinite(gVision) || gVision <= 0) {
                gVision = 100;
            }
            double factor = gVision / 100.0;

            double kcalAi = aiItem.getKcal();
            double pAi = aiItem.getProtein();
            double kAi = aiItem.getKarb();
            double yAi = aiItem.getYag();

            double kcal = web.getKcal() > 0 ? roundNutrient(web.getKcal() * factor) : kcalAi;
            double p = web.getProtein() > 0 ? roundNutrient(web.getProtein() * factor) : pAi;
            double k = web.getKarb() > 0 ? roundNutrient(web.getKarb() * factor) : kAi;
            double y = web.getYag() > 0 ? roundNutrient(web.getYag() * factor) : yAi;

            String ad = Optional.ofNullable(web.getAd()).filter(s -> !s.isBlank()).orElse(aiItem.getAd());

            if (offAppliedFlag != null && offAppliedFlag.length > 0) {
                offAppliedFlag[0] = true;
            }
            return AiFoodItemResponse.builder()
                    .ad(ad)
                    .kcal(kcal)
                    .protein(p)
                    .karb(k)
                    .yag(y)
                    .gram(roundNutrient(gVision))
                    .build();
        } catch (Exception ex) {
            if (offAppliedFlag != null && offAppliedFlag.length > 0) {
                offAppliedFlag[0] = false;
            }
            return aiItem;
        }
    }

    private List<AiFoodItemResponse> fetchOpenFoodFactsCandidates(String visionName, boolean multiQueries) throws IOException {
        List<String> queries = multiQueries ? buildOpenFoodSearchQueries(visionName) : List.of(visionName.trim());
        Map<String, AiFoodItemResponse> byNormName = new LinkedHashMap<>();
        for (String q : queries) {
            if (q == null || q.isBlank()) {
                continue;
            }
            for (AiFoodItemResponse parsed : fetchOpenFoodFactsSearchPage(q, 14)) {
                String k = normalizeFoodName(parsed.getAd());
                if (!k.isEmpty()) {
                    byNormName.putIfAbsent(k, parsed);
                }
            }
        }
        return new ArrayList<>(byNormName.values());
    }

    private List<String> buildOpenFoodSearchQueries(String visionName) {
        LinkedHashSet<String> qs = new LinkedHashSet<>();
        String t = visionName.trim();
        if (!t.isEmpty()) {
            qs.add(t);
        }
        String[] tok = t.split("\\s+");
        if (tok.length >= 2) {
            qs.add(tok[0] + " " + tok[1]);
            if (tok[0].length() >= 3) {
                qs.add(tok[0]);
            }
        } else if (tok.length == 1 && tok[0].length() >= 4) {
            qs.add(tok[0]);
        }
        return new ArrayList<>(qs);
    }

    private List<AiFoodItemResponse> fetchOpenFoodFactsSearchPage(String query, int pageSize) throws IOException {
        List<AiFoodItemResponse> out = new ArrayList<>();
        String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
        String url = OPEN_FOOD_FACTS_SEARCH_URL
                + "?search_terms=" + encoded
                + "&search_simple=1&action=process&json=1&page_size=" + Math.min(Math.max(pageSize, 5), 20);

        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, HttpEntity.EMPTY, String.class);
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode products = root.path("products");
        if (!products.isArray()) {
            return out;
        }
        for (JsonNode product : products) {
            parseOpenFoodProduct(product).ifPresent(out::add);
        }
        return out;
    }

    private Optional<AiFoodItemResponse> parseOpenFoodProduct(JsonNode product) {
        if (product == null || product.isMissingNode()) {
            return Optional.empty();
        }
        JsonNode nutriments = product.path("nutriments");
        double kcal100 = parseDoubleNode(nutriments, "energy-kcal_100g");
        double protein100 = parseDoubleNode(nutriments, "proteins_100g");
        double karb100 = parseDoubleNode(nutriments, "carbohydrates_100g");
        double yag100 = parseDoubleNode(nutriments, "fat_100g");

        if (kcal100 <= 0) kcal100 = parseDoubleNode(nutriments, "energy-kcal_100ml");
        if (protein100 <= 0) protein100 = parseDoubleNode(nutriments, "proteins_100ml");
        if (karb100 <= 0) karb100 = parseDoubleNode(nutriments, "carbohydrates_100ml");
        if (yag100 <= 0) yag100 = parseDoubleNode(nutriments, "fat_100ml");

        if (kcal100 <= 0 && protein100 <= 0 && karb100 <= 0 && yag100 <= 0) {
            return Optional.empty();
        }

        String nameTr = product.path("product_name_tr").asText("").trim();
        String nameDef = product.path("product_name").asText("").trim();
        String brands = product.path("brands").asText("").trim();

        String ad = nameTr;
        if (ad.isBlank()) {
            ad = nameDef;
        }
        if (ad.isBlank() && !brands.isBlank()) {
            ad = brands;
        }

        return Optional.of(AiFoodItemResponse.builder()
                .ad(ad.isBlank() ? "Ürün" : ad)
                .kcal(kcal100)
                .protein(protein100)
                .karb(karb100)
                .yag(yag100)
                .gram(100)
                .build());
    }

    private OpenFoodPick pickBestOpenFood(String visionName, List<AiFoodItemResponse> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        OpenFoodPick best = null;
        for (AiFoodItemResponse c : candidates) {
            double s = scoreOpenFoodVersusVision(visionName, c);
            if (best == null || s > best.score()) {
                best = new OpenFoodPick(c, s);
            }
        }
        return best;
    }

    private double scoreOpenFoodVersusVision(String visionName, AiFoodItemResponse web) {
        String q = normalizeFoodName(visionName);
        String n = normalizeFoodName(web.getAd());
        double s = 0;
        if (!q.isEmpty() && !n.isEmpty()) {
            if (n.contains(q) || q.contains(n)) {
                s += 80;
            }
        }
        if (!q.isEmpty()) {
            for (String t : q.split("\\s+")) {
                if (t.length() >= 3 && n.contains(t)) {
                    s += 18;
                    if (t.length() >= 4) {
                        s += 4;
                    }
                }
            }
        }
        if (web.getKcal() >= 30) {
            s += Math.min(web.getKcal() * 0.04, 12);
        }
        if (web.getProtein() >= 0.05) {
            s += Math.min(web.getProtein() * 3, 14);
        }
        return s;
    }

    private boolean trustOpenFoodForVision(String visionName, OpenFoodPick pick, boolean packagedProductFlow) {
        if (pick == null || pick.item() == null) {
            return false;
        }
        double minScore = packagedProductFlow ? 10 : 17;
        if (pick.score() >= minScore) {
            return true;
        }
        return namesOverlapVisionProduct(visionName, pick.item());
    }

    private boolean namesOverlapVisionProduct(String visionName, AiFoodItemResponse web) {
        String q = normalizeFoodName(visionName);
        String n = normalizeFoodName(web.getAd());
        if (q.isEmpty() || n.isEmpty()) {
            return false;
        }
        if (n.contains(q) || q.contains(n)) {
            return true;
        }
        for (String t : q.split("\\s+")) {
            if (t.length() >= 3 && n.contains(t)) {
                return true;
            }
        }
        return false;
    }

    private double parseDoubleNode(JsonNode node, String key) {
        if (node == null || node.isMissingNode()) return 0;
        JsonNode n = node.path(key);
        if (n.isMissingNode() || n.isNull()) return 0;
        if (n.isNumber()) return n.asDouble();
        String txt = n.asText("").replace(",", ".").trim();
        if (txt.isBlank()) return 0;
        try {
            return Double.parseDouble(txt);
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
