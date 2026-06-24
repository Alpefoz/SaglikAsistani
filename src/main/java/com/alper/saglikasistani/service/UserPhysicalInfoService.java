package com.alper.saglikasistani.service;

import com.alper.saglikasistani.dto.UserPhysicalInfoRequest;
import com.alper.saglikasistani.dto.UserPhysicalInfoResponse;
import com.alper.saglikasistani.entity.User;
import com.alper.saglikasistani.entity.UserPhysicalInfo;
import com.alper.saglikasistani.repository.UserPhysicalInfoRepository;
import com.alper.saglikasistani.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserPhysicalInfoService {

    private final UserPhysicalInfoRepository userPhysicalInfoRepository;
    private final UserRepository userRepository;

    public UserPhysicalInfoResponse kaydet(UserPhysicalInfoRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));

        UserPhysicalInfo info = userPhysicalInfoRepository.findTopByUserIdOrderByUpdatedAtDesc(request.getUserId())
                .orElseGet(UserPhysicalInfo::new);

        info.setUser(user);
        info.setDogumTarihi(request.getDogumTarihi());
        info.setCinsiyet(request.getCinsiyet());
        info.setBoy(request.getBoy());
        info.setHedefKilo(request.getHedefKilo());
        info.setAktiviteSeviyesi(request.getAktiviteSeviyesi());
        info.setUpdatedAt(LocalDateTime.now());

        UserPhysicalInfo saved = userPhysicalInfoRepository.save(info);
        return toResponse(saved);
    }

    public UserPhysicalInfoResponse getir(Long userId) {
        List<UserPhysicalInfo> infos = userPhysicalInfoRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        if (infos.isEmpty()) {
            throw new RuntimeException("Fiziksel bilgi bulunamadı!");
        }
        UserPhysicalInfo info = infos.get(0);
        return toResponse(info);
    }

    private UserPhysicalInfoResponse toResponse(UserPhysicalInfo info) {
        return UserPhysicalInfoResponse.builder()
                .id(info.getId())
                .userId(info.getUser().getId())
                .dogumTarihi(info.getDogumTarihi())
                .cinsiyet(info.getCinsiyet())
                .boy(info.getBoy())
                .hedefKilo(info.getHedefKilo())
                .aktiviteSeviyesi(info.getAktiviteSeviyesi())
                .build();
    }
}