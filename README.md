# AISA — Sağlık Asistanı

Kişisel beslenme ve sağlık takibi web uygulaması. Günlük kalori, makro, su ve kilo kaydı; besin arama; barkod ile ürün sorgulama; fotoğraftan yemek analizi (yapay zeka).

**Teknolojiler:** Spring Boot 3, PostgreSQL, Groq API (Llama), HTML/CSS/JS (tek sayfa arayüz)

---

## Gereksinimler

| Bileşen | Açıklama |
|---------|----------|
| **Java 21+** | `java -version` |
| **Maven** | `mvn -version` |
| **PostgreSQL** | [Neon](https://neon.tech) (ücretsiz bulut) veya yerel Docker |
| **Groq API anahtarı** | [console.groq.com/keys](https://console.groq.com/keys) — fotoğraf analizi ve AI özellikleri için **zorunlu** |

> Barkod sorgulama Open Food Facts kullanır; ek API anahtarı gerekmez.

---

## Yerel kurulum

### 1. Gizli ayar dosyası

```powershell
copy src\main\resources\application-local.properties.example src\main\resources\application-local.properties
```

`application-local.properties` dosyasını düzenleyin:

```properties
spring.datasource.url=jdbc:postgresql://HOST.neon.tech/neondb?sslmode=require
spring.datasource.username=neondb_owner
spring.datasource.password=NEON_SIFRENIZ
groq.api.key=gsk_GROQ_ANAHTARINIZ
```

Neon bağlantı dizesindeki host'u **tam** kopyalayın (ör. `...-pooler.c-3.eu-central-1.aws.neon.tech`).

### 2. Veritabanı

Boş veritabanında tablolar uygulama açılışında otomatik oluşur (`ddl-auto=update`). Besin kataloğu `data.sql` ile yüklenir (~1500 kayıt).

İsteğe bağlı: test kullanıcısı için Neon SQL Editor'de `scripts/init-db.sql` çalıştırın.

Detay: [scripts/DB-KURULUM.md](scripts/DB-KURULUM.md)

### 3. Çalıştırma

```powershell
mvn spring-boot:run
```

Tarayıcı: **http://localhost:8080**

`pom.xml` yerel profili (`local`) otomatik açar; `application-local.properties` okunur.

### Alternatif: yerel PostgreSQL (Docker)

```powershell
docker compose up -d
```

`application-local.properties` içinde:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/saglikasistani
spring.datasource.username=postgres
spring.datasource.password=postgres
```

---

## Üretim (Railway vb.)

Ortam değişkenleri — **koda yazmayın:**

| Değişken | Açıklama |
|----------|----------|
| `DB_URL` | `jdbc:postgresql://...` JDBC URL |
| `DB_USERNAME` | Veritabanı kullanıcısı |
| `DB_PASSWORD` | Veritabanı şifresi |
| `GROQ_API_KEY` | Groq API anahtarı |

`application.properties` bu değişkenleri kullanır.

---

## GitHub'a yüklemeden önce

**Asla commit etmeyin:**

- `application-local.properties` (`.gitignore`'da)
- Gerçek API anahtarları veya DB şifreleri
- `.env` dosyaları

**Commit edilebilir:**

- `application-local.properties.example` (sadece placeholder)
- `application.properties` (ortam değişkeni placeholder'ları)

Daha önce anahtar paylaştıysanız Groq ve Neon şifrelerini **yenileyin**.

---

## Proje yapısı

```
src/main/java/...     Backend (controller, service, entity)
src/main/resources/
  static/             Frontend (app.js, style.css)
  data.sql            Besin kataloğu seed verisi
  application.properties
scripts/              DB kurulum SQL ve rehber
```

---

## Lisans

Bitirme projesi — Alper Sandal.
