# Veritabani kurulumu (yeni Neon / PostgreSQL)

## 1) Baglanti bilgilerini yaz

`src/main/resources/application-local.properties` dosyasina Neon panelinden al:

```properties
spring.datasource.url=jdbc:postgresql://HOST/neondb?sslmode=require
spring.datasource.username=...
spring.datasource.password=...
groq.api.key=gsk_...
```

Ornek dosyaya (`application-local.properties.example`) sifre yazma — git'e gider.

## 2) Tablolari olustur — iki yol

### Yol A — SQL ile (onerilen, bos DB)

1. [Neon Console](https://console.neon.tech) → projen → **SQL Editor**
2. `scripts/init-db.sql` dosyasinin tum icerigini yapistir → **Run**
3. Olusur: 6 tablo + test kullanici + 1 ornek besin

**Test giris:**
- E-posta: `test@aisa.local`
- Sifre: `123456`

### Yol B — Uygulama ile otomatik

```powershell
mvn spring-boot:run
```

- `spring.jpa.hibernate.ddl-auto=update` tablolari olusturur/gunceller
- `data.sql` ~1500 besin kaydini yukler (ilk acilista)
- Test kullanicisi icin Yol A'daki SQL'i calistir veya uygulamadan kayit ol

## 3) Uygulamayi calistir

```powershell
cd c:\Users\alper\Desktop\Genel\SaglikAsistani
mvn spring-boot:run
```

Tarayici: http://localhost:8080

## Tablolar

| Tablo | Aciklama |
|-------|----------|
| users | Kullanici |
| user_physical_info | Boy, kilo, aktivite |
| daily_logs | Gunluk su/kilo/kalori |
| foods | Besin katalogu |
| food_entries | Ogün satirlari |
| goals_and_limits | Hedef kalori |
