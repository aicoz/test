// paddle.js - MuVu TalkScribe License Module (Completed)
// - chrome.storage.local based
// - verify backend: POST to MU_VERIFY_URL
// - deviceId persist, trial management, local daily quota management
// - usage timer that decrements remainingMs and sends messages when exhausted

const Paddle = (() => {
  // ---------------- CONFIG ----------------
  const MU_PADDLE_PRICE_ID   = "pri_01k4ertq7jkbb25tb9s1g77t49";
  const MU_VERIFY_URL = "https://muvusoft.site/serv_chr_talks/verify.php";
  const MU_REPORT_USAGE_URL = "https://muvusoft.site/api/report_usage.php"; // optional
  const TRIAL_DAYS = 5;
  const DAILY_FREE_MINUTES = 10;
  const DAILY_FREE_MS = DAILY_FREE_MINUTES * 60 * 1000;

  // How often to tick the usage timer (ms)
  const USAGE_TICK_MS = 1000;

  // ---------------- State ----------------
  let usageInterval = null;
  let lastServerResponse = null; // cached server response object
  let serverCacheExpiresAt = 0; // timestamp ms when server cache expires

  // ---------------- Helpers: Promisified chrome.storage ----------------
  function storageGet(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, items => resolve(items || {}));
    });
  }
  function storageSet(obj) {
    return new Promise(resolve => {
      chrome.storage.local.set(obj, () => resolve());
    });
  }
  function storageRemove(keys) {
    return new Promise(resolve => {
      chrome.storage.local.remove(keys, () => resolve());
    });
  }

  // ---------------- Device ID ----------------
  async function getDeviceId() {
    const items = await storageGet(['deviceId']);
    if (items.deviceId) return items.deviceId;

    // Create a reasonably random persistent id
    const newId = 'dev-' + Math.random().toString(36).slice(2, 11);
    await storageSet({ deviceId: newId });
    console.log("[Paddle] New deviceId generated:", newId);
    return newId;
  }

  // ---------------- Fingerprint (client-side) ----------------
  function collectFingerprint() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';

    let tz = '';
    try { 
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; 
    } catch(e) { tz = ''; }

    const lang = navigator.language || '';

    // Ekran bilgisi sadece content script veya popup context'te mevcut
    let scr = '';
    if (typeof screen !== 'undefined' && screen && screen.width && screen.height) {
        scr = `${screen.width}x${screen.height}`;
    }

    return { ua, platform, tz, lang, scr };
  }

  // ---------------- Server verify (calls backend) ----------------
  async function verifyLicense(deviceId, force = false) {
    // Use cached server response if available and not forced
    const now = Date.now();
    if (!force && lastServerResponse && serverCacheExpiresAt > now) {
      // return cached
      return lastServerResponse;
    }

    const fingerprint = collectFingerprint();
    try {
      const resp = await fetch(MU_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, fingerprint })
      });

      if (!resp.ok) {
        console.warn("[Paddle] verifyLicense: server returned", resp.status);
        return null;
      }

      const result = await resp.json();

      // Normalize server fields we expect
      // set defaults to be defensive
      result.clientCacheSeconds = Number(result.clientCacheSeconds || 120);
      result.serverTime = Number(result.serverTime || Math.floor(now / 1000));
      result.freeDailySecondsRemaining = Number(result.freeDailySecondsRemaining || 0);
      result.plan = result.plan || 'free';

      lastServerResponse = result;
      serverCacheExpiresAt = now + (result.clientCacheSeconds * 1000);

      // Persist minimal server info to storage (so other contexts can read)
      await storageSet({
        lastServerResponse: result,
        lastServerResponseAt: now
      });

      return result;
    } catch (err) {
      console.error("[Paddle] verifyLicense error:", err);
      return null;
    }
  }

  // ---------------- init() - prepare storage values ----------------
  // Ensures deviceId present; sets trialStartedAt on first run; resets daily quota at day boundary.
  let isInitialized = false;

  async function init() {
      if (isInitialized) return;
      isInitialized = true;
      
      console.log("[Paddle] Initializing license manager...");

    const deviceId = await getDeviceId();

    // read current values
    const items = await storageGet(['trialStartedAt', 'remainingMs', 'lastUsageDay', 'lastServerResponse', 'lastServerResponseAt']);
    const updates = {};

    // set trialStartedAt if missing
    if (!items.trialStartedAt) {
      updates.trialStartedAt = Date.now();
      console.log("[Paddle] trialStartedAt set to now");
    }

    // reset remainingMs if day changed or missing
    const today = new Date().toISOString().slice(0, 10);
    if (!items.lastUsageDay || items.lastUsageDay !== today) {
      updates.remainingMs = DAILY_FREE_MS;
      updates.lastUsageDay = today;
      console.log("[Paddle] daily usage reset, remainingMs =", DAILY_FREE_MS);
    } else if (typeof items.remainingMs === 'undefined' || items.remainingMs === null) {
      updates.remainingMs = DAILY_FREE_MS;
    }

    // restore server cached response if available and fresh-ish
    if (items.lastServerResponse && items.lastServerResponseAt) {
      lastServerResponse = items.lastServerResponse;
      // use client's stored timestamp to compute expiry
      serverCacheExpiresAt = Number(items.lastServerResponseAt) + (Number(lastServerResponse.clientCacheSeconds || 120) * 1000);
    }

    if (Object.keys(updates).length > 0) {
      await storageSet(updates);
    }

    return deviceId;
  }

  // ---------------- checkLicense() - main gate ----------------
  // Returns boolean: allowed (true) or blocked (false)
  async function checkLicense() {
    // make sure init ran
    const deviceId = await init();

    // 1) client-side trial check
    const items = await storageGet(['trialStartedAt', 'remainingMs']);
    const trialStartedAt = Number(items.trialStartedAt || 0);
    const remainingMs = Number(items.remainingMs || 0);

    if (trialStartedAt) {
      const daysPassed = (Date.now() - trialStartedAt) / (1000 * 60 * 60 * 24);
      if (daysPassed < TRIAL_DAYS) {
        // still inside client trial window
        console.log("[Paddle] Trial active locally (days passed:", Math.floor(daysPassed), ")");
        // If remainingMs is 0 then user exhausted daily free minutes -> block
        if (remainingMs <= 0) {
          console.log("[Paddle] Daily free quota exhausted");
          return false;
        }
        return true;
      }
    }
    // 2) Trial expired locally -> ask server
    const serverResp = await verifyLicense(deviceId);
    if (!serverResp) {
      // server unreachable: apply offline grace policy
      // choose conservative default: allow if within offline grace
      // we'll read offlineGraceMinutes from lastServerResponse if available, otherwise default 30
      const offlineGraceMinutes = (lastServerResponse && lastServerResponse.offlineGraceMinutes) ? Number(lastServerResponse.offlineGraceMinutes) : 30;
      const lastServerTime = (lastServerResponse && lastServerResponse.serverTime) ? Number(lastServerResponse.serverTime) * 1000 : 0;
      if (Date.now() - lastServerTime <= offlineGraceMinutes * 60 * 1000) {
        console.warn("[Paddle] Server unreachable but within offline grace -> allow");
        return true;
      }
      console.warn("[Paddle] Server unreachable and offline grace passed -> block");
      return false;
    }
    // 3) Interpret server response
    // serverResp.plan can be 'trial', 'pro'/'paid', 'free' etc.
    if (serverResp.plan === 'pro' || serverResp.plan === 'paid') {
      return true; // full access
    }
    if (serverResp.plan === 'trial') {
      // still trial on server side; check daily quota
      if (serverResp.freeDailySecondsRemaining <= 0) {
        console.log("[Paddle] Server says daily seconds exhausted");
        return false;
      }
      // update local remainingMs proportional to server free seconds (server uses seconds)
      const freeMs = serverResp.freeDailySecondsRemaining * 1000;
      await storageSet({ remainingMs: freeMs });
      return true;
    }
    if (serverResp.plan === 'free') {
      // limited free plan
      return serverResp.freeDailySecondsRemaining > 0;
    }

    // default: block
    return false;
  }

  // ---------------- Usage Timer ----------------
  // Decrements remainingMs each tick; when hits zero, notifies front-end content scripts
  async function startUsageTimer() {
    if (usageInterval) clearInterval(usageInterval);

    // sanity: ensure init/storage has remainingMs
    await init();
    usageInterval = setInterval(async () => {
      const items = await storageGet(['remainingMs']);
      let remaining = Number(items.remainingMs || 0);

      // decrement
      remaining -= USAGE_TICK_MS;
      if (remaining < 0) remaining = 0;

      await storageSet({ remainingMs: remaining });

      // If remaining becomes zero, notify running tabs to stop recording/using microphone
      if (remaining <= 0) {
        // broadcast to all tabs: message type 'paddle-stop-usage'
        chrome.tabs.query({}, tabs => {
          for (const tab of tabs) {
            try {
              chrome.tabs.sendMessage(tab.id, { type: 'paddle-stop-usage' }, () => { /* ignore */ });
            } catch (e) { /* ignore */ }
          }
        });
        stopUsageTimer();
      }
    }, USAGE_TICK_MS);

    console.log("[Paddle] Usage timer started");
  }

  function stopUsageTimer() {
    if (usageInterval) {
      clearInterval(usageInterval);
      usageInterval = null;
      console.log("[Paddle] Usage timer stopped");
    }
  }

  // ---------------- Optional: Report usage to server ----------------
  async function reportUsage(deviceId, secondsUsed) {
    try {
      await fetch(MU_REPORT_USAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, secondsUsed })
      });
    } catch (e) {
      console.warn("[Paddle] reportUsage failed:", e);
    }
  }

  // ---------------- Open Checkout (via pay.html + Paddle.js overlay) ----------------
  function openCheckout(email = null) {
    getDeviceId().then(deviceId => {
      const params = new URLSearchParams({
        price_id: MU_PADDLE_PRICE_ID,   // pri_... olan price id
        email: email || '',
        deviceId: deviceId
      });

      const url = `https://muvusoft.site/serv_chr_talks/pay.html?${params}`;
      console.log('[Paddle] Opening overlay checkout via:', url);
      chrome.tabs.create({ url });
    });
  }

  // ---------------- Message handlers (for content scripts) ----------------
  // Example: content script asks 'checkLicense' before starting mic
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    (async () => {
      if (!msg || !msg.type) return;
      if (msg.type === 'paddle-check-license') {
        const ok = await checkLicense();
        reply({ ok });
      } else if (msg.type === 'get_license_status') {
        // Account page calls this: do a forced verify and return the server response
        const deviceId = await getDeviceId();
        const resp = await verifyLicense(deviceId, true); // force fresh server check
        reply(resp || { error: 'no response' });
      } else if (msg.type === 'paddle-start-usage-timer') {
        await startUsageTimer();
        reply({ started: true });
      } else if (msg.type === 'paddle-stop-usage-timer') {
        stopUsageTimer();
        reply({ stopped: true });
      } else if (msg.type === 'paddle-open-checkout') {
        openCheckout(msg.email || null);
        reply({ opened: true });
      } else {
        // unknown
        reply({ error: 'unknown message type' });
      }
    })();
    // Return true to indicate async reply
    return true;
  });

  // ---------------- Auto init on extension startup/installed ----------------
  chrome.runtime.onStartup.addListener(() => {
    init().catch(e => console.error("[Paddle] init error:", e));
  });
  chrome.runtime.onInstalled.addListener(() => {
    init().catch(e => console.error("[Paddle] init error:", e));
  });

  // ---------------- Public API ----------------
  return {
    init,
    checkLicense,
    verifyLicense,
    openCheckout,
    startUsageTimer,
    stopUsageTimer,
    getDeviceId,
    reportUsage
  };
})();

// Auto-run init (background context)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  Paddle.init().catch(e => console.error('[Paddle] init failed:', e));
}
