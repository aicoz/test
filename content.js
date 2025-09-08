let recognition = null;
let outputDiv = null;
let finalTranscript = "";
let isDisabled = false;
let shouldRestart = true;
/* --- Assistant-inserted safety helpers (do not change logic) --- */
function safeSendMessage(message) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, function(response){
        try {
          if (chrome.runtime && chrome.runtime.lastError) {
          }
        } catch(e){ /* ignore */ }
      });
    }
  } catch (e) {
  }
}
function safeGetSelectionContainerText(range, cursorPos) {
  try {
    if (!range) return '';
    var container = range.startContainer;
    if (!container) return '';
    // If container has textContent use it, otherwise fallback to value (for inputs)
    var text = (container.textContent !== undefined && container.textContent !== null) ? container.textContent : (container.value !== undefined ? container.value : '');
    if (typeof text !== 'string') text = String(text || '');
    cursorPos = (typeof cursorPos === 'number') ? cursorPos : 0;
    return text.substring(0, Math.max(0, cursorPos));
  } catch(e) {
    return '';
  }
}
function safeGetSelectionStartValue(el) {
  try {
    if (!el) return 0;
    if (typeof el.selectionStart === 'number') return el.selectionStart;
    return 0;
  } catch(e) {
    return 0;
  }
}
/* --- end helpers --- */
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "start") {
    isDisabled = false;
    startRecognition();
  }
  if (message.action === "stop") {
    stopRecognition();
    if (message.message) {
      if (!outputDiv) {
        createOutputDiv();
      }
      outputDiv.innerText = message.message;
      outputDiv.style.display = "block";
      isDisabled = true;
      safeSendMessage({ action: "disable_tab" });
      if (message.setIconGray) {
        chrome.action.setIcon({
          path: {
            "16": "icons/icon-gray-16.png",
            "32": "icons/icon-gray-32.png"
          }
        });
      }
      setTimeout(() => {
        if (outputDiv) {
          outputDiv.style.display = "none";
          outputDiv.remove();
          outputDiv = null;
        }
      }, 5000);
    }
  }
  if (message.action === "status_check") {
    safeSendMessage({ 
      action: "status_response", 
      isRecognitionActive: !!recognition && !isDisabled, 
      tabId: message.tabId 
    });
  }
  if (message.action === "language_changed") {
    // Stop current recognition and start with the new language when language is changed
    const wasActive = !!recognition && !isDisabled;
    stopRecognition();
    // Show language change notification
    chrome.storage.sync.get("recognitionLang", (result) => {
      const newLang = result.recognitionLang;
      showLanguageChangeNotification(newLang);
    });
    // If recognition was active, restart with new language
    if (wasActive) {
      setTimeout(() => {
        startRecognition();
      }, 500); // Small delay to ensure clean restart
    }
  }
});
function showLanguageChangeNotification(langCode) {
  // Language code to display name mapping
  const languageNames = {
    'tr-TR': 'Turkish',
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'es-ES': 'Spanish',
    'es-MX': 'Spanish (Mexico)',
    'fr-FR': 'French',
    'de-DE': 'German',
    'it-IT': 'Italian',
    'pt-BR': 'Portuguese (Brazil)',
    'pt-PT': 'Portuguese (Portugal)',
    'ru-RU': 'Russian',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ar-SA': 'Arabic',
    'hi-IN': 'Hindi',
    'th-TH': 'Thai',
    'vi-VN': 'Vietnamese',
    'nl-NL': 'Dutch',
    'sv-SE': 'Swedish',
    'da-DK': 'Danish',
    'no-NO': 'Norwegian',
    'fi-FI': 'Finnish',
    'pl-PL': 'Polish',
    'cs-CZ': 'Czech',
    'hu-HU': 'Hungarian',
    'ro-RO': 'Romanian',
    'bg-BG': 'Bulgarian',
    'hr-HR': 'Croatian',
    'sk-SK': 'Slovak',
    'sl-SI': 'Slovenian',
    'et-EE': 'Estonian',
    'lv-LV': 'Latvian',
    'lt-LT': 'Lithuanian',
    'el-GR': 'Greek',
    'he-IL': 'Hebrew',
    'fa-IR': 'Persian',
    'ur-PK': 'Urdu',
    'bn-BD': 'Bengali',
    'ta-IN': 'Tamil',
    'te-IN': 'Telugu',
    'ml-IN': 'Malayalam',
    'kn-IN': 'Kannada',
    'gu-IN': 'Gujarati',
    'mr-IN': 'Marathi',
    'pa-IN': 'Punjabi',
    'or-IN': 'Odia',
    'as-IN': 'Assamese',
    'ne-NP': 'Nepali',
    'si-LK': 'Sinhala',
    'my-MM': 'Myanmar',
    'km-KH': 'Khmer',
    'lo-LA': 'Lao',
    'ka-GE': 'Georgian',
    'hy-AM': 'Armenian',
    'az-AZ': 'Azerbaijani',
    'kk-KZ': 'Kazakh',
    'ky-KG': 'Kyrgyz',
    'uz-UZ': 'Uzbek',
    'tg-TJ': 'Tajik',
    'mn-MN': 'Mongolian',
    'bo-CN': 'Tibetan',
    'ug-CN': 'Uyghur',
    'id-ID': 'Indonesian',
    'ms-MY': 'Malay',
    'tl-PH': 'Filipino',
    'sw-TZ': 'Swahili',
    'am-ET': 'Amharic',
    'zu-ZA': 'Zulu',
    'af-ZA': 'Afrikaans',
    'is-IS': 'Icelandic',
    'mt-MT': 'Maltese',
    'ga-IE': 'Irish',
    'cy-GB': 'Welsh',
    'eu-ES': 'Basque',
    'ca-ES': 'Catalan',
    'gl-ES': 'Galician',
    'sr-RS': 'Serbian',
    'uk-UA': 'Ukrainian',
    'sq-AL': 'Albanian',
    'bs-BA': 'Bosnian',
    'mk-MK': 'Macedonian',
    'sr-ME': 'Montenegrin'
  };
  const languageName = languageNames[langCode] || langCode;
  if (!outputDiv) {
    createOutputDiv();
  }
  outputDiv.innerText = `LANGUAGE CHANGED TO: ${languageName.toUpperCase()}`;
  outputDiv.style.background = "rgba(76, 175, 80, 0.9)"; // Green background for language change
  outputDiv.style.color = "white";
  outputDiv.style.display = "block";
  setTimeout(() => {
    if (outputDiv) {
      outputDiv.style.background = "rgba(220, 220, 220, 0.85)"; // Reset to default background
      outputDiv.style.color = "#333"; // Reset to default color
      outputDiv.style.display = "none";
    }
  }, 2000); // Show for 2 seconds
}
function startRecognition() {
  shouldRestart = true;
  if (isDisabled) {
    if (outputDiv) {
      outputDiv.innerText = "Microphone is being used by another application or tab.";
      outputDiv.style.display = "block";
      setTimeout(() => {
        if (outputDiv) {
          outputDiv.style.display = "none";
          outputDiv.remove();
          outputDiv = null;
        }
      }, 5000);
    } else {
      createOutputDiv();
      outputDiv.innerText = "Microphone is being used by another application or tab.";
      outputDiv.style.display = "block";
      setTimeout(() => {
        if (outputDiv) {
          outputDiv.style.display = "none";
          outputDiv.remove();
          outputDiv = null;
        }
      }, 5000);
    }
    return;
  }
  if (recognition) {
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (outputDiv) {
      outputDiv.innerText = "Your browser does not support speech recognition.";
      outputDiv.style.display = "block";
      setTimeout(() => {
        if (outputDiv) {
          outputDiv.style.display = "none";
          outputDiv.remove();
          outputDiv = null;
        }
      }, 5000);
    } else {
      createOutputDiv();
      outputDiv.innerText = "Your browser does not support speech recognition.";
      outputDiv.style.display = "block";
      setTimeout(() => {
        if (outputDiv) {
          outputDiv.style.display = "none";
          outputDiv.remove();
          outputDiv = null;
        }
      }, 5000);
    }
    isDisabled = true;
    safeSendMessage({ action: "disable_tab" });
    return;
  }
  // Microphone permission and conflict control
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      // Release stream immediately
      stream.getTracks().forEach(track => track.stop());
      // Get language from storage and create recognition object
      chrome.storage.sync.get(["recognitionLang"], (result) => {
        const selectedLang = result.recognitionLang || navigator.language || "en-US";
        recognition = new SpeechRecognition();
        recognition.lang = selectedLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        if (!outputDiv) {
          createOutputDiv();
        }
        recognition.onstart = function () {
          if (outputDiv) {
            outputDiv.innerText = "MICROPHONE ACTIVATED";
            outputDiv.style.display = "block";
            setTimeout(() => {
              if (outputDiv && outputDiv.innerText === "MICROPHONE ACTIVATED") {
                outputDiv.style.display = "none";
                outputDiv.remove();
                outputDiv = null;
              }
            }, 3000); // miliseconds
          }
          safeSendMessage({ action: "recognition_started" });
        };
        recognition.onresult = function (event) {
          if (!outputDiv) {
            createOutputDiv(); // Ensure outputDiv exists
          }
          let interim = "";
          finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript + " ";
            } else {
              interim += result[0].transcript;
            }
          }
          if (interim) {
            outputDiv.innerText = interim;
            outputDiv.style.display = "block";
          } else if (finalTranscript) {
            const text = finalTranscript.trim();
            outputDiv.innerText = text;
            outputDiv.style.display = "block";
            pasteToActiveElement(text);
            outputDiv.innerText = "";
            outputDiv.style.display = "none";
            finalTranscript = "";
          } else {
            outputDiv.style.display = "none";
          }
        };
        recognition.onend = function () {
          // If the extension was not manually stopped (i.e., isDisabled is false)
          // and the recognition object still exists, restart.
          if (recognition && !isDisabled && shouldRestart) {
            try {
              recognition.start(); // Restart recognition
            } catch (e) {
              // If restart fails, stop just in case.
              stopRecognition();
              safeSendMessage({ action: "recognition_ended" });
            }
          } else {
            // If the extension was manually stopped, close normally.
            stopRecognition();
            safeSendMessage({ action: "recognition_ended" });
          }
        };
        recognition.onerror = function (event) {
          if (event.error === "no-speech") {
            return;
          }
          if (!outputDiv) {
            createOutputDiv();
          }
          if (event.error === "aborted" || event.error === "not-allowed") {
            outputDiv.innerText = `Microphone ${event.error === "aborted" ? "is being used by another application or tab" : "access denied. Check your browser settings."}`;
            outputDiv.style.display = "block";
            isDisabled = true;
            stopRecognition();
            safeSendMessage({ action: "disable_tab" });
            setTimeout(() => {
              if (outputDiv) {
                outputDiv.style.display = "none";
                outputDiv.remove();
                outputDiv = null;
              }
            }, 5000);
          } else {
            // Diğer hatalar için shouldRestart kontrolü ile yeniden başlatma denemesi
            if (shouldRestart) {
              try {
                recognition.start();
              } catch (e) {
                stopRecognition();
                safeSendMessage({ action: "recognition_ended" });
              }
            } else {
              outputDiv.innerText = `${event.error}`;
              outputDiv.style.display = "block";
              setTimeout(() => {
                if (outputDiv) {
                  outputDiv.style.display = "none";
                  outputDiv.remove();
                  outputDiv = null;
                }
              }, 5000);
            }
          }
        };
        try {
          recognition.start();
        } catch (error) {
          if (!outputDiv) {
            createOutputDiv();
          }
          outputDiv.innerText = "Speech recognition could not be started: " + error.message;
          outputDiv.style.display = "block";
          setTimeout(() => {
            if (outputDiv) {
              outputDiv.style.display = "none";
              outputDiv.remove();
              outputDiv = null;
            }
          }, 5000);
          isDisabled = true;
          safeSendMessage({ action: "disable_tab" });
        }
      }); // chrome.storage.sync.get end
    })
    .catch((error) => {
      if (!outputDiv) {
        createOutputDiv();
      }
      outputDiv.innerText = "Microphone access denied or is being used by another application: " + error.message;
      outputDiv.style.display = "block";
      setTimeout(() => {
        if (outputDiv) {
          outputDiv.style.display = "none";
          outputDiv.remove();
          outputDiv = null;
        }
      }, 5000);
      isDisabled = true;
      safeSendMessage({ action: "disable_tab" });
    });
}
function createOutputDiv() {
  outputDiv = document.createElement("div");
  outputDiv.style.position = "fixed";
  outputDiv.style.top = "10px";
  outputDiv.style.left = "50%";
  outputDiv.style.transform = "translateX(-50%)";
  outputDiv.style.padding = "12px 16px";
  outputDiv.style.background = "rgba(220, 220, 220, 0.85)";
  outputDiv.style.color = "#333";
  outputDiv.style.borderRadius = "12px";
  outputDiv.style.fontSize = "18px";
  outputDiv.style.zIndex = "999999";
  outputDiv.style.maxWidth = "80vw";
  outputDiv.style.whiteSpace = "pre-wrap";
  outputDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  outputDiv.style.fontFamily = "sans-serif";
  outputDiv.style.display = "none";
  document.body.appendChild(outputDiv);
}
function stopRecognition() {
  shouldRestart = false;
  if (recognition) {
    try {
      recognition.stop();
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition = null;
    } catch (error) {
    }
  }
  if (outputDiv && !isDisabled) {
    outputDiv.remove();
    outputDiv = null;
  }
}
function pasteToActiveElement(text) {
  const el = document.activeElement;
  if (!el) {
    if (outputDiv) {
      outputDiv.innerText = "Text box not found.";
      outputDiv.style.display = "block";
      setTimeout(() => { if (outputDiv) { outputDiv.style.display = "none"; outputDiv.remove(); outputDiv = null; } }, 5000);
    } else {
      createOutputDiv();
      outputDiv.innerText = "Text box not found.";
      outputDiv.style.display = "block";
      setTimeout(() => { if (outputDiv) { outputDiv.style.display = "none"; outputDiv.remove(); outputDiv = null; } }, 5000);
    }
    return;
  }
  const isTextInput =
    el.tagName === "TEXTAREA" ||
    (el.tagName === "INPUT" && (el.type === "text" || el.type === "search" || el.type === "email" || el.type === "url")) ||
    el.isContentEditable ||
    el.getAttribute("role") === "textbox";
  const punctuationMarks = [".", ",", ";", ":", "?", "!"];
  let finalText = text + " ";
  let matchedPunctuation = null;
  const capitalizeFirstLetter = (str) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  // --- NEW CURSOR CONTROL LOGIC START ---
  let textBeforeCursor = "";
  let cursorPos = 0;
  const isContentEditable = el.isContentEditable;
  if (isContentEditable) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPos = range.startOffset;
      const container = range.startContainer;
      textBeforeCursor = safeGetSelectionContainerText(range, cursorPos);
    }

  } else { // For INPUT and TEXTAREA
    if (el && typeof el.value !== 'undefined') {
        cursorPos = safeGetSelectionStartValue(el);
        textBeforeCursor = el.value.substring(0, cursorPos);
    } else {
        console.error('Element or value is undefined:', el);
        textBeforeCursor = '';
    }
}
  matchedPunctuation = punctuationMarks.find(mark => textBeforeCursor.slice(-2) === ` ${mark}`);
  if (matchedPunctuation) {
    const correctedText = matchedPunctuation + " " + (matchedPunctuation !== "," ? capitalizeFirstLetter(text) : text) + " ";
    if (isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.setStart(range.startContainer, cursorPos - 2);
            range.setEnd(range.startContainer, cursorPos);
            range.deleteContents();
            range.insertNode(document.createTextNode(correctedText.replace(/ $/, '\u00A0')));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    } else { // For INPUT and TEXTAREA
        // ESKİ HALİ
        // const value = el.value;
        // el.value = value.substring(0, cursorPos - 2) + correctedText + value.substring(cursorPos);
        // const newCursorPos = cursorPos - 2 + correctedText.length;
        // el.selectionStart = el.selectionEnd = newCursorPos;
        // YENİ HALİ
        const value = el.value;
        // Önce hatalı kısmı sil, sonra düzeltilmiş metni ekle.
        el.value = value.substring(0, cursorPos - 2) + correctedText + value.substring(cursorPos);
        // İmleci, eklenen metnin sonuna, sondaki boşluktan ÖNCEYE konumlandır. Bu, bir sonraki kelimenin doğru yere gelmesini sağlar.
        const newCursorPos = el.value.length - value.substring(cursorPos).length;
        el.selectionStart = el.selectionEnd = newCursorPos;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return; // Correction made, function finished.
  }
  if (textBeforeCursor.trim() === "") {
    finalText = capitalizeFirstLetter(text) + " ";
  }
  // --- NEW CURSOR CONTROL LOGIC END ---
  // --- HYBRID PASTE LOGIC ---
  if (isTextInput && finalText) {
    let advancedMethodSuccess = false;
    try {
      // 1. STAGE: TRY ADVANCED METHOD FIRST
      if (el.isContentEditable) {
        el.focus();
        // This command may cause errors on sites like Google.
        if (!document.execCommand("insertText", false, finalText)) {
          throw new Error("execCommand returned false.");
        }
      } else { // For INPUT and TEXTAREA
        // This is also a modern method.
        if (el.setRangeText) {
          el.setRangeText(finalText, el.selectionStart, el.selectionEnd, "end");
        } else {
          // Fallback for older browsers.
          const start = safeGetSelectionStartValue(el);
          const end = (typeof el.selectionEnd === "number" ? el.selectionEnd : safeGetSelectionStartValue(el));
          el.value = el.value.substring(0, start) + finalText + el.value.substring(end);
          el.selectionStart = el.selectionEnd = start + finalText.length;
        }
      }
      advancedMethodSuccess = true;
    } catch (error) {
      // 2. STAGE: IF ADVANCED METHOD FAILS, TRY PRIMITIVE METHOD
      try {
        const start = safeGetSelectionStartValue(el);
        // Primitive method for ContentEditable: directly change textContent
        if (el.isContentEditable) {
          const currentContent = el.textContent || '';
          el.textContent = currentContent.substring(0, cursorPos) + finalText + currentContent.substring(cursorPos);
          // Move cursor to the correct position
          const newCursorPos = cursorPos + finalText.length;
          const range = document.createRange();
          const selection = window.getSelection();
          // May need to find the text node
          if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
            range.setStart(el.firstChild, Math.min(newCursorPos, el.firstChild.textContent.length));
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else { // For INPUT and TEXTAREA
          const value = el.value;
          el.value = value.substring(0, start) + finalText + value.substring(start);
          el.selectionStart = el.selectionEnd = start + finalText.length;
        }
      } catch (primitiveError) {
        // 3. STAGE: LAST RESORT - CLIPBOARD METHOD
        try {
          navigator.clipboard.writeText(finalText).then(() => {
            el.focus();
            document.execCommand("paste");
          }).catch((clipboardError) => {
          });
        } catch (clipboardError) {
        }
      }
    }
    // Trigger input event for all methods
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
/* --- Assistant patch: ensure message handling triggers lifecycle --- */
(function(){
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
        try {
          if (!message) return;
          if (message.action === 'toggle-dictation-pad' || message.action === 'toggle') {
            window.toggleDictationPad && window.toggleDictationPad();
          } else if (message.action === 'open-dictation-pad' || message.action === 'open') {
            window.openDictationPad && window.openDictationPad();
          } else if (message.action === 'close-dictation-pad' || message.action === 'close') {
            window.closeDictationPad && window.closeDictationPad();
          }
        } catch(e){ }
      });
    }
  } catch(e){ }
})();