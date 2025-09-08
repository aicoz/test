// Dictation Pad Overlay - Enhanced JavaScript Implementation
class DictationPadOverlay {
    // --- Compatibility helpers injected by assistant ---
    safeExecCommand(cmd, value = null) {
        try { document.execCommand && document.execCommand(cmd, false, value); }
        catch(e) { }
    }
    writeToClipboard(html, text) {
        if (navigator.clipboard && navigator.clipboard.write) {
            const items = {};
            if (html) items['text/html'] = new Blob([html], {type:'text/html'});
            if (text) items['text/plain'] = new Blob([text], {type:'text/plain'});
            try {
                const clipboardItem = new ClipboardItem(items);
                return navigator.clipboard.write([clipboardItem]).catch(()=> navigator.clipboard.writeText(text||''));
            } catch(e) {
                return navigator.clipboard.writeText(text||'');
            }
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text||'');
        } else {
            return Promise.reject(new Error('clipboard not available'));
        }
    }
    static COLOR_PALETTE = [
        "#000000", "#008080", "#FF0000", "#00FF00",
        "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
        "#FFA500", "#800080", "#A52A2A", "#808080",
        "#ADD8E6", "#32CD32", "#FFC0CB", 
    ];
    constructor() {
        this.overlay = null;
        this.textEditor = null;
        this.isMinimized = false;
        this.isVisible = false;
        this.autoSaveTimeout = null;
        this.currentFontFamily = 'Arial';
        this.currentFontSize = '14';
        this.currentTextColor = '#000000';
        this.autoSaveEnabled = true;
        this.savedCursorPosition = null;
        this.init();
    }
    init() {
        this.injectStyles();
    }
    injectStyles() {
        if (document.getElementById('dictationPadStyles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'dictationPadStyles';
        style.textContent = `
            .dictation-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.8);
                z-index: 999999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .dictation-overlay.show {
                opacity: 1;
            }
            .dictation-container {
                width: 90%;
                max-width: none;
                height: 85%;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: scale(0.9) translateY(-20px);
                transition: transform 0.3s ease;
                resize: both;
                min-width: 600px;
                min-height: 400px;
                position: relative;
            }
            .dictation-container::after {
                content: '';
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                background: linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 40%, transparent 40%, transparent 60%, #ccc 60%, #ccc 70%, transparent 70%);
                cursor: nw-resize;
                z-index: 10;
            }
            .dictation-overlay.show .dictation-container {
                transform: scale(1) translateY(0);
            }
            .dictation-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 12px 12px 0 0;
                cursor: move;
            }
            .dictation-title h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            .dictation-controls {
                display: flex;
                gap: 8px;
            }
            .control-btn {
                width: 30px;
                height: 30px;
                border: none;
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .control-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.05);
            }
            .close-btn:hover {
                background: #ff4757;
            }
            .dictation-toolbar {
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
                padding: 8px 20px 5px 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                min-height: 45px;
            }
            .toolbar-group {
                display: flex;
                gap: 3px;
                align-items: center;
            }
            .toolbar-btn {
                padding: 6px 10px;
                border: 1px solid #dee2e6;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s ease;
                min-width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .toolbar-btn:hover {
                background: #e9ecef;
                border-color: #adb5bd;
            }
            .toolbar-btn.active {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }
            .toolbar-select {
                padding: 6px 10px;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                background: white;
                font-size: 13px;
                cursor: pointer;
                height: 32px;
                min-width: 80px;
            }
            .color-palette {
                display: flex;
                flex-wrap: wrap;
                gap: 2px;
                margin: 5px 0;
                max-width: 200px;
            }
            .color-swatch {
                width: 20px;
                height: 20px;
                border: 1px solid #ccc;
                border-radius: 3px;
                cursor: pointer;
                transition: transform 0.1s ease;
            }
            .color-swatch:hover {
                transform: scale(1.1);
                border-color: #007bff;
            }
            .toolbar-input {
                padding: 4px;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                height: 32px;
                width: 40px;
                cursor: pointer;
            }
            .toolbar-separator {
                width: 1px;
                height: 20px;
                background: #dee2e6;
                margin: 0 5px;
            }
            .dictation-content {
                flex: 1;
                padding: 15px 20px 20px 20px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .text-editor {
                flex: 1;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                font-size: 14px;
                line-height: 1.6;
                outline: none;
                overflow-y: auto;
                background: white;
                transition: border-color 0.2s ease;
                min-height: 300px;
            }
            .text-editor:focus {
                border-color: #007bff;
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
            }
            .text-editor:empty:before {
                content: attr(data-placeholder);
                color: #6c757d;
                font-style: italic;
            }
            .dictation-footer {
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 0 0 12px 12px;
            }
            .status-info {
                display: flex;
                gap: 20px;
                font-size: 12px;
                color: #6c757d;
                align-items: center;
            }
            .footer-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            .footer-btn {
                padding: 8px 16px;
                border: 1px solid #007bff;
                background: white;
                color: #007bff;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            .footer-btn:hover {
                background: #007bff;
                color: white;
            }
            .extension-controls {
                display: flex;
                gap: 8px;
                justify-content: center;
                flex: 1;
            }
            .ext-btn {
                padding: 8px 12px;
                border: 2px solid #28a745;
                background: #28a745;
                color: #000;
                border-radius: 6px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 700;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
                text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
            }
            .ext-btn:hover {
                background: #218838;
                border-color: #218838;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
                color: #fff;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            }
            .auto-save-checkbox {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 11px;
                color: #6c757d;
            }
            .auto-save-checkbox input {
                margin: 0;
            }
            .dictation-overlay.hidden {
                display: none;
            }
            .text-editor b, .text-editor strong {
                font-weight: bold;
            }
            .text-editor i, .text-editor em {
                font-style: italic;
            }
            .text-editor u {
                text-decoration: underline;
            }
            .text-editor s, .text-editor strike {
                text-decoration: line-through;
            }
            .dictation-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 1000000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transform: translateX(100%);
                transition: transform 0.3s ease;
            }
            .dictation-notification.show {
                transform: translateX(0);
            }
            .dropdown-container {
                position: relative;
                display: flex;
                align-items: center;
            }
            .dropdown-btn {
                padding: 6px 10px;
                border: 1px solid #dee2e6;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 60px;
            }
            .dropdown-btn:hover {
                background: #e9ecef;
                border-color: #adb5bd;
            }
            .dropdown-main {
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px 8px;
                border-right: none;
                border-top-right-radius: 0;
                border-bottom-right-radius: 0;
            }
            .dropdown-arrow {
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px 6px;
                border-left: none;
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
                min-width: 20px;
            }
            .dropdown-main:hover, .dropdown-arrow:hover {
                background: #e9ecef;
                border-color: #adb5bd;
            }
            .dropdown-content {
                display: none;
                position: absolute;
                background-color: white;
                min-width: 120px;
                box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                z-index: 1000001;
                border-radius: 4px;
                border: 1px solid #dee2e6;
                top: 100%;
                left: 0;
            }
            .dropdown-content.show {
                display: block;
            }
            .dropdown-item {
                color: black;
                padding: 8px 12px;
                text-decoration: none;
                display: block;
                cursor: pointer;
                font-size: 13px;
            }
            .dropdown-item:hover {
                background-color: #f1f1f1;
            }
            .color-picker-section {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
            }
            .color-picker-input {
                width: 40px;
                height: 24px;
                border: 1px solid #ccc;
                border-radius: 3px;
                cursor: pointer;
                padding: 0;
            }
            .color-ok-btn {
                padding: 4px 12px;
                border: 1px solid #007bff;
                background: #007bff;
                color: white;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            .color-ok-btn:hover {
                background: #0056b3;
                border-color: #0056b3;
            }
            .toolbar-btn.align-left-btn {
                font-size: 25px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.align-center-btn {
                font-size: 25px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.align-right-btn {
                font-size: 25px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.comma-btn {
                font-size: 20px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.period-btn {
                font-size: 20px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.quma-btn {
                font-size: 20px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.enter-btn {
                font-size: 28px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.undo-btn {
                font-size: 30px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
            .toolbar-btn.redo-btn {
                font-size: 30px; /* Daha büyük görünmesi için */
                font-weight: bold; /* İstersen kalın */
                line-height: 32px;    /* Dikey hizalamayı düzeltir */
            }
        `;
        document.head.appendChild(style);
    }
    createOverlay() {
        if (this.overlay) {
            return;
        }
        this.overlay = document.createElement('div');
        this.overlay.id = 'dictation-pad-overlay';
        this.overlay.className = 'dictation-overlay';
        this.overlay.innerHTML = `
            <div class="dictation-container">
                <div class="dictation-header">
                    <div class="dictation-title">
                        <h2>📝 MuVu-TalkScript Dictation Pad</h2>
                    </div>
                    <div class="dictation-controls">
                        <button class="control-btn close-btn" title="Close">×</button>
                    </div>
                </div>
                <div class="dictation-toolbar">
                    <div class="toolbar-group">
                        <div class="dropdown-container">
                            <button class="dropdown-main copy-main-btn" title="Copy All Plain Text">📋 Copy All</button>
                            <button class="dropdown-arrow copy-arrow-btn" title="Copy Options">▼</button>
                            <div class="dropdown-content copy-dropdown">
                                <div class="dropdown-item copy-formatted">Formatted</div>
                                <div class="dropdown-item copy-plain">Plain Text</div>
                            </div>
                        </div>
                        <div class="dropdown-container">
                            <button class="dropdown-main cut-main-btn" title="Cut All Plain Text">✂️ Cut All</button>
                            <button class="dropdown-arrow cut-arrow-btn" title="Cut Options">▼</button>
                            <div class="dropdown-content cut-dropdown">
                                <div class="dropdown-item cut-formatted">Formatted</div>
                                <div class="dropdown-item cut-plain">Plain Text</div>
                            </div>
                        </div>
                        <button class="toolbar-btn paste-btn" title="Paste">📄 Paste</button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <select class="toolbar-select font-family-select">
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Times New Roman">Times</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Courier New">Courier</option>
                        </select>
                        <select class="toolbar-select font-size-select">
                            <option value="10">10px</option>
                            <option value="12">12px</option>
                            <option value="14" selected>14px</option>
                            <option value="16">16px</option>
                            <option value="18">18px</option>
                            <option value="20">20px</option>
                            <option value="24">24px</option>
                            <option value="28">28px</option>
                            <option value="32">32px</option>
                        </select>
                        <div class="dropdown-container">
                            <button class="dropdown-main color-palette-btn" title="Color Palette">🎨 Colors</button>
                            <button class="dropdown-arrow color-palette-arrow" title="Color Options">▼</button>
                            <div class="dropdown-content color-palette-dropdown">
                                <div class="color-palette" id="dynamic-color-palette">
                                </div>
                                <div class="color-picker-section">
                                    <input type="color" class="color-picker-input" title="Custom Color" value="#000000">
                                    <button class="color-ok-btn">OK</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn bold-btn" title="Bold"><b>B</b></button>
                        <button class="toolbar-btn italic-btn" title="Italic"><i>I</i></button>
                        <button class="toolbar-btn underline-btn" title="Underline"><u>U</u></button>
                        <button class="toolbar-btn strikethrough-btn" title="Strikethrough"><s>S</s></button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn align-left-btn" title="Align Left">⬅</button>
                        <button class="toolbar-btn align-center-btn" title="Align Center">⬌</button>
                        <button class="toolbar-btn align-right-btn" title="Align Right">➡</button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <!-- // iPTAL // button class="toolbar-btn comma-btn" title="Comma",button-->
                        <!-- // iPTAL // button class="toolbar-btn period-btn" title="Period".button-->
                        <!-- // iPTAL // button class="toolbar-btn quma-btn" title="Question Mark"?button-->
                        <button class="toolbar-btn enter-btn" title="New Line">⏎</button>
                        <!-- // KARAKTER SiLME iPTAL // button class="toolbar-btn backspace-btn" title="Backspace (Character)"⌫button-->
                        <!-- // KELiME SiLME iPTAL // button class="toolbar-btn word-backspace-btn" title="Backspace (Word)"⌫⌫button-->
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn undo-btn" title="Undo">↶</button>
                        <button class="toolbar-btn redo-btn" title="Redo">↷</button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn clear-btn" title="Clear All">🗑️</button>
                    </div>
                </div>
                <div class="dictation-content">
                    <div class="text-editor" contenteditable="true" data-placeholder="Start speaking or type here..."></div>
                </div>
                <div class="dictation-footer">
                    <div class="status-info">
                        <span class="word-count">Words: 0</span>
                        <span class="char-count">Characters: 0</span>
                        <div class="auto-save-checkbox">
                            <input type="checkbox" id="autoSaveCheck" checked>
                            <label for="autoSaveCheck">Auto-save</label>
                        </div>
                    </div>
                    <div class="extension-controls">
                        <button class="ext-btn revert-lang-btn" title="Revert Language">🔵 Revert Language</button>
                        <button class="ext-btn select-lang-btn" title="Select Language">🎤 Language</button>
                        <button class="ext-btn shortcuts-btn" title="Shortcuts">⌨️ Shortcuts</button>
                        <button class="ext-btn reset-mic-btn" title="Reset Microphone">⭕ Reset Mic</button>
                    </div>
                    <div class="footer-controls">
                        <button class="footer-btn save-btn">💾 Save</button>
                        <button class="footer-btn export-txt-btn">📤 Export TXT</button>
                        <button class="footer-btn export-html-btn">📄 Export HTML</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.textEditor = this.overlay.querySelector('.text-editor');
        this.createDynamicColorPalette();
        this.bindEvents();
        this.loadSavedContent();
        this.updateCounts();
    }
    createDynamicColorPalette() {
        const colorPaletteContainer = this.overlay && this.overlay.querySelector ? this.overlay.querySelector('#dynamic-color-palette') : null;
        if (!colorPaletteContainer) return;
        colorPaletteContainer.innerHTML = '';
        DictationPadOverlay.COLOR_PALETTE.forEach(color => {
            const colorSwatch = document.createElement('div');
            colorSwatch.className = 'color-swatch';
            colorSwatch.style.backgroundColor = color;
            colorSwatch.setAttribute('data-color', color);
            colorPaletteContainer.appendChild(colorSwatch);
        });
    }
    toggle() {
        try {
            if (this.overlay) {
                if (this.isVisible) {
                    // Close via instance close() (method exists) to avoid relying on undefined helpers
                    if (typeof this.close === 'function') {
                        this.close();
                    } else if (typeof window.closeDictationPad === 'function') {
                        window.closeDictationPad();
                    }
                } else {
                    // Just show (do not null-out the global instance)
                    this.overlay.classList.add('show');
                    this.isVisible = true;
                    if (this.textEditor) this.textEditor.focus();
                }
            } else {
                this.createOverlay();
                if (this.overlay) this.overlay.classList.add('show');
                this.isVisible = true;
                if (this.textEditor) this.textEditor.focus();
            }
        } catch (e) {
        }
    }
    bindEvents() {
        if (!this.overlay) return;
        // Helper to safely add listener
        const safeAdd = (el, event, fn, opts) => { try { if (el && typeof el.addEventListener === 'function') el.addEventListener(event, fn, opts); } catch(e){ } };
        const closeBtn = this.overlay.querySelector('.close-btn');
        safeAdd(closeBtn, 'click', () => this.close());
        const boldBtn = this.overlay.querySelector('.bold-btn');
        const italicBtn = this.overlay.querySelector('.italic-btn');
        const underlineBtn = this.overlay.querySelector('.underline-btn');
        const strikethroughBtn = this.overlay.querySelector('.strikethrough-btn');
        safeAdd(boldBtn, 'click', () => this.formatText('bold'));
        safeAdd(italicBtn, 'click', () => this.formatText('italic'));
        safeAdd(underlineBtn, 'click', () => this.formatText('underline'));
        safeAdd(strikethroughBtn, 'click', () => this.formatText('strikeThrough'));
        const undoBtn = this.overlay.querySelector('.undo-btn');
        const redoBtn = this.overlay.querySelector('.redo-btn');
        safeAdd(undoBtn, 'click', () => this.formatText('undo'));
        safeAdd(redoBtn, 'click', () => this.formatText('redo'));
        const alignLeftBtn = this.overlay.querySelector('.align-left-btn');
        const alignCenterBtn = this.overlay.querySelector('.align-center-btn');
        const alignRightBtn = this.overlay.querySelector('.align-right-btn');
        safeAdd(alignLeftBtn, "click", () => this.formatText("justifyLeft"));
        safeAdd(alignCenterBtn, "click", () => this.formatText("justifyCenter"));
        safeAdd(alignRightBtn, "click", () => this.formatText("justifyRight"));
        const enterBtn = this.overlay.querySelector(".enter-btn");
        safeAdd(enterBtn, "click", () => this.insertNewLine());
        const fontFamilySelect = this.overlay.querySelector('.font-family-select');
        const fontSizeSelect = this.overlay.querySelector('.font-size-select');
        if (fontFamilySelect && typeof fontFamilySelect.addEventListener === 'function') {
            fontFamilySelect.addEventListener('change', (e) => {
                this.currentFontFamily = e.target.value;
                this.applyCurrentFont();
            });
        }
        if (fontSizeSelect && typeof fontSizeSelect.addEventListener === 'function') {
            fontSizeSelect.addEventListener('change', (e) => {
                this.currentFontSize = e.target.value;
                this.applyCurrentFont();
            });
        }
        // Color palette dropdown
        const colorPaletteBtn = this.overlay.querySelector(".color-palette-btn");
        const colorPaletteArrow = this.overlay.querySelector(".color-palette-arrow");
        const colorPaletteDropdown = this.overlay.querySelector(".color-palette-dropdown");
        const colorPickerInput = this.overlay.querySelector(".color-picker-input");
        const colorOkBtn = this.overlay.querySelector(".color-ok-btn");
        const colorSwatches = this.overlay.querySelectorAll(".color-swatch") || [];
        if (colorPaletteBtn) {
            safeAdd(colorPaletteBtn, "click", () => {
                this.saveCursorPosition(); // Save cursor position when opening color menu
                this.closeAllDropdowns();
                if (colorPaletteDropdown) colorPaletteDropdown.classList.toggle("show");
            });
        }
        if (colorPaletteArrow) {
            safeAdd(colorPaletteArrow, "click", () => {
                this.saveCursorPosition(); // Save cursor position when opening color menu
                // FIXED: Allow closing without selection
                const isCurrentlyOpen = colorPaletteDropdown && colorPaletteDropdown.classList.contains("show");
                this.closeAllDropdowns();
                if (!isCurrentlyOpen && colorPaletteDropdown) {
                    colorPaletteDropdown.classList.add("show");
                }
            });
        }
        if (colorOkBtn && colorPickerInput) {
            safeAdd(colorOkBtn, "click", () => {
                this.restoreCursorPosition(); // Restore cursor position before applying color
                this.currentTextColor = colorPickerInput.value;
                this.formatText("foreColor", this.currentTextColor);
                if (colorPaletteDropdown) colorPaletteDropdown.classList.remove("show");
            });
        }
        if (colorSwatches && colorSwatches.length) {
            colorSwatches.forEach(swatch => {
                try {
                    const handler = (e) => {
                        const color = e.target && (e.target.dataset && e.target.dataset.color) || e.target.getAttribute && e.target.getAttribute('data-color');
                        if (colorPickerInput && color) colorPickerInput.value = color;
                    };
                    safeAdd(swatch, 'click', handler);
                } catch(e){ }
            });
        }
        // Copy buttons
        const copyMainBtn = this.overlay.querySelector('.copy-main-btn');
        const copyArrowBtn = this.overlay.querySelector('.copy-arrow-btn');
        const copyDropdown = this.overlay.querySelector('.copy-dropdown');
        const copyFormatted = this.overlay.querySelector('.copy-formatted');
        const copyPlain = this.overlay.querySelector('.copy-plain');
        if (copyMainBtn) safeAdd(copyMainBtn, 'click', () => { this.copyAllPlainText(); });
        if (copyArrowBtn) safeAdd(copyArrowBtn, 'click', (e) => {
            try { e.stopPropagation(); const isCurrentlyOpen = copyDropdown && copyDropdown.classList.contains('show'); this.closeAllDropdowns(); if (!isCurrentlyOpen && copyDropdown) copyDropdown.classList.add('show'); } catch(e){ }
        });
        if (copyFormatted) safeAdd(copyFormatted, 'click', (e) => { try{ e.stopPropagation(); this.copyAllFormattedText(); if (copyDropdown) copyDropdown.classList.remove('show'); }catch(e){} });
        if (copyPlain) safeAdd(copyPlain, 'click', (e) => { try{ e.stopPropagation(); this.copyAllPlainText(); if (copyDropdown) copyDropdown.classList.remove('show'); }catch(e){} });
        // Cut buttons
        const cutMainBtn = this.overlay.querySelector('.cut-main-btn');
        const cutArrowBtn = this.overlay.querySelector('.cut-arrow-btn');
        const cutDropdown = this.overlay.querySelector('.cut-dropdown');
        const cutFormatted = this.overlay.querySelector('.cut-formatted');
        const cutPlain = this.overlay.querySelector('.cut-plain');
        if (cutMainBtn) safeAdd(cutMainBtn, 'click', () => { this.cutAllPlainText(); });
        if (cutArrowBtn) safeAdd(cutArrowBtn, 'click', (e) => { try{ e.stopPropagation(); const isCurrentlyOpen = cutDropdown && cutDropdown.classList.contains('show'); this.closeAllDropdowns(); if (!isCurrentlyOpen && cutDropdown) cutDropdown.classList.add('show'); }catch(e){} });
        if (cutFormatted) safeAdd(cutFormatted, 'click', (e) => { try{ e.stopPropagation(); this.cutAllFormattedText(); if (cutDropdown) cutDropdown.classList.remove('show'); }catch(e){} });
        if (cutPlain) safeAdd(cutPlain, 'click', (e) => { try{ e.stopPropagation(); this.cutAllPlainText(); if (cutDropdown) cutDropdown.classList.remove('show'); }catch(e){} });
        // Extension control buttons
        const revertLangBtn = this.overlay.querySelector('.revert-lang-btn');
        const selectLangBtn = this.overlay.querySelector('.select-lang-btn');
        const shortcutsBtn = this.overlay.querySelector('.shortcuts-btn');
        const resetMicBtn = this.overlay.querySelector('.reset-mic-btn');
        if (revertLangBtn) safeAdd(revertLangBtn, 'click', () => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    this.saveCursorPosition(); // Save cursor position before action
                    chrome.runtime.sendMessage({ action: 'revert_language' }, () => {
                        if (chrome.runtime && chrome.runtime.lastError)
                        this.restoreCursorPosition(); // Restore cursor position after action
                    });
                } catch(e){ this.restoreCursorPosition(); }
            } else { this.restoreCursorPosition(); }
        });
        if (selectLangBtn) safeAdd(selectLangBtn, 'click', () => {
            this.saveCursorPosition(); // Save cursor position before action
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    chrome.runtime.sendMessage({ action: "select_language" }, () => {
                        if (chrome.runtime && chrome.runtime.lastError)
                        this.restoreCursorPosition();
                    });
                } catch(e){ this.restoreCursorPosition(); }
            } else { this.restoreCursorPosition(); }
        });
        if (shortcutsBtn) safeAdd(shortcutsBtn, 'click', () => {
            this.saveCursorPosition(); // Save cursor position before action
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    chrome.runtime.sendMessage({ action: "show_shortcuts" }, () => {
                        if (chrome.runtime && chrome.runtime.lastError)
                        this.restoreCursorPosition();
                    });
                } catch(e){ this.restoreCursorPosition(); }
            } else { this.restoreCursorPosition(); }
        });
        if (resetMicBtn) safeAdd(resetMicBtn, 'click', () => {
            this.saveCursorPosition(); // Save cursor position before action
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    chrome.runtime.sendMessage({ action: "reset_microphone" }, () => {
                        if (chrome.runtime && chrome.runtime.lastError)
                        this.restoreCursorPosition();
                    });
                } catch(e){ this.restoreCursorPosition(); }
            } else { this.restoreCursorPosition(); }
        });
        const pasteBtn = this.overlay.querySelector('.paste-btn');
        const clearBtn = this.overlay.querySelector('.clear-btn');
        const saveBtn = this.overlay.querySelector('.save-btn');
        const exportTxtBtn = this.overlay.querySelector('.export-txt-btn');
        const exportHtmlBtn = this.overlay.querySelector('.export-html-btn');
        if (pasteBtn) safeAdd(pasteBtn, 'click', () => this.pasteText());
        if (clearBtn) safeAdd(clearBtn, 'click', () => this.clearText());
        if (saveBtn) safeAdd(saveBtn, 'click', () => this.saveContent(true));
        if (exportTxtBtn) safeAdd(exportTxtBtn, 'click', () => this.exportAsText());
        if (exportHtmlBtn) safeAdd(exportHtmlBtn, 'click', () => this.exportAsHtml());
        // Auto-save checkbox
        const autoSaveCheck = this.overlay.querySelector('#autoSaveCheck');
        if (autoSaveCheck) safeAdd(autoSaveCheck, 'change', (e) => {
            this.autoSaveEnabled = e.target.checked;
        });
        if (this.textEditor) {
            safeAdd(this.textEditor, 'input', (e) => {
                try {
                    this.updateCounts();
                    if (this.autoSaveEnabled) {
                        this.autoSave();
                    }
                    // Handle font styling for new text
                    this.handleFontForNewText(e);
                } catch(e){ }
            });
            safeAdd(this.textEditor, 'keydown', (e) => {
                try {
                    if (e.ctrlKey || e.metaKey) {
                        switch (e.key) {
                            case 'b':
                                e.preventDefault();
                                this.formatText('bold');
                                break;
                            case 'i':
                                e.preventDefault();
                                this.formatText('italic');
                                break;
                            case 'u':
                                e.preventDefault();
                                this.formatText('underline');
                                break;
                            case 's':
                                e.preventDefault();
                                this.saveContent(true);
                                break;
                            case 'z':
                                if (e.shiftKey) {
                                    e.preventDefault();
                                    this.formatText('redo');
                                } else {
                                    e.preventDefault();
                                    this.formatText('undo');
                                }
                                break;
                        }
                    }
                } catch(e){ }
            });
        }
        const container = this.overlay.querySelector('.dictation-container');
        if (container) safeAdd(container, 'click', (e) => { e.stopPropagation(); });
        // Improved dropdown closing
        if (this.overlay) safeAdd(this.overlay, 'click', (e) => {
            try {
                // Check if click is on dropdown arrow or main button
                const isDropdownArrow = e.target.classList && (e.target.classList.contains('dropdown-arrow') || e.target.closest('.dropdown-arrow'));
                const isDropdownMain = e.target.classList && (e.target.classList.contains('dropdown-main') || e.target.closest('.dropdown-main'));
                // If clicking on arrow or main button, let their event handlers manage the dropdown
                if (isDropdownArrow || isDropdownMain) {
                    return;
                }
                // If clicking outside dropdown containers, close all dropdowns
                if (!e.target.closest || !e.target.closest('.dropdown-container')) {
                    this.closeAllDropdowns();
                }
            } catch(e){ }
        });
        safeAdd(document, 'click', (e) => {
            try {
                if (!e.target.closest || !e.target.closest('.dictation-overlay')) {
                    this.closeAllDropdowns();
                }
            } catch(e){ }
        });
    }
    closeAllDropdowns() {
        const dropdowns = this.overlay.querySelectorAll('.dropdown-content');
        dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    }
    formatText(command, value = null) {
        document.execCommand(command, false, value);
        this.textEditor.focus();
        this.updateToolbarState();
    }
    applyCurrentFont() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            if (!selection.isCollapsed) {
                // If text is selected, apply font to selected text only
                this.applyFontToSelection(selection);
            } else {
                // If no text is selected, set font for future typing
                this.setFontForFutureTyping();
            }
        } else {
            // Fallback: set font for future typing
            this.setFontForFutureTyping();
        }
        this.textEditor.focus();
    }
    applyFontToSelection(selection) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontFamily = this.currentFontFamily;
        span.style.fontSize = this.currentFontSize + 'px';
        try {
            range.surroundContents(span);
        } catch (e) {
            // If surroundContents fails (e.g., range spans multiple elements),
            // extract contents and wrap them
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }
        // Restore selection
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
    }
    setFontForFutureTyping() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // Create an invisible span at cursor position to set font for future typing
            const span = document.createElement('span');
            span.style.fontFamily = this.currentFontFamily;
            span.style.fontSize = this.currentFontSize + 'px';
            span.appendChild(document.createTextNode('\u200B')); // Zero-width space
            range.insertNode(span);
            // Position cursor after the span
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
            // Store current font settings for new text
            this.textEditor.setAttribute('data-current-font-family', this.currentFontFamily);
            this.textEditor.setAttribute('data-current-font-size', this.currentFontSize);
        }
    }
    applyTextColor() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (!range.collapsed) {
                // If text is selected, apply color to selection using execCommand
                document.execCommand('foreColor', false, this.currentTextColor);
            } else {
                // If no text is selected, set color for future typing
                document.execCommand('foreColor', false, this.currentTextColor);
            }
            this.textEditor.focus();
        }
    }
    saveCursorPosition() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.savedCursorPosition = {
                range: selection.getRangeAt(0).cloneRange(),
                isCollapsed: selection.isCollapsed
            };
        }
    }
    restoreCursorPosition() {
        if (this.savedCursorPosition && this.textEditor) {
            try {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(this.savedCursorPosition.range);
                this.textEditor.focus();
            } catch (e) {
                // If restoration fails, just focus the editor
                this.textEditor.focus();
            }
        }
    }
    handleFontForNewText(e) {
        // This function ensures that newly typed text inherits the current font settings
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && e.inputType === 'insertText') {
            const range = selection.getRangeAt(0);
            const currentNode = range.startContainer;
            // Check if we're typing in a span with font styling
            let parentSpan = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentNode : currentNode;
            // If we're not in a styled span and we have current font settings, wrap the new text
            if (parentSpan.tagName !== 'SPAN' || 
                !parentSpan.style.fontFamily || 
                !parentSpan.style.fontSize) {
                const fontFamily = this.textEditor.getAttribute('data-current-font-family') || this.currentFontFamily;
                const fontSize = this.textEditor.getAttribute('data-current-font-size') || this.currentFontSize;
                if (fontFamily !== 'Arial' || fontSize !== '14') {
                    // Create a new span for the typed character
                    const span = document.createElement('span');
                    span.style.fontFamily = fontFamily;
                    span.style.fontSize = fontSize + 'px';
                    // Move the newly typed character into the span
                    const textNode = currentNode;
                    if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent.length > 0) {
                        const lastChar = textNode.textContent.slice(-1);
                        textNode.textContent = textNode.textContent.slice(0, -1);
                        span.textContent = lastChar;
                        // Insert the span after the text node
                        textNode.parentNode.insertBefore(span, textNode.nextSibling);
                        // Move cursor to end of span
                        const newRange = document.createRange();
                        newRange.setStartAfter(span);
                        newRange.setEndAfter(span);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
            }
        }
    }
    updateToolbarState() {
        const boldBtn = this.overlay && this.overlay.querySelector ? this.overlay.querySelector(".bold-btn") : null;
        const italicBtn = this.overlay && this.overlay.querySelector ? this.overlay.querySelector(".italic-btn") : null;
        const underlineBtn = this.overlay && this.overlay.querySelector ? this.overlay.querySelector(".underline-btn") : null;
        const strikethroughBtn = this.overlay && this.overlay.querySelector ? this.overlay.querySelector(".strikethrough-btn") : null;
        if (boldBtn) boldBtn.classList.toggle("active", document.queryCommandState("bold"));
        if (italicBtn) italicBtn.classList.toggle("active", document.queryCommandState("italic"));
        if (underlineBtn) underlineBtn.classList.toggle("active", document.queryCommandState("underline"));
        if (strikethroughBtn) strikethroughBtn.classList.toggle("active", document.queryCommandState("strikeThrough"));
    }
    insertNewLine() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        // Önce birinci satır eklemesini yap
        const br1 = document.createElement('br');
        range.deleteContents();
        range.insertNode(br1);
        range.setStartAfter(br1);
        range.setEndAfter(br1);
        // Eğer satır başında değilsek ikinci kez çalıştır
        if (!this.isAtLineStart()) {
            const br2 = document.createElement('br');
            range.insertNode(br2);
            range.setStartAfter(br2);
            range.setEndAfter(br2);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        this.textEditor.focus();
        this.updateCounts();
    }
    isAtLineStart() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;
        const range = selection.getRangeAt(0);
        const clonedRange = range.cloneRange();
        clonedRange.setStart(range.startContainer, 0);
        const textBefore = clonedRange.toString();
        // NBSP’yi normal boşluk yapıp kontrol et
        return textBefore.replace(/\u00A0/g, ' ').trim() === '';
    }
    insertComma() {
        const symbol = ','; 
        const nbsp = '\u00A0'; // Non-breakable space
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        // 1. İmlecin solundaki karakteri sil
        range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        range.deleteContents();
        // 2. Virgül + NBSP ekle
        const commaSpaceNode = document.createTextNode(symbol + nbsp);
        range.insertNode(commaSpaceNode);
        // 3. İmleci boşluğun sağına al
        const newRange = document.createRange();
        newRange.setStartAfter(commaSpaceNode);
        newRange.setEndAfter(commaSpaceNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.textEditor.focus();
        this.updateCounts();
        if (this.autoSaveEnabled) {
            this.autoSave();
        }
    }
        insertPeriod() {
        const symbol = '.'; 
        const nbsp = '\u00A0'; // Non-breakable space
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        // 1. İmlecin solundaki karakteri sil
        range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        range.deleteContents();
        // 2. Virgül + NBSP ekle
        const commaSpaceNode = document.createTextNode(symbol + nbsp);
        range.insertNode(commaSpaceNode);
        // 3. İmleci boşluğun sağına al
        const newRange = document.createRange();
        newRange.setStartAfter(commaSpaceNode);
        newRange.setEndAfter(commaSpaceNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.textEditor.focus();
        this.updateCounts();
        if (this.autoSaveEnabled) {
            this.autoSave();
        }
    }
        insertQuma() {
        const symbol = '?'; 
        const nbsp = '\u00A0'; // Non-breakable space
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        // 1. İmlecin solundaki karakteri sil
        range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        range.deleteContents();
        // 2. Virgül + NBSP ekle
        const commaSpaceNode = document.createTextNode(symbol + nbsp);
        range.insertNode(commaSpaceNode);
        // 3. İmleci boşluğun sağına al
        const newRange = document.createRange();
        newRange.setStartAfter(commaSpaceNode);
        newRange.setEndAfter(commaSpaceNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.textEditor.focus();
        this.updateCounts();
        if (this.autoSaveEnabled) {
            this.autoSave();
        }
    }
    performBackspace() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (!range.collapsed) {
                // If text is selected, delete the selection
                range.deleteContents();
            } else {
                // If no text is selected, delete the character before cursor
                const startContainer = range.startContainer;
                const startOffset = range.startOffset;
                if (startOffset > 0) {
                    if (startContainer.nodeType === Node.TEXT_NODE) {
                        // Delete character from text node
                        const textContent = startContainer.textContent;
                        startContainer.textContent = textContent.slice(0, startOffset - 1) + textContent.slice(startOffset);
                        range.setStart(startContainer, startOffset - 1);
                        range.setEnd(startContainer, startOffset - 1);
                    } else {
                        // Delete previous element (like <br>)
                        const previousNode = startContainer.childNodes[startOffset - 1];
                        if (previousNode) {
                            previousNode.remove();
                            range.setStart(startContainer, startOffset - 1);
                            range.setEnd(startContainer, startOffset - 1);
                        }
                    }
                } else {
                    // At the beginning of current container, try to merge with previous
                    const parentNode = startContainer.parentNode;
                    const previousSibling = startContainer.previousSibling;
                    if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE && previousSibling.tagName === 'BR') {
                        previousSibling.remove();
                    } else if (previousSibling && previousSibling.nodeType === Node.TEXT_NODE && previousSibling.textContent.length > 0) {
                        const prevTextContent = previousSibling.textContent;
                        previousSibling.textContent = prevTextContent.slice(0, -1);
                        range.setStart(previousSibling, previousSibling.textContent.length);
                        range.setEnd(previousSibling, previousSibling.textContent.length);
                    }
                }
            }
            selection.removeAllRanges();
            selection.addRange(range);
            this.textEditor.focus();
            this.updateCounts();
        }
    }
    performWordBackspace() {
        const doDelete = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            this.textEditor.focus();
            if (!range.collapsed) {
                range.deleteContents();
            } else {
                try {
                    const cursorPosition = range.startOffset;
                    const container = range.startContainer;
                    if (container.nodeType === Node.TEXT_NODE && cursorPosition > 0) {
                        const textContent = container.textContent;
                        let start = cursorPosition;
                        let end = cursorPosition;
                        if (textContent.charAt(cursorPosition - 1) === ' ') {
                            start = cursorPosition - 1;
                            end = cursorPosition;
                        } else {
                            let wordStart = textContent.lastIndexOf(' ', cursorPosition - 1);
                            if (wordStart === -1) {
                                wordStart = 0;
                            } else {
                                wordStart++;
                            }
                            start = wordStart;
                            end = cursorPosition;
                        }
                        range.setStart(container, start);
                        range.setEnd(container, end);
                        range.deleteContents();
                    } else {
                        document.execCommand("delete", false, null);
                    }
                } catch (e) {
                }
            }
            selection.removeAllRanges();
            selection.addRange(range);
            this.updateCounts();
        };
        // 1. Normal silme
        doDelete();
        // 2. Hatalı davranışı telafi etmek için tekrar sil
        doDelete();
        // 3. Boşluğu geri ekle
        const space = document.createTextNode(" ");
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.insertNode(space);
        range.setStartAfter(space);
        range.setEndAfter(space);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    copyAllFormattedText() {
        const htmlContent = this.textEditor.innerHTML;
        const clipboardItem = new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([this.textEditor.innerText], { type: 'text/plain' })
        });
        navigator.clipboard.write([clipboardItem]).then(() => {
            this.showNotification('All formatted text copied');
        }).catch(() => {
            this.copyAllPlainText();
        });
    }
    copyAllFormattedText() {
        const htmlContent = this.textEditor.innerHTML;
        const clipboardItem = new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([this.textEditor.innerText], { type: 'text/plain' })
        });
        navigator.clipboard.write([clipboardItem]).then(() => {
            this.showNotification('All formatted text copied');
        }).catch(() => {
            this.copyAllPlainText();
        });
    }
    copyAllPlainText() {
        navigator.clipboard.writeText(this.textEditor.innerText).then(() => {
            this.showNotification('All plain text copied');
        }).catch(() => { this.showNotification('Copy failed'); });
    }
    cutAllFormattedText() {
        this.saveStateForUndo();
        this.copyAllFormattedText();
        this.textEditor.innerHTML = '';
        this.updateCounts();
        this.showNotification('All formatted text cut');
        this.saveContent(true);
    }
    cutAllPlainText() {
        this.saveStateForUndo();
        this.copyAllPlainText();
        this.textEditor.innerHTML = '';
        this.updateCounts();
        this.showNotification('All plain text cut');
        this.saveContent(true);
    }
    saveStateForUndo() {
        const tempSpan = document.createElement('span');
        tempSpan.style.display = 'none';
        this.textEditor.appendChild(tempSpan);
        this.safeExecCommand('insertText', '');
        tempSpan.remove();
    }
    async pasteText() {
        try {
            let text = '';
            if (navigator.clipboard && navigator.clipboard.readText) {
                text = await navigator.clipboard.readText();
                this.safeExecCommand('insertText', text + ' ');
                this.updateCounts();
            } else {
                this.showNotification('Clipboard not available');
            }
        } catch (err) {
            this.showNotification('Unable to paste text');
        }
    }
    clearText() {
        if (confirm('Are you sure you want to clear all text?')) {
            this.saveStateForUndo();
            this.textEditor.innerHTML = '';
            this.updateCounts();
            if (this.autoSaveEnabled) {
                this.autoSave();
            }
        }
    }
    updateCounts() {
        if (!this.textEditor) return;
        const text = this.textEditor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const wordCountEl = this.overlay && this.overlay.querySelector ? this.overlay.querySelector('.word-count') : null;
        const charCountEl = this.overlay && this.overlay.querySelector ? this.overlay.querySelector('.char-count') : null;
        if (wordCountEl) wordCountEl.textContent = `Words: ${words}`;
        if (charCountEl) charCountEl.textContent = `Characters: ${chars}`;
    }
    saveContent(manual = false) {
        const content = this.textEditor ? this.textEditor.innerHTML : '';
        try { localStorage.setItem('dictationPadContent', content); } catch(e) { }
        if (manual || this.autoSaveEnabled) {
            this.showNotification('Content saved');
        }
    }
    loadSavedContent() {
        const savedContent = localStorage.getItem('dictationPadContent');
        if (savedContent && this.textEditor) {
            try { this.textEditor.innerHTML = savedContent; } catch(e){ }
            this.updateCounts();
        }
    }
    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveContent(false);
        }, 2000);
    }
    exportAsText() {
        try {
            const content = this.textEditor.innerText || '';
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            a.download = `MuVu-TalkScript-dictation-pad-${date}-${time}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showNotification('Text file exported');
        } catch (error) {
            this.showNotification('Export failed');
        }
    }
    exportAsHtml() {
        try {
            const content = this.textEditor.innerHTML || '';
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MuVu-TalkScript Dictation Pad Export</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
        }
        h1, h2, h3 { color: #2c3e50; }
        p { margin-bottom: 1em; }
    </style>
</head>
<body>
    <h1>MuVu-TalkScript Dictation Pad Export</h1>
    <hr>
    ${content}
</body>
</html>`;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            a.download = `MuVu-TalkScript-dictation-pad-${date}-${time}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showNotification('HTML file exported');
        } catch (error) {
            this.showNotification('Export failed');
        }
    }
    show() {
        if (!this.overlay) {
            this.createOverlay();
        }
        this.overlay.classList.remove('hidden');
        this.isVisible = true;
        setTimeout(() => {
            this.overlay.classList.add('show');
        }, 10);
        if (this.textEditor) {
            this.textEditor.focus();
        }
    }
    close() {
        if (this.overlay) {
            this.overlay.classList.remove('show');
            this.isVisible = false;
            setTimeout(() => {
                this.overlay.classList.add('hidden');
            // Force reset overlay reference for fresh create on next open
            if (window.dictationPadOverlayInstance) {
              try {
                window.dictationPadOverlayInstance.overlay = null;
              } catch(e) { }
            }
            }, 300);
        }
    }
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'dictation-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    insertText(text) {
        if (this.textEditor && this.isVisible) {
            const span = document.createElement('span');
            span.style.fontFamily = this.currentFontFamily;
            span.style.fontSize = this.currentFontSize + 'px';
            span.textContent = text + ' ';
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(span);
                range.setStartAfter(span);
                range.setEndAfter(span);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                this.textEditor.appendChild(span);
            }
            this.updateCounts();
            if (this.autoSaveEnabled) {
                this.autoSave();
            }
        }
    }
    isOverlayVisible() {
        return this.isVisible;
    }
}
/* Unified global accessors - use the central window.dictationPadOverlayInstance */
function showDictationPad() {
    if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.show === 'function') {
        window.dictationPadOverlayInstance.show();
        return;
    }
    if (typeof DictationPadOverlay === 'function') {
        window.dictationPadOverlayInstance = new DictationPadOverlay();
        window.dictationPadOverlayInstance.show();
    }
}
function hideDictationPad() {
    if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.close === 'function') {
        window.dictationPadOverlayInstance.close();
    }
}
function insertTextToDictationPad(text) {
    if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.insertText === 'function' && window.dictationPadOverlayInstance.isOverlayVisible()) {
        window.dictationPadOverlayInstance.insertText(text);
    }
}
if (typeof window !== 'undefined') {
    window.showDictationPad = showDictationPad;
    window.hideDictationPad = hideDictationPad;
    window.insertTextToDictationPad = insertTextToDictationPad;
}
if (!window.dictationPadOverlayInstance) {
    window.dictationPadOverlayInstance = new DictationPadOverlay();
}
window.toggleDictationPad = function(){
    try {
        if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.toggle === 'function') {
            window.dictationPadOverlayInstance.toggle();
            return;
        }
        if (typeof DictationPadOverlay === 'function') {
            window.dictationPadOverlayInstance = new DictationPadOverlay();
            window.dictationPadOverlayInstance.show();
        }
    } catch(e) { }
};
/* --- Assistant patch: Robust lifecycle & cleanup helpers --- */
(function(){
  // Arrays to track timers and listeners to ensure cleanup
  window._dictationIntervals = window._dictationIntervals || [];
  window._dictationTimeouts = window._dictationTimeouts || [];
  window._dictationListeners = window._dictationListeners || [];
  // Helper to add tracked listeners (use this in future changes)
  window._dictationAddListener = function(target, event, fn, options){
    try {
      target.addEventListener(event, fn, options);
      window._dictationListeners.push([target, event, fn, options]);
    } catch(e){ }
  };
  // Helper to track intervals/timeouts
  window._dictationSetInterval = function(fn, ms){
    const id = setInterval(fn, ms);
    window._dictationIntervals.push(id);
    return id;
  };
  window._dictationSetTimeout = function(fn, ms){
    const id = setTimeout(fn, ms);
    window._dictationTimeouts.push(id);
    return id;
  };
  // Centralized cleanup used on both close paths
  window._dictationCleanupAll = function(){
    try {
      // Clear intervals/timeouts
      (window._dictationIntervals || []).forEach(clearInterval);
      (window._dictationTimeouts || []).forEach(clearTimeout);
      window._dictationIntervals = [];
      window._dictationTimeouts = [];
      // Remove listeners
      (window._dictationListeners || []).forEach(function(item){
        try { const [t, e, f, o] = item; t.removeEventListener(e, f, o); } catch(e){}
      });
      window._dictationListeners = [];
      // Remove element-level listeners by replacing overlay node with clone (if exists)
      const overlay = document.getElementById('konusucu-overlay') || document.getElementById('dictation-pad-overlay');
      if (overlay && overlay.parentNode) {
        const clone = overlay.cloneNode(false); // shallow clone removes element listeners
        overlay.parentNode.replaceChild(clone, overlay);
        clone.remove();
        if (window.dictationPadOverlayInstance) {
          try {
            window.dictationPadOverlayInstance.overlay = null;
            window.dictationPadOverlayInstance.isVisible = false;
          } catch(e) { }
        }
clone.remove();
        try {
          if (window.dictationPadOverlayInstance) {
            window.dictationPadOverlayInstance.overlay = null;
            window.dictationPadOverlayInstance.isVisible = false;
          }
        } catch(e) { }
 // then remove from DOM
      }
    } catch(e){ }
  };
  // Safe open/close/toggle functions
  window.openDictationPad = function(){
    try{
      if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.open === 'function') {
        window.dictationPadOverlayInstance.open();
        return;
      }
      if (!window.dictationPadOverlayInstance) {
        // create instance if class available
        if (typeof DictationPadOverlay === 'function') {
          window.dictationPadOverlayInstance = new DictationPadOverlay();
        }
      }
      if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.open === 'function') {
        window.dictationPadOverlayInstance.open();
      } else if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.toggle === 'function') {
        window.dictationPadOverlayInstance.toggle();
      }
    } catch(e){ }
  };
  window.closeDictationPad = function(){
    try{
      if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.close === 'function') {
        try { window.dictationPadOverlayInstance.close(); } catch(e){ }
      }
      // Call centralized cleanup to ensure no leftover listeners/timers
      window._dictationCleanupAll();
      // Keep instance but mark not visible if property exists
      if (window.dictationPadOverlayInstance) {
        try { window.dictationPadOverlayInstance.isVisible = false; } catch(e){}
      }
    } catch(e){ }
  };
  window.toggleDictationPad = function(){
    try {
      // Prefer instance toggle if exists
      if (window.dictationPadOverlayInstance && typeof window.dictationPadOverlayInstance.toggle === 'function') {
        window.dictationPadOverlayInstance.toggle();
        return;
      }
      // Otherwise decide based on existence in DOM
      const overlay = document.getElementById('konusucu-overlay') || document.getElementById('dictation-pad-overlay');
      if (overlay) window.closeDictationPad(); else window.openDictationPad();
    } catch(e){ }
  };
  // Ensure other scripts can call centralized cleanup when closing via X button
  window.closeOverlay = window.closeOverlay || function(){ window.closeDictationPad(); };
})(); // end patch
