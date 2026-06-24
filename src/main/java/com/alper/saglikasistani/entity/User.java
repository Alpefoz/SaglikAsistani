package com.alper.saglikasistani.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 150)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(length = 50)
    private String ad;

    @Column(length = 50)
    private String soyad;

    @Column(length = 20)
    private String rol;

    @Column(name = "email_dogrulandi_mi")
    private Boolean emailDogrulandiMi;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}