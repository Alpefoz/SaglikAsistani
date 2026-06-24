package com.alper.saglikasistani.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "food_entries")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FoodEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "daily_log_id", nullable = false)
    private DailyLog dailyLog;

    @ManyToOne
    @JoinColumn(name = "food_id", nullable = false)
    private Food food;

    @Column(name = "ogun_tipi", length = 20)
    private String ogunTipi;

    @Column(nullable = false)
    private Double miktar;

    /** İsteğe bağlı kullanıcı notu (ör. «10 yumurtalı omlet, dürüm») — sepet «Porsiyon & detay» */
    @Column(name = "aciklama", length = 600)
    private String aciklama;

    @Column(name = "toplam_kalori")
    private Integer toplamKalori;

    @Column(name = "toplam_protein")
    private Double toplamProtein;

    @Column(name = "toplam_karb")
    private Double toplamKarb;

    @Column(name = "toplam_yag")
    private Double toplamYag;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
