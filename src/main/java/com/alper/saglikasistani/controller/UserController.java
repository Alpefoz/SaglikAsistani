package com.alper.saglikasistani.controller;

import com.alper.saglikasistani.dto.LoginRequest;
import com.alper.saglikasistani.dto.UserRegisterRequest;
import com.alper.saglikasistani.dto.UserResponse;
import com.alper.saglikasistani.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/kayit")
    public ResponseEntity<UserResponse> kayitOl(@RequestBody UserRegisterRequest request) {
        return ResponseEntity.ok(userService.kayitOl(request));
    }

    @PostMapping("/giris")
    public ResponseEntity<UserResponse> girisYap(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(userService.girisYap(request));
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> tumKullanicilariGetir() {
        return ResponseEntity.ok(userService.tumKullanicilariGetir());
    }
}