<?php
// webhook.php - DÜZELTİLMİŞ ve TAM ÇALIŞIR VERSİYON (Paddle v2 için)
require_once __DIR__ . '/lib.php';

// --- 1. V2 İmza Doğrulama Fonksiyonu (lib.php'ye de eklenebilir, burada da çalışır) ---
function paddle_verify_signature_v2($raw_post_data, $public_key) {
    // İmzayı header'dan al
    $signature = $_SERVER['HTTP_PADDLE_SIGNATURE'] ?? '';
    if (empty($signature)) {
        error_log("Paddle Webhook: Signature header missing.");
        return false;
    }

    // İmzayı parçala (format: "ts=123456789,sig=abc123")
    $parts = explode(',', $signature);
    $timestamp = '';
    $sig = '';
    foreach ($parts as $part) {
        if (strpos($part, 'ts=') === 0) {
            $timestamp = substr($part, 3);
        } elseif (strpos($part, 'sig=') === 0) {
            $sig = substr($part, 4);
        }
    }

    if (empty($timestamp) || empty($sig)) {
        error_log("Paddle Webhook: Invalid signature format.");
        return false;
    }

    // Doğrulama için signed_payload'ı oluştur
    $signed_payload = $timestamp . ':' . $raw_post_data;

    // Public Key ile imzayı doğrula
    $ok = openssl_verify(
        $signed_payload,
        hex2bin($sig), // İmza hex formatında, binary'e çevir
        $public_key,
        OPENSSL_ALGO_SHA256
    );

    if ($ok !== 1) {
        error_log("Paddle Webhook: Signature verification failed. Payload: " . $signed_payload);
    }
    return $ok === 1;
}
// ---------------------------------------------------------------------------------

// 2. Gelen ham POST verisini AL
$raw_post_data = file_get_contents('php://input');
$post_data = json_decode($raw_post_data, true);

// 2b. JSON decode başarısız olduysa, hatayı logla ve çık
if ($post_data === null) {
    error_log("Paddle Webhook: JSON decode failed. Raw data: " . $raw_post_data);
    http_response_code(400);
    echo "Invalid JSON";
    exit;
}

// 3. GÜVENLİK: V2 İmza Doğrulaması YAP
if (!paddle_verify_signature_v2($raw_post_data, PADDLE_PUBLIC_KEY_PEM)) {
    http_response_code(403);
    error_log("Paddle Webhook: Invalid signature. Raw data: " . $raw_post_data);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// 4. Webhook tipini ve verileri al (V2 FORMATI)
$event_type = $post_data['event_type'] ?? ''; // V2'de 'alert_name' değil, 'event_type'
$customer_data = $post_data['data'] ?? [];
$customer_email = norm_email($customer_data['email'] ?? '');

// 5. PASSTHROUGH'u al (Bu çok önemli!)
// V2'de custom_data veya passthrough, 'data.custom_data' içinde gelir.
$custom_data = $customer_data['custom_data'] ?? [];
$device_id = $custom_data['deviceId'] ?? '';

// 5b. Eski 'passthrough' formatını da dene (linke ?passthrough=... şeklinde eklenmişse)
if (empty($device_id)) {
    $passthrough_str = $customer_data['passthrough'] ?? '';
    if (!empty($passthrough_str)) {
        $passthrough = json_decode($passthrough_str, true);
        $device_id = $passthrough['deviceId'] ?? '';
    }
}

// 6. Ödeme başarılı event'ini yakala (V2'de event isimleri farklı!)
// https://developer.paddle.com/webhooks/overview
if ($event_type === 'subscription.created') {
    // Veritabanı dosyalarını yükle
    $accounts = load_json('accounts');
    $devices = load_json('devices');

    // Hesabı oluştur/premium yap
    $account = ensure_account_for_email($accounts, $customer_email);
    // ABONELİĞİ AKTİF ET (Subscription)
    $accounts[$account['accountId']]['subscriptionActive'] = true;

    // Device'ı hesaba bağla
    if (!empty($device_id) && isset($devices[$device_id])) {
        link_device_to_account($devices, $accounts, $device_id, $account['accountId']);
        error_log("Paddle Webhook: Device $device_id linked to account " . $account['accountId']);
    } else {
        error_log("Paddle Webhook: WARNING - Could not link device. Device ID: '$device_id'");
    }

    // Değişiklikleri kaydet
    save_json('accounts', $accounts);
    save_json('devices', $devices);

    error_log("Paddle Webhook: Subscription created for $customer_email. Account upgraded to PRO.");
    json_out(['success' => true]);
}
// 7. Diğer event'ler için case'ler ekleyin
else {
    // İstemciye 200 dön, logla.
    error_log("Paddle Webhook: Ignoring event type: $event_type");
    json_out(['success' => true, 'message' => 'Webhook received, no action required.']);
}
?>