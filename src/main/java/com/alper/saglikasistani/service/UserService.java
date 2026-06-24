package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.LoginRequest;
import com.alper.saglikasistani.dto.UserRegisterRequest;
import com.alper.saglikasistani.dto.UserResponse;
import com.alper.saglikasistani.entity.User;
import com.alper.saglikasistani.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserResponse kayitOl(UserRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Bu e-posta zaten kayıtlı!");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(request.getPassword())
                .ad(request.getAd())
                .soyad(request.getSoyad())
                .rol("USER")
                .emailDogrulandiMi(false)
                .createdAt(LocalDateTime.now())
                .build();

        User saved = userRepository.save(user);
        return toResponse(saved);
    }

    public UserResponse girisYap(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("E-posta veya şifre hatalı!"));

        if (!user.getPassword().equals(request.getPassword())) {
            throw new RuntimeException("E-posta veya şifre hatalı!");
        }

        return toResponse(user);
    }

    public List<UserResponse> tumKullanicilariGetir() {
        return userRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .ad(user.getAd())
                .soyad(user.getSoyad())
                .rol(user.getRol())
                .emailDogrulandiMi(user.getEmailDogrulandiMi())
                .build();
    }
}