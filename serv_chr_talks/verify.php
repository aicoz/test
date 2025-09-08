<?php
// verify.php - Gerçek, Akıllı Versiyon (Sizin Taslağınızdan)
require_once __DIR__ . '/lib.php';

$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!$in) $in = $_POST; // form-POST desteği

$deviceId = trim($in['deviceId'] ?? '');
$fingerprint = $in['fingerprint'] ?? [];
$email = norm_email($in['email'] ?? '');
$usedSeconds = intval($in['addUsageSeconds'] ?? 0); // opsiyonel: anlık kullanım ekleme

if (!$deviceId) json_out(['error' => 'deviceId required'], 400);

$devices = load_json('devices');
$accounts = load_json('accounts');

$fph = fp_hash($fingerprint);
$dev = ensure_device($devices, $deviceId, $fph);

// fingerprint ile önceki device'lardan trial devri
merge_trial_if_same_fp($devices, $deviceId, $fph);

// Eğer email verildiyse hesaba bağla/oluştur
if ($email) {
  $acc = ensure_account_for_email($accounts, $email);
  $accounts[$acc['accountId']] = $acc; // kaydetmek için
  link_device_to_account($devices, $accounts, $deviceId, $acc['accountId']);
}

// Kullanım sayacı ekle (free için günlük limit)
if ($usedSeconds > 0) {
  add_usage_seconds($devices[$deviceId], $usedSeconds);
}

list($plan, $acc) = compute_plan($devices, $accounts, $devices[$deviceId]);

save_json('devices', $devices);
save_json('accounts', $accounts);

json_out(make_response($plan, $acc, $devices[$deviceId]));