-- AISA / SaglikAsistani — bos veritabani icin tablo + test kullanici
-- Neon: SQL Editor'de calistir VEYA psql ile baglanip \i init-db.sql
--
-- NOT: Uygulamayi mvn spring-boot:run ile acarsan JPA da tablolari olusturur
--      (spring.jpa.hibernate.ddl-auto=update). Besin listesi icin data.sql otomatik yuklenir.

BEGIN;

-- Temiz kurulum (sifir DB). Veri varsa DIKKAT: hepsini siler.
DROP TABLE IF EXISTS food_entries CASCADE;
DROP TABLE IF EXISTS goals_and_limits CASCADE;
DROP TABLE IF EXISTS daily_logs CASCADE;
DROP TABLE IF EXISTS user_physical_info CASCADE;
DROP TABLE IF EXISTS foods CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    email               VARCHAR(150) NOT NULL UNIQUE,
    password            VARCHAR(255) NOT NULL,
    ad                  VARCHAR(50),
    soyad               VARCHAR(50),
    rol                 VARCHAR(20),
    email_dogrulandi_mi BOOLEAN,
    created_at          TIMESTAMP
);

CREATE TABLE user_physical_info (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dogum_tarihi        DATE,
    cinsiyet            VARCHAR(10),
    boy                 DOUBLE PRECISION,
    hedef_kilo          DOUBLE PRECISION,
    aktivite_seviyesi   VARCHAR(20),
    updated_at          TIMESTAMP
);

CREATE TABLE daily_logs (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tarih                 DATE NOT NULL,
    guncel_kilo           DOUBLE PRECISION,
    icilen_su_miktari     INTEGER,
    toplam_alinan_kalori   INTEGER,
    toplam_protein        DOUBLE PRECISION,
    created_at            TIMESTAMP,
    UNIQUE (user_id, tarih)
);

CREATE TABLE foods (
    id              BIGSERIAL PRIMARY KEY,
    yemek_adi       VARCHAR(100) NOT NULL,
    birim_miktar    VARCHAR(50),
    birim_kalori    INTEGER NOT NULL,
    birim_protein   DOUBLE PRECISION,
    birim_karb      DOUBLE PRECISION,
    birim_yag       DOUBLE PRECISION
);

CREATE TABLE food_entries (
    id              BIGSERIAL PRIMARY KEY,
    daily_log_id    BIGINT NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
    food_id         BIGINT NOT NULL REFERENCES foods(id),
    ogun_tipi       VARCHAR(20),
    miktar          DOUBLE PRECISION NOT NULL,
    aciklama        VARCHAR(600),
    toplam_kalori   INTEGER,
    toplam_protein  DOUBLE PRECISION,
    toplam_karb     DOUBLE PRECISION,
    toplam_yag      DOUBLE PRECISION,
    created_at      TIMESTAMP
);

CREATE TABLE goals_and_limits (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    gunluk_hedef_kalori   INTEGER,
    created_at            TIMESTAMP,
    updated_at            TIMESTAMP
);

CREATE INDEX idx_upi_user ON user_physical_info(user_id);
CREATE INDEX idx_daily_logs_user_tarih ON daily_logs(user_id, tarih);
CREATE INDEX idx_food_entries_daily_log ON food_entries(daily_log_id);
CREATE INDEX idx_foods_adi ON foods(yemek_adi);

-- Test kullanici (uygulama sifreyi duz metin karsilastiriyor)
INSERT INTO users (email, password, ad, soyad, rol, email_dogrulandi_mi, created_at)
VALUES (
    'test@aisa.local',
    '123456',
    'Test',
    'Kullanici',
    'USER',
    FALSE,
    NOW()
);

-- Ornek besin (data.sql yuklenmezse en az bir kayit olsun)
INSERT INTO foods (yemek_adi, birim_miktar, birim_kalori, birim_protein, birim_karb, birim_yag)
VALUES ('Tavuk Göğsü', '100 gr', 165, 31.0, 0.0, 3.6);

COMMIT;

-- Giris bilgileri:
--   E-posta : test@aisa.local
--   Sifre   : 123456
