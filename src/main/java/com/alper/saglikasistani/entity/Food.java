package com.alper.saglikasistani.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "foods")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Food {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "yemek_adi", nullable = false, length = 100)
    private String yemekAdi;

    @Column(name = "birim_miktar", length = 50)
    private String birimMiktar;

    @Column(name = "birim_kalori", nullable = false)
    private Integer birimKalori;

    @Column(name = "birim_protein")
    private Double birimProtein;

    @Column(name = "birim_karb")
    private Double birimKarb;

    @Column(name = "birim_yag")
    private Double birimYag;
}
