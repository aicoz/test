// background.js - MuVu TalkScribe (Premium Entegrasyonlu)
// Orijinal kod korunmuş, License Gatekeeper entegre edilmiştir.

importScripts("paddlem.js");
importScripts("limits.js"); // trial/limit manager (minimal, storage-based) // Paddle/license.js modülünü içe aktar

let isActive = false;
let activeTabId = null;
let disabledTabs = [];
let pendingTabId = null;

// Set to true to allow debug logs (keeps behavior identical when false)
const DEBUG = false;

// ==================== LİSANS KONTROL (GATEKEEPER) FONKSİYONLARI ====================
/**
 * Mikrofon açılmadan önce çağrılacak merkezi izin kontrol fonksiyonu.
 * @returns {Promise<boolean>} true: mikrofon açılabilir, false: açılamaz.
 */
async function checkLicenseBeforeStart() {
  try {
    const isAllowed = await Paddle.checkLicense();
    if (!isAllowed) {
      // Lisans yoksa, aktif tab'da bir bildirim göster.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          safeSendMessage(tabs[0].id, {
            action: "show_notification",
            message: "🚫 Free quota exceeded or trial expired. Please upgrade to continue.",
            persist: true // Bildirimin otomatik kaybolmaması için flag
          });
        }
      });
      // Kullanıcıyı hesap sayfasına yönlendirmek isteyebilirsin.
      // chrome.tabs.create({ url: chrome.runtime.getURL("account.html") });
    }
    return isAllowed;
  } catch (error) {
    console.error("License check error:", error);
    // Sunucuya ulaşılamazsa, kullanıcı deneyimi için izin ver (veya daha katı davran).
    // Öneri: Offline durumda çalışmaya devam et, ama bir sonraki çevrimiçi kontrolü bekle.
    return true;
  }
}

/**
 * Güvenli bir şekilde bildirim gönderir ve lisans kontrolü yapar.
 * Mevcut safeSendMessage'nin önüne bir gatekeeper ekler.
 * @param {number} tabId
 * @param {any} message
 * @param {function} [cb]
 */
async function safeSendMessageWithLicenseCheck(tabId, message, cb) {
  // Sadece "start" action için lisans kontrolü yap.
  if (message && message.action === "start") {
    const isAllowed = await checkLicenseBeforeStart();
    if (!isAllowed) {
      // İzin yoksa, callback'i çağır ve işlemi durdur.
      if (typeof cb === 'function') {
        try { cb({ success: false, reason: "license_denied" }); } catch (e) { if (DEBUG) console.debug(e); }
      }
      return Promise.resolve();
    }
  }
  // İzin varsa veya "start" dışı bir mesajsa, normal gönderme işlemine devam et.
  return safeSendMessage(tabId, message, cb);
}
// ==================== LİSANS KONTROL SONU ====================

/**
 * Safely send a message to a tab without causing uncaught promise rejections
 * Preserves optional callback behavior.
 * @param {number} tabId
 * @param {any} message
 * @param {function} [cb]
 * @returns {Promise<void>|void}
 */
function safeSendMessage(tabId, message, cb) {
  if (typeof tabId !== 'number') {
    if (typeof cb === 'function') cb();
    return Promise.resolve();
  }
  try {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        if (DEBUG) console.debug('safeSendMessage lastError for tab', tabId, chrome.runtime.lastError.message);
      }
      if (typeof cb === 'function') {
        try { cb(response); } catch (e) { if (DEBUG) console.debug(e); }
      }
    });
    return Promise.resolve();
  } catch (err) {
    try {
      const maybePromise = chrome.tabs.sendMessage(tabId, message);
      if (maybePromise && typeof maybePromise.then === 'function') {
        return maybePromise.then((res) => {
          if (typeof cb === 'function') {
            try { cb(res); } catch (e) { if (DEBUG) console.debug(e); }
          }
        }).catch((e) => {
          if (DEBUG) console.debug('safeSendMessage promise rejected', e);
          if (typeof cb === 'function') cb();
        });
      } else {
        if (typeof cb === 'function') cb();
        return Promise.resolve();
      }
    } catch (e2) {
      if (DEBUG) console.debug('safeSendMessage final fallback', e2);
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    }
  }
}

/**
 * Safely execute scripting.executeScript and swallow errors
 * Calls optional callback when done.
 * @param {object} details
 * @param {function} [cb]
 */
function safeExecuteScript(details, cb) {
  try {
    const p = chrome.scripting.executeScript(details);
    if (p && typeof p.then === 'function') {
      p.then((result) => {
        if (typeof cb === 'function') {
          try { cb(result); } catch (e) { if (DEBUG) console.debug(e); }
        }
      }).catch((e) => {
        if (DEBUG) console.debug('safeExecuteScript error', e);
        if (typeof cb === 'function') {
          try { cb(); } catch (e2) { if (DEBUG) console.debug(e2); }
        }
      });
    } else {
      if (typeof cb === 'function') cb();
    }
  } catch (err) {
    try {
      chrome.scripting.executeScript(details, (res) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          if (DEBUG) console.debug('safeExecuteScript lastError', chrome.runtime.lastError.message);
        }
        if (typeof cb === 'function') {
          try { cb(res); } catch (e) { if (DEBUG) console.debug(e); }
        }
      });
    } catch (e2) {
      if (DEBUG) console.debug('safeExecuteScript final fallback', e2);
      if (typeof cb === 'function') cb();
    }
  }
}

// Reset microphone function
function resetMicrophone() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const tab = tabs[0];
      safeSendMessage(tab.id, { action: "stop" }, () => {
        setTimeout(() => {
          safeSendMessage(tab.id, { action: "start" }, () => {
            setTimeout(() => {
              safeSendMessage(tab.id, { action: "stop" }, () => {
                setTimeout(() => {
                  safeSendMessage(tab.id, { action: "start" });
                }, 150);
              });
            }, 150);
          });
        }, 150);
      });
    }
  });
}

// Toggle language function
function toggleLanguage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const tab = tabs[0];
      chrome.storage.sync.get(["recognitionLang", "previousRecognitionLang"], (result) => {
        const currentLang = result.recognitionLang;
        const previousLang = result.previousRecognitionLang;
        let targetLang;
        let newPreviousLang;
        if (previousLang && previousLang !== currentLang) {
          targetLang = previousLang;
          newPreviousLang = currentLang;
        } else {
          targetLang = (currentLang === 'tr-TR') ? 'en-US' : 'tr-TR';
          newPreviousLang = currentLang;
        }
        chrome.storage.sync.set({
          recognitionLang: targetLang,
          previousRecognitionLang: newPreviousLang
        }, () => {
          chrome.tabs.query({}, (tabsToNotify) => {
            tabsToNotify.forEach((tabToNotify) => {
              if (tabToNotify && typeof tabToNotify.id === 'number') {
                safeSendMessage(tabToNotify.id, { action: "language_changed" });
              }
            });
          });
        });
      });
    }
  });
}

// Toggle Dictation Pad function
function toggleDictationPad(tabId) {
  safeExecuteScript({
    target: { tabId },
    func: () => {
      if (typeof window.toggleDictationPad === "function") {
        window.toggleDictationPad();
      } else {
        chrome.runtime.sendMessage({ action: "load_dictation_pad" });
      }
    }
  });
}


// İlk Kurulum
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});


// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "recognition_started") {
    if (activeTabId !== sender.tab.id) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((t) => {
          if (t.id !== sender.tab.id && !disabledTabs.includes(t.id)) {
            safeSendMessage(t.id, {
              action: "stop",
              message: "Microphone Is Being Used By Another Application Or Tab",
              setIconGray: true
            });
          }
        });
      });
      activeTabId = sender.tab.id;
      isActive = true;
      chrome.action.setIcon({
        path: { "16": "icons/icon-red-16.png", "32": "icons/icon-red-32.png" }
      });
      disabledTabs = disabledTabs.filter(id => id !== sender.tab.id);
    }
  }
  else if (message.action === "recognition_ended") {
    if (sender.tab.id === activeTabId) {
      isActive = false;
      activeTabId = null;
      chrome.action.setIcon({
        path: { "16": "icons/icon-gray-16.png", "32": "icons/icon-gray-32.png" }
      });
      if (pendingTabId !== null) {
        safeSendMessage(pendingTabId, { action: "start" });
        pendingTabId = null;
      }
    }
  }
  else if (message.action === "disable_tab") {
    if (!disabledTabs.includes(sender.tab.id)) {
      disabledTabs.push(sender.tab.id);
    }
    if (sender.tab.id === activeTabId) {
      isActive = false;
      activeTabId = null;
      chrome.action.setIcon({
        path: { "16": "icons/icon-gray-16.png", "32": "icons/icon-gray-32.png" }
      });
      if (pendingTabId !== null) {
        safeSendMessage(pendingTabId, { action: "start" });
        pendingTabId = null;
      }
    }
  }
  else if (message.action === "language_changed") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab && typeof tab.id === 'number') {
          safeSendMessage(tab.id, { action: "language_changed" });
        }
      });
    });
  }
  else if (message.action === "revert_language") {
    toggleLanguage();
  }
  else if (message.action === "select_language") {
    if (sender && sender.tab && typeof sender.tab.id === 'number') {
      safeExecuteScript({
        target: { tabId: sender.tab.id },
        files: ["overlay.js"]
      });
    }
  }
  else if (message.action === "show_shortcuts") {
    chrome.tabs.create({ url: chrome.runtime.getURL("shortcut_info.html") });
  }
  else if (message.action === "reset_microphone") {
    resetMicrophone();
  }
  else if (message.action === "load_dictation_pad") {
    safeExecuteScript({
      target: { tabId: sender.tab.id },
      files: ["dictation_pad.js"]
    }, () => {
      safeExecuteScript({
        target: { tabId: sender.tab.id },
        func: () => {
          if (typeof window.toggleDictationPad === "function") {
            window.toggleDictationPad();
          }
        }
      });
    });
  }
  else if (message.type === 'get_license_status') {
    (async () => {
      try {
        const deviceId = await Paddle.getDeviceId();
        const detailedStatus = await Paddle.verifyLicense(deviceId, false);
        sendResponse(detailedStatus);
      } catch (error) {
        console.error("get_license_status error:", error);
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
  else if (message.type === 'open_checkout') {
    Paddle.openCheckout(message.email || null);
    sendResponse({ success: true });
  }
// ... account.js ile ilgili kodlar ...
  else if (message.action === "show_notification") {
    // Bu mesajı content.js'e iletmek için yönlendir.
    if (sender && sender.tab && typeof sender.tab.id === 'number') {
      safeSendMessage(sender.tab.id, message);
    }
  }
});
// ==================== TOOLBAR CLICK - LİSANSLI VERSİYON ====================
chrome.action.onClicked.addListener(async (tab) => {
  // [+] ÖNCE LİSANS KONTROLÜ
  const isAllowed = await checkLicenseBeforeStart();
  if (!isAllowed) {
    return; // İzin yoksa, fonksiyondan çık. Hiçbir şey yapma.
  }

  // [-] Aşağısı ORJINAL KOD (Aynen korundu)
  if (disabledTabs.includes(tab.id)) {
    disabledTabs = disabledTabs.filter(id => id !== tab.id);
  }
  if (isActive && activeTabId === tab.id) {
    isActive = false;
    activeTabId = null;
    chrome.action.setIcon({
      path: { "16": "icons/icon-gray-16.png", "32": "icons/icon-gray-32.png" }
    });
    safeSendMessage(tab.id, { action: "stop" }, () => {
    });
  } else if (isActive && activeTabId !== tab.id) {
    pendingTabId = tab.id;
    if (typeof activeTabId === "number") {
      safeSendMessage(activeTabId, {
        action: "stop",
        message: "Microphone Is Being Used By Another Application Or Tab"
      }, () => {
      });
    }
  } else {
    isActive = true;
    activeTabId = tab.id;
    chrome.action.setIcon({
      path: { "16": "icons/icon-red-16.png", "32": "icons/icon-red-32.png" }
    });
    // [-] safeSendMessage yerine LİSANSLI VERSİYONU kullan
    safeSendMessageWithLicenseCheck(tab.id, { action: "start" }, () => {
    });
  }
});
// ==================== TOOLBAR CLICK SONU ====================

// ==================== KEYBOARD SHORTCUT - LİSANSLI VERSİYON ====================
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-listening") {
    // [+] ÖNCE LİSANS KONTROLÜ
    const isAllowed = await checkLicenseBeforeStart();
    if (!isAllowed) {
      return; // İzin yoksa, fonksiyondan çık. Hiçbir şey yapma.
    }
    // Lisans varsa, mevcut click handler'ını tetikle.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.action.onClicked.dispatch(tabs[0]);
      }
    });
  } else {
    // Diğer komutlar için orijinal mantık
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      switch (command) {
        case "reset-microphone":
          resetMicrophone();
          break;
        case "toggle-language":
          toggleLanguage();
          break;
        case "toggle-dictation-pad":
          toggleDictationPad(tabId);
          break;
      }
    });
  }
});
// ==================== KEYBOARD SHORTCUT SONU ====================

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "revert-language", title: "🔵 Revert Language", contexts: ["action"] });
  chrome.contextMenus.create({ id: "select-language", title: "🎤 Select Language", contexts: ["action"] });
  chrome.contextMenus.create({ id: "dictation-pad", title: "📝 Dictation Pad", contexts: ["action"] });
  chrome.contextMenus.create({ id: "shortcut-info", title: "⌨️ Keyboard Shortcuts", contexts: ["action"] });
  chrome.contextMenus.create({ id: "account-page", title: "👤 My Account", contexts: ["action"] });
  chrome.contextMenus.create({ id: "reset-microphone", title: "⭕ Reset Microphone", contexts: ["action"] });
});

// Context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "revert-language":
      toggleLanguage();
      break;
    case "select-language":
      if (tab && typeof tab.id === 'number') {
        safeExecuteScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
      }
      break;
    case "dictation-pad":
      toggleDictationPad(tab.id);
      break;
    case "shortcut-info":
      chrome.tabs.create({ url: chrome.runtime.getURL("shortcut_info.html") });
      break;
    case "reset-microphone":
      resetMicrophone();
      break;
    case "account-page":
      chrome.tabs.create({ url: chrome.runtime.getURL("account.html") });
      break;
  }
});

// Tab close cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    isActive = false;
    activeTabId = null;
    chrome.action.setIcon({ path: { "16": "icons/icon-gray-16.png", "32": "icons/icon-gray-32.png" } });
  }
  if (tabId === pendingTabId) {
    pendingTabId = null;
  }
  disabledTabs = disabledTabs.filter(id => id !== tabId);
});

// Uzantı ilk yüklendiğinde veya açıldığında Paddle modülünü başlat
chrome.runtime.onStartup.addListener(() => {
  if (Paddle && typeof Paddle.init === 'function') {
    Paddle.init();
  }
});
chrome.runtime.onInstalled.addListener(() => {
  if (Paddle && typeof Paddle.init === 'function') {
    Paddle.init();
  }
});