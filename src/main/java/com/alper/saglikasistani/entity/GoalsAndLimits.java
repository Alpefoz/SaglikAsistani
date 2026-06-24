package com.alper.saglikasistani.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "goals_and_limits")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoalsAndLimits {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "gunluk_hedef_kalori")
    private Integer gunlukHedefKalori;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

