package com.alper.saglikasistani.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_physical_info")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPhysicalInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "dogum_tarihi")
    private LocalDate dogumTarihi;

    @Column(length = 10)
    private String cinsiyet;

    private Double boy;

    @Column(name = "hedef_kilo")
    private Double hedefKilo;

    @Column(name = "aktivite_seviyesi", length = 20)
    private String aktiviteSeviyesi;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}