<?php
// serv_chr_talks/config.php
// TALKSCRIBE ÖZEL KONFİGÜRASYONU

define('STORAGE_DIR', __DIR__ . '/storage');
if (!is_dir(STORAGE_DIR)) { mkdir(STORAGE_DIR, 0775, true); }

// === TRIAL & LIMIT ===
const INITIAL_TRIAL_DAYS = 5;
const EXTENDED_TRIAL_DAYS = 5; // E-posta ile uzatılan ekstra trial
const FREE_DAILY_SECONDS = 10 * 60; // 10 dk (Günlük ücretsiz kota)
const FINGERPRINT_DECAY_DAYS = 90; // Aynı kullanıcıyı tanımak için fingerprint penceresi (gün)
const CLIENT_CACHE_SECONDS = 120; // İstemcinin cevabı cache'leme süresi (saniye)
const OFFLINE_GRACE_MINUTES = 30; // Çevrimdışı çalışmaya izin verilen süre (dakika)
const LOGIN_CODE_TTL_SECONDS = 15 * 60; // E-posta login kodunun geçerlilik süresi (saniye)

// === PADDLE (Classic) ===
const PADDLE_VENDOR_ID = 37526; // Sizin Seller ID'niz
const PADDLE_PRODUCT_IDS = ['pro_01k4ernx93xfxy6bp3dbkbz665']; // Sizin Product ID'niz

// !!! EN KRİTİK ADIM: PUBLIC KEY'İ BURAYA YAPIŞTIRIN !!!
// AŞAĞIDAKİ SATIRLARI PADDLE DASHBOARD'DAN ALDIĞINIZ GERÇEK PUBLIC KEY İLE DEĞİŞTİRİN
const PADDLE_PUBLIC_KEY_PEM = <<<PEM
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEApZa1L29g+PuGP6V1PU2c
VcZ3poNxkqimLz094Py/xoTe6FPZNc1RCkhJ3JdLA0J5JkK4foA/kpvwFTTrfVKZ
NWto7wNS8eopvqrRKTU2zZ3/yuXndY/4j4eH/i1PL6XqU/D7oyzaLD0KU+hFDYVW
xhguxZthdDaIhKbJhthcUvf5Q51Pb9FGFtER9FNikiasGiHMVoF96N7oBHM1dfB+
80kWPXoPBt6EmiJ7vRZkB7eewesD+rooXPN4PA1itcW2vCG6y8r8qoIZG9FdiH1F
FjXi8uIsJysrnP8GIQh9nbIdt2yNzn+VK9Cz29cz8bNEY0uUBZtaIyjIr6t843+j
6AtlHmbeED3JLcgYJLRdWT8nOXJPCSFKnlwqJs139F7II3wiN2VTKf+B8tzCFDFu
B6indmDURcpZSkmBbCwCfj9Zsu4eVtg/p04s/Rm5u0DtaBUEux09AMFWDeQHSo81
qzITJdjUwbGTdlXFaej5BURLaMjzDdXEe2FjyuT6lw0RgbFKYNHRpMZaCRVOoEwO
QtLjST7gIXrRLxkrw/p7wppD+IJNoIdr0qbJ30kSKfRckeqEoQ6ka1w7xGrDRZQI
voADXREDfEYBuNda328O3eNrPeS9+Gfok7c8EdjFx0bHz8I1SQET4vcLA7L6KmxX
fer44ugDn8aOk/FRDXrHFJMCAwEAAQ==
PEM;

// === Güvenlik / Çeşitli ===
// Bu dosya dışarıdan erişilemez olmalıdır.
// Eğer erişilebilirse, PADDLE_PUBLIC_KEY_PEM güvenliği tehlikeye girer.
?>