<?php
// lib.php - DÜZELTİLMİŞ ve ÇALIŞIR VERSİYON
require_once __DIR__ . '/config.php';

// Onun yerine, okunabilirlik için 'arr' takma adını doğrudan kullanacağız.

function storage_path($name) { return STORAGE_DIR . '/' . $name . '.json'; }
function load_json($name) {
  $p = storage_path($name);
  if (!file_exists($p)) return [];
  $s = file_get_contents($p);
  $j = json_decode($s, true);
  return is_array($j) ? $j : [];
}
function save_json($name, $data) {
  $p = storage_path($name);
  file_put_contents($p, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
function now_ts() { return time(); }
function today_key() { return gmdate('Ymd'); }

function norm_email($email) {
  $e = trim(strtolower($email ?? ''));
  return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : '';
}
function sha($s) { return hash('sha256', $s); }

function fp_hash($fp) {
  $src = ($fp['ua'] ?? '') . '|' . ($fp['platform'] ?? '') . '|' . ($fp['tz'] ?? '') . '|' . ($fp['lang'] ?? '') . '|' . ($fp['scr'] ?? '');
  return sha($src);
}

function ensure_device(&$devices, $deviceId, $fph) {
  if (!$deviceId) return null;
  if (!isset($devices[$deviceId])) {
    $devices[$deviceId] = [
      'deviceId' => $deviceId,
      'fph' => $fph,
      'firstSeen' => now_ts(),
      'trialStart' => now_ts(),
      'trialExtended' => false,
      'linkedAccount' => '',
      'lastSeen' => now_ts(),
      'daily' => []
    ];
  } else {
    $devices[$deviceId]['lastSeen'] = now_ts();
    if (empty($devices[$deviceId]['fph']) && $fph) $devices[$deviceId]['fph'] = $fph;
  }
  return $devices[$deviceId];
}

function find_account_by_email(&$accounts, $email) {
  $n = norm_email($email);
  if (!$n) return null;
  foreach ($accounts as $id => $acc) {
    if (($acc['email'] ?? '') === $n) return $acc;
  }
  return null;
}

function ensure_account_for_email(&$accounts, $email) {
  $n = norm_email($email);
  if (!$n) return null;
  foreach ($accounts as $id => $acc) {
    if (($acc['email'] ?? '') === $n) return $acc;
  }
  $id = 'acc_' . substr(sha($n . '|' . now_ts()), 0, 16);
  $accounts[$id] = [
    'accountId' => $id,
    'email' => $n,
    'proUntil' => 0,
    'subscriptionActive' => false,
    'createdAt' => now_ts(),
    'notes' => ''
  ];
  return $accounts[$id];
}

function link_device_to_account(&$devices, &$accounts, $deviceId, $accountId) {
  if (!$deviceId || !$accountId) return;
  if (!isset($devices[$deviceId])) return;
  $devices[$deviceId]['linkedAccount'] = $accountId;
}

function merge_trial_if_same_fp(&$devices, $deviceId, $fph) {
  foreach ($devices as $id => $d) {
    if ($id === $deviceId) continue;
    if (($d['fph'] ?? '') === $fph && ($d['firstSeen'] ?? 0) >= $cut) {
      $devices[$deviceId]['trialStart'] = min($devices[$deviceId]['trialStart'], $d['trialStart']);
      $devices[$deviceId]['trialExtended'] = $devices[$deviceId]['trialExtended'] || ($d['trialExtended'] ?? false);
      return;
    }
  }
}

function seconds_used_today(&$device) {
  $k = today_key();
  $d = $device['daily'] ?? [];
  return intval($d[$k] ?? 0);
}
function add_usage_seconds(&$device, $seconds) {
  $k = today_key();
  if (!isset($device['daily'])) $device['daily'] = [];
  $device['daily'][$k] = intval($device['daily'][$k] ?? 0) + max(0, intval($seconds));
}

function is_pro($acc) {
  return (($acc['subscriptionActive'] ?? false) || (now_ts() < intval($acc['proUntil'] ?? 0)));
}

function trial_days_remaining($device) {
  $start = intval($device['trialStart'] ?? now_ts());
  $span = INITIAL_TRIAL_DAYS + (($device['trialExtended'] ?? false) ? EXTENDED_TRIAL_DAYS : 0);
  $end = $start + ($span * 86400);
  $left = ceil(($end - now_ts()) / 86400);
  return max(0, $left);
}

function compute_plan($devices, $accounts, $device) {
  $plan = 'free';
  $linked = $device['linkedAccount'] ?? '';
  $acc = $linked && isset($accounts[$linked]) ? $accounts[$linked] : null;
  if ($acc && is_pro($acc)) {
    $plan = 'pro';
    return [$plan, $acc];
  }
  if (trial_days_remaining($device) > 0) {
    $plan = 'trial';
  }
  return [$plan, $acc];
}

function make_response($plan, $acc, $device) {
  $days = trial_days_remaining($device);
  $used = seconds_used_today($device);
  $remain = max(0, FREE_DAILY_SECONDS - $used);
  $resp = [
    'plan' => $plan,
    'trialDaysRemaining' => $days,
    'freeDailySecondsRemaining' => $remain,
    'clientCacheSeconds' => CLIENT_CACHE_SECONDS,
    'offlineGraceMinutes' => OFFLINE_GRACE_MINUTES,
    'serverTime' => now_ts(),
  ];
  if ($acc) {
    $resp['account'] = [
      'email' => $acc['email'] ?? '',
      'proUntil' => intval($acc['proUntil'] ?? 0),
      'subscriptionActive' => !!($acc['subscriptionActive'] ?? false)
    ];
  }
  return $resp;
}

function json_out($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

function paddle_verify_signature($post) {
  $sig = base64_decode($post['p_signature'] ?? '');
  if (!$sig) return false;
  unset($post['p_signature']);
  ksort($post);
  foreach ($post as $k => $v) {
    if (!is_array($v) && !is_object($v)) continue;
    $post[$k] = json_encode($v);
  }
  $data = serialize($post);
  $ok = openssl_verify($data, $sig, PADDLE_PUBLIC_KEY_PEM, OPENSSL_ALGO_SHA1);
  return $ok === 1;
}