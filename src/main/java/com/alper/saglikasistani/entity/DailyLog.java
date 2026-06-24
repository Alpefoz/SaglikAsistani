package com.alper.saglikasistani.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDate tarih;

    @Column(name = "guncel_kilo")
    private Double guncelKilo;

    @Column(name = "icilen_su_miktari")
    private Integer icilenSuMiktari;

    @Column(name = "toplam_alinan_kalori")
    private Integer toplamAlinanKalori;

    @Column(name = "toplam_protein")
    private Double toplamProtein;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}