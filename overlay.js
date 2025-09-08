(() => {
  // This wraps the entire script in a function scope and prevents 'Illegal return statement' errors.
  // 1. CHECK FOR EXISTING OVERLAY
  const existingOverlay = document.getElementById("konusucu-overlay");
  if (existingOverlay) {
    // If it exists, just make it visible and trigger the animation.
    existingOverlay.style.display = "block";
    existingOverlay.style.animation = "fadeIn 0.2s ease-out";
    // Focus on the input
    const input = existingOverlay.querySelector("input[type=\"text\"]");
    if (input) {
      // Re-render the list and focus on the input
      if (typeof window.renderKonusucuList === "function") {
        window.renderKonusucuList();
      }
      setTimeout(() => input.focus(), 100);
    }
    // Do not run the rest of the script.
    return; 
  }
  // --- If overlay does not exist, create a new one from here ---
  // Create Overlay
  const overlay = document.createElement("div");
  overlay.id = "konusucu-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border: 1px solid #e0e0e0;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
    z-index: 999999;
    max-height: 500px;
    width: 380px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    backdrop-filter: blur(10px);
    animation: fadeIn 0.2s ease-out;
  `;
  // Style element for CSS animations
  const style = document.createElement("style");
  style.textContent = `
    #konusucu-overlay {
        display: block; /* Visible initially */
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
    }
    .language-item:hover {
      background-color: #f0f0f0 !important;
      transform: translateX(4px) !important;
      transition: all 0.2s ease !important;
    }
    .language-item.selected {
      background-color: #e3f2fd !important;
      border-left: 4px solid #2196f3 !important;
      font-weight: 600 !important;
    }
  `;
  document.head.appendChild(style);
  // Close function
  function closeOverlay() {
    overlay.style.animation = "fadeOut 0.2s ease-out";
    setTimeout(() => {
      try {
        if (overlay && overlay.parentNode) overlay.remove();
      } catch(e) { }
      // Clean up any global references this script may have created
      try { if (window.renderKonusucuList) delete window.renderKonusucuList; } catch(e){}
    }, 180);
  }
  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕";
  closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    border: none;
    background: rgba(0,0,0,0.1);
    color: #666;
    font-size: 16px;
    cursor: pointer;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "rgba(255,0,0,0.1)";
    closeBtn.style.color = "#d32f2f";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "rgba(0,0,0,0.1)";
    closeBtn.style.color = "#666";
  });
  closeBtn.addEventListener("click", closeOverlay);
  overlay.appendChild(closeBtn);
  // Title
  const title = document.createElement("h2");
  title.textContent = "🎤 Select Speech Language";
  title.style.cssText = `
    font-size: 20px;
    margin: 0 0 16px 0;
    color: #333;
    font-weight: 600;
    text-align: center;
  `;
  overlay.appendChild(title);
  // Filter input
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "🔍 Search language...";
  input.style.cssText = `
    width: 100%;
    padding: 12px 16px;
    margin-bottom: 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
  `;
  input.addEventListener("focus", () => { input.style.borderColor = "#2196f3"; });
  input.addEventListener("blur", () => { input.style.borderColor = "#e0e0e0"; });
  overlay.appendChild(input);
  // Language list container
  const listContainer = document.createElement("div");
  listContainer.style.cssText = `
    max-height: 320px;
    overflow-y: auto;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;
  const list = document.createElement("ul");
  list.style.cssText = `list-style: none; padding: 0; margin: 0;`;
  listContainer.appendChild(list);
  overlay.appendChild(listContainer);
  // Languages
  const languages = [
    { code: 'tr-TR', name: 'Turkish (Turkey)', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'en-US', name: 'English (United States)', nativeName: 'English', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (United Kingdom)', nativeName: 'English (UK)', flag: '🇬🇧' },
    { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español (México)', flag: '🇲🇽' },
    { code: 'fr-FR', name: 'French (France)', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German (Germany)', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'it-IT', name: 'Italian (Italy)', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'ru-RU', name: 'Russian (Russia)', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'ja-JP', name: 'Japanese (Japan)', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'vi-VN', name: 'Vietnamese (Vietnam)', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'ko-KR', name: 'Korean (South Korea)', nativeName: '한국어', flag: '🇰🇷' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', flag: '🇧🇷' },
    { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)', flag: '🇵🇹' },
    { code: 'zh-CN', name: 'Chinese (China)', nativeName: '中文 (简体)', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Chinese (Taiwan)', nativeName: '中文 (繁體)', flag: '🇹🇼' },
    { code: 'th-TH', name: 'Thai (Thailand)', nativeName: 'ไทย', flag: '🇹🇭' },
    { code: 'nl-NL', name: 'Dutch (Netherlands)', nativeName: 'Nederlands', flag: '🇳🇱' },
    { code: 'sv-SE', name: 'Swedish (Sweden)', nativeName: 'Svenska', flag: '🇸🇪' },
    { code: 'da-DK', name: 'Danish (Denmark)', nativeName: 'Dansk', flag: '🇩🇰' },
    { code: 'no-NO', name: 'Norwegian (Norway)', nativeName: 'Norsk', flag: '🇳🇴' },
    { code: 'fi-FI', name: 'Finnish (Finland)', nativeName: 'Suomi', flag: '🇫🇮' },
    { code: 'pl-PL', name: 'Polish (Poland)', nativeName: 'Polski', flag: '🇵🇱' },
    { code: 'cs-CZ', name: 'Czech (Czech Republic)', nativeName: 'Čeština', flag: '🇨🇿' },
    { code: 'hu-HU', name: 'Hungarian (Hungary)', nativeName: 'Magyar', flag: '🇭🇺' },
    { code: 'ro-RO', name: 'Romanian (Romania)', nativeName: 'Română', flag: '🇷🇴' },
    { code: 'bg-BG', name: 'Bulgarian (Bulgaria)', nativeName: 'Български', flag: '🇧🇬' },
    { code: 'hr-HR', name: 'Croatian (Croatia)', nativeName: 'Hrvatski', flag: '🇭🇷' },
    { code: 'sk-SK', name: 'Slovak (Slovakia)', nativeName: 'Slovenčina', flag: '🇸🇰' },
    { code: 'sl-SI', name: 'Slovenian (Slovenia)', nativeName: 'Slovenščina', flag: '🇸🇮' },
    { code: 'et-EE', name: 'Estonian (Estonia)', nativeName: 'Eesti', flag: '🇪🇪' },
    { code: 'lv-LV', name: 'Latvian (Latvia)', nativeName: 'Latviešu', flag: '🇱🇻' },
    { code: 'lt-LT', name: 'Lithuanian (Lithuania)', nativeName: 'Lietuvių', flag: '🇱🇹' },
    { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'az-AZ', name: 'Azerbaijani (Azerbaijan)', nativeName: 'Azərbaycan', flag: '🇦🇿' },
    { code: 'sr-RS', name: 'Serbian (Serbia)', nativeName: 'Српски', flag: '🇷🇸' },
    { code: 'uk-UA', name: 'Ukrainian (Ukraine)', nativeName: 'Українська', flag: '🇺🇦' },
    { code: 'sq-AL', name: 'Albanian (Albania)', nativeName: 'Shqip', flag: '🇦🇱' },
    { code: 'bs-BA', name: 'Bosnian (Bosnia and Herzegovina)', nativeName: 'Bosanski', flag: '🇧🇦' },
    { code: 'mk-MK', name: 'Macedonian (North Macedonia)', nativeName: 'Македонски', flag: '🇲🇰' },
    { code: 'sr-ME', name: 'Montenegrin (Montenegro)', nativeName: 'Црногорски', flag: '🇲🇪' },
    { code: 'el-GR', name: 'Greek (Greece)', nativeName: 'Ελληνικά', flag: '🇬🇷' },
    { code: 'he-IL', name: 'Hebrew (Israel)', nativeName: 'עברית', flag: '🇮🇱' },
    { code: 'fa-IR', name: 'Persian (Iran)', nativeName: 'فارسی', flag: '🇮🇷' },
    { code: 'ur-PK', name: 'Urdu (Pakistan)', nativeName: 'اردو', flag: '🇵🇰' },
    { code: 'bn-BD', name: 'Bengali (Bangladesh)', nativeName: 'বাংলা', flag: '🇧🇩' },
    { code: 'km-KH', name: 'Khmer (Cambodia)', nativeName: 'ខ្មែរ', flag: '🇰🇭' },
    { code: 'mt-MT', name: 'Maltese (Malta)', nativeName: 'Malti', flag: '🇲🇹' },
    { code: 'ne-NP', name: 'Nepali (Nepal)', nativeName: 'नेपाली', flag: '🇳🇵' },
    { code: 'si-LK', name: 'Sinhala (Sri Lanka)', nativeName: 'සිංහල', flag: '🇱🇰' },
    { code: 'my-MM', name: 'Myanmar (Myanmar)', nativeName: 'မြန်မာ', flag: '🇲🇲' },
    { code: 'km-KH', name: 'Khmer (Cambodia)', nativeName: 'ខ្មែរ', flag: '🇰🇭' },
    { code: 'lo-LA', name: 'Lao (Laos)', nativeName: 'ລາວ', flag: '🇱🇦' },
    { code: 'ka-GE', name: 'Georgian (Georgia)', nativeName: 'ქართული', flag: '🇬🇪' },
    { code: 'hy-AM', name: 'Armenian (Armenia)', nativeName: 'Հայերեն', flag: '🇦🇲' },
    { code: 'kk-KZ', name: 'Kazakh (Kazakhstan)', nativeName: 'Қазақ', flag: '🇰🇿' },
    { code: 'ky-KG', name: 'Kyrgyz (Kyrgyzstan)', nativeName: 'Кыргыз', flag: '🇰🇬' },
    { code: 'uz-UZ', name: 'Uzbek (Uzbekistan)', nativeName: 'Oʻzbek', flag: '🇺🇿' },
    { code: 'tg-TJ', name: 'Tajik (Tajikistan)', nativeName: 'Тоҷикӣ', flag: '🇹🇯' },
    { code: 'mn-MN', name: 'Mongolian (Mongolia)', nativeName: 'Монгол', flag: '🇲🇳' },
    { code: 'bo-CN', name: 'Tibetan (China)', nativeName: 'བོད་ཡིག', flag: '🏔️' },
    { code: 'ug-CN', name: 'Uyghur (China)', nativeName: 'ئۇيغۇرچە', flag: '🇨🇳' },
    { code: 'ms-MY', name: 'Malay (Malaysia)', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'tl-PH', name: 'Filipino (Philippines)', nativeName: 'Filipino', flag: '🇵🇭' },
    { code: 'sw-TZ', name: 'Swahili (Tanzania)', nativeName: 'Kiswahili', flag: '🇹🇿' },
    { code: 'am-ET', name: 'Amharic (Ethiopia)', nativeName: 'አማርኛ', flag: '🇪🇹' },
    { code: 'zu-ZA', name: 'Zulu (South Africa)', nativeName: 'isiZulu', flag: '🇿🇦' },
    { code: 'af-ZA', name: 'Afrikaans (South Africa)', nativeName: 'Afrikaans', flag: '🇿🇦' },
    { code: 'is-IS', name: 'Icelandic (Iceland)', nativeName: 'Íslenska', flag: '🇮🇸' },
    { code: 'hi-IN', name: 'Hindi (India)', nativeName: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ta-IN', name: 'Tamil (India)', nativeName: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te-IN', name: 'Telugu (India)', nativeName: 'తెలుగు', flag: '🇮🇳' },
    { code: 'ml-IN', name: 'Malayalam (India)', nativeName: 'മലയാളം', flag: '🇮🇳' },
    { code: 'ks-IN', name: 'Kashmiri (India)', nativeName: 'کٲشُر', flag: '🇮🇳' },
    { code: 'kn-IN', name: 'Kannada (India)', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'gu-IN', name: 'Gujarati (India)', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'mr-IN', name: 'Marathi (India)', nativeName: 'मराठी', flag: '🇮🇳' },
    { code: 'pa-IN', name: 'Punjabi (India)', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'or-IN', name: 'Odia (India)', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
    { code: 'as-IN', name: 'Assamese (India)', nativeName: 'অসমীয়া', flag: '🇮🇳' },
    { code: 'id-ID', name: 'Indonesian (Indonesia)', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'jv-ID', name: 'Javanese (Indonesia)', nativeName: 'Basa Jawa', flag: '🇮🇩' },
    { code: 'su-ID', name: 'Sundanese (Indonesia)', nativeName: 'Basa Sunda', flag: '🇮🇩' },
    { code: 'ga-IE', name: 'Irish (Ireland)', nativeName: 'Gaeilge', flag: '🇮🇪' },
    { code: 'cy-GB', name: 'Welsh (United Kingdom)', nativeName: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
    { code: 'eu-ES', name: 'Basque (Spain)', nativeName: 'Euskera', flag: '🇪🇸' },
    { code: 'ca-ES', name: 'Catalan (Spain)', nativeName: 'Català', flag: '🇪🇸' },
    { code: 'gl-ES', name: 'Galician (Spain)', nativeName: 'Galego', flag: '🇪🇸' }
];
  // We add the renderList function to the global scope so we can call it again.
  window.renderKonusucuList = function(filter = "") {
    chrome.storage.sync.get(["recognitionLang", "previousRecognitionLang"], ({ recognitionLang, previousRecognitionLang }) => {
      list.innerHTML = "";
      const filteredLanguages = languages.filter(lang => 
        `${lang.nativeName} ${lang.name}`.toLowerCase().includes(filter.toLowerCase())
      );
      if (filteredLanguages.length === 0) {
        const noResult = document.createElement("li");
        noResult.textContent = "No language found";
        noResult.style.cssText = `padding: 16px; text-align: center; color: #666; font-style: italic;`;
        list.appendChild(noResult);
        return;
      }
      filteredLanguages.forEach((lang, index) => {
        const li = document.createElement("li");
        li.className = "language-item";
        if (lang.code === recognitionLang) {
          li.classList.add("selected");
        }
        li.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">${lang.flag}</span>
            <div style="flex: 1;">
              <div style="font-weight: 500; color: #333;">${lang.nativeName}</div>
              <div style="font-size: 12px; color: #666;">${lang.name}</div>
            </div>
            ${lang.code === recognitionLang ? '<span style="color: #2196f3; font-size: 16px;">✓</span>' : ''}
          </div>
        `;
        li.style.cssText = `
          padding: 12px 16px;
          border-bottom: ${index < filteredLanguages.length - 1 ? '1px solid #f0f0f0' : 'none'};
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        `;
        li.addEventListener("click", () => {
          chrome.storage.sync.get("recognitionLang", (result) => {
            const currentLang = result.recognitionLang;
            if (currentLang !== lang.code) {
              chrome.storage.sync.set({ recognitionLang: lang.code, previousRecognitionLang: currentLang }, () => {
                chrome.runtime.sendMessage({ action: "language_changed" });
                closeOverlay();
              });
            } else {
              // If the same language is selected, just close the overlay without sending a message
              closeOverlay();
            }
          });
        });
        list.appendChild(li);
      });
    });
  }
  // Search and keyboard events
  input.addEventListener("input", () => window.renderKonusucuList(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });
  // Initial render and append to page
  window.renderKonusucuList();
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 100);
})(); // Call the function immediately
/* --- Assistant patch: ensure closeOverlay uses centralized cleanup --- */
(function(){
  const originalClose = window.closeOverlay || function(){};
  window.closeOverlay = function(){
    try { window.closeDictationPad(); } catch(e){ }
    try { originalClose(); } catch(e){};
  };
})();