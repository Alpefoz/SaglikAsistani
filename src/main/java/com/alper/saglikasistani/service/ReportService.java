package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.CalorieDayResponse;
import com.alper.saglikasistani.dto.MacroSummaryResponse;
import com.alper.saglikasistani.dto.ProgressResponse;
import com.alper.saglikasistani.dto.WeightPointResponse;
import com.alper.saglikasistani.repository.DailyLogRepository;
import com.alper.saglikasistani.repository.FoodEntryRepository;
import com.alper.saglikasistani.repository.UserPhysicalInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final DailyLogRepository dailyLogRepository;
    private final UserPhysicalInfoRepository userPhysicalInfoRepository;
    private final FoodEntryRepository foodEntryRepository;

    public List<WeightPointResponse> kiloSerisi(Long userId) {
        return dailyLogRepository.findByUserIdOrderByTarihDesc(userId)
                .stream()
                .filter(l -> l.getGuncelKilo() != null)
                .sorted(Comparator.comparing(l -> l.getTarih()))
                .map(l -> WeightPointResponse.builder()
                        .tarih(l.getTarih())
                        .kilo(l.getGuncelKilo())
                        .build())
                .toList();
    }

    public List<CalorieDayResponse> son7GunKalori(Long userId) {
        LocalDate start = LocalDate.now().minusDays(6);
        return dailyLogRepository.findByUserIdOrderByTarihDesc(userId)
                .stream()
                .filter(l -> l.getTarih() != null && !l.getTarih().isBefore(start))
                .sorted(Comparator.comparing(l -> l.getTarih()))
                .map(l -> CalorieDayResponse.builder()
                        .tarih(l.getTarih())
                        .kalori(l.getToplamAlinanKalori() == null ? 0 : l.getToplamAlinanKalori())
                        .build())
                .toList();
    }

    public MacroSummaryResponse son7GunMakro(Long userId) {
        LocalDate from = LocalDate.now().minusDays(6);
        LocalDate to = LocalDate.now();
        var entries = foodEntryRepository.findByDailyLog_User_IdAndDailyLog_TarihBetween(userId, from, to);
        double p = entries.stream().mapToDouble(e -> e.getToplamProtein() != null ? e.getToplamProtein() : 0).sum();
        double k = entries.stream().mapToDouble(e -> e.getToplamKarb() != null ? e.getToplamKarb() : 0).sum();
        double y = entries.stream().mapToDouble(e -> e.getToplamYag() != null ? e.getToplamYag() : 0).sum();
        return MacroSummaryResponse.builder()
                .toplamProtein(Math.round(p * 10.0) / 10.0)
                .toplamKarb(Math.round(k * 10.0) / 10.0)
                .toplamYag(Math.round(y * 10.0) / 10.0)
                .build();
    }

    public ProgressResponse hedefIlerleme(Long userId) {
        var hedef = userPhysicalInfoRepository.findByUserId(userId).orElse(null);
        Double hedefKilo = hedef == null ? null : hedef.getHedefKilo();

        var logs = dailyLogRepository.findByUserIdOrderByTarihDesc(userId)
                .stream()
                .filter(l -> l.getGuncelKilo() != null)
                .toList();

        Double mevcut = logs.isEmpty() ? null : logs.getFirst().getGuncelKilo();
        Double baslangic = logs.isEmpty() ? null : logs.getLast().getGuncelKilo();

        Double yuzde = null;
        if (baslangic != null && mevcut != null && hedefKilo != null) {
            // Kilo verme hedefi varsayımı: baslangic -> hedef (daha düşük). Artış hedefinde de 0-100'e sıkıştır.
            double total = Math.abs(baslangic - hedefKilo);
            double done = Math.abs(baslangic - mevcut);
            if (total <= 0.000001) {
                yuzde = 100.0;
            } else {
                yuzde = Math.max(0.0, Math.min(100.0, (done / total) * 100.0));
            }
        }

        return ProgressResponse.builder()
                .baslangicKilo(baslangic)
                .mevcutKilo(mevcut)
                .hedefKilo(hedefKilo)
                .yuzde(yuzde)
                .build();
    }
}

