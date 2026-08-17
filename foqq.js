(function() {
    // ============ CONFIGURATION ============
    const API_KEY = "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";
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const DEFAULT_MODEL = "openai/gpt-oss-120b";
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';
    const altKey = isMac ? '⌥' : 'Alt';
    
    // ============ FORCE TEXT SELECTION - SAFE VERSION ============
    function forceTextSelection() {
        // Only target text-containing elements, NOT interactive ones
        const styleOverride = document.createElement('style');
        styleOverride.id = 'sdp-force-select-override';
        styleOverride.textContent = `
            /* Force selection on text elements only */
            p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, label, 
            .text, .content, .description, .message, .comment, .post,
            [class*="text"], [class*="content"], [class*="message"] {
                user-select: auto !important;
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
                -ms-user-select: auto !important;
            }
            
            /* NEVER override selection on interactive elements */
            input, textarea, button, select, option, a, [role="button"], 
            [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"],
            [contenteditable="true"], .btn, .button, .clickable,
            input[type="text"], input[type="password"], input[type="email"], 
            input[type="search"], input[type="number"], input[type="tel"],
            .no-select, .noselect, [class*="no-select"], [class*="noselect"] {
                user-select: auto !important;
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
                -ms-user-select: auto !important;
                cursor: auto !important;
                pointer-events: auto !important;
            }
            
            /* Text cursor only for text areas */
            textarea, input[type="text"], input[type="password"], 
            input[type="email"], input[type="search"], [contenteditable="true"] {
                cursor: text !important;
            }
            
            /* Fix any broken pointer events */
            * {
                pointer-events: auto !important;
            }
            
            /* But keep pointer-events: none on elements that need it */
            .sdp-notification, .sdp-copy-selected-btn, #sdp-widget * {
                pointer-events: auto !important;
            }
        `;
        document.head.appendChild(styleOverride);
        
        // Fix any inline styles that might break interactivity
        const fixElements = () => {
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                // Only remove user-select:none from text elements
                if (el.style && el.style.userSelect === 'none') {
                    const tag = el.tagName.toLowerCase();
                    const isInteractive = ['input', 'textarea', 'button', 'select', 'a'].includes(tag);
                    const hasRole = el.getAttribute('role');
                    const isContentEditable = el.isContentEditable;
                    
                    // Only remove if NOT interactive
                    if (!isInteractive && !hasRole && !isContentEditable) {
                        el.style.userSelect = 'auto';
                        el.style.webkitUserSelect = 'auto';
                        el.style.msUserSelect = 'auto';
                    }
                }
            });
        };
        
        fixElements();
        
        // Monitor for dynamically added elements
        const observer = new MutationObserver(() => fixElements());
        observer.observe(document.body, { childList: true, subtree: true });
        
        console.log('[SDP] Force text selection enabled (safe mode)');
    }
    
    // Run immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceTextSelection);
    } else {
        forceTextSelection();
    }
    
    // ============ SESSION STORAGE CLIPBOARD ============
    const CLIPBOARD_KEY = 'shadowpasser_clipboard';
    const CLIPBOARD_TIME_KEY = 'shadowpasser_clipboard_time';
    
    function setClipboard(text) {
        try {
            sessionStorage.setItem(CLIPBOARD_KEY, text);
            sessionStorage.setItem(CLIPBOARD_TIME_KEY, Date.now().toString());
            return true;
        } catch(e) {
            return false;
        }
    }
    
    function getClipboard() {
        try {
            const text = sessionStorage.getItem(CLIPBOARD_KEY);
            const time = sessionStorage.getItem(CLIPBOARD_TIME_KEY);
            if (text && time) {
                const age = Date.now() - parseInt(time);
                if (age > 600000) {
                    sessionStorage.removeItem(CLIPBOARD_KEY);
                    sessionStorage.removeItem(CLIPBOARD_TIME_KEY);
                    return null;
                }
                return text;
            }
            return null;
        } catch(e) {
            return null;
        }
    }
    
    function showNotification(msg, color) {
        const notif = document.createElement('div');
        notif.textContent = msg;
        notif.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 30px;
            background: ${color};
            color: white;
            padding: 10px 20px;
            border-radius: 12px;
            font-size: 13px;
            z-index: 9999999;
            font-family: monospace;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2s;
            pointer-events: none;
        `;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }
    
    // ============ UNIVERSAL TEXT SELECTION ============
    function getSelectedText() {
        let text = '';
        
        // Method 1: window.getSelection
        try {
            const sel = window.getSelection();
            if (sel && sel.toString().trim()) {
                text = sel.toString().trim();
                if (text) return text;
            }
        } catch(e) {}
        
        // Method 2: document.activeElement (input/textarea)
        try {
            const el = document.activeElement;
            if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    const start = el.selectionStart || 0;
                    const end = el.selectionEnd || 0;
                    if (start !== end) {
                        text = el.value.substring(start, end).trim();
                        if (text) return text;
                    }
                }
                if (el.isContentEditable) {
                    const sel = window.getSelection();
                    if (sel && sel.toString().trim()) {
                        text = sel.toString().trim();
                        if (text) return text;
                    }
                }
            }
        } catch(e) {}
        
        // Method 3: Try to get from document
        try {
            const sel = document.getSelection();
            if (sel && sel.toString().trim()) {
                text = sel.toString().trim();
                if (text) return text;
            }
        } catch(e) {}
        
        return '';
    }
    
    // ============ MARKDOWN RENDERER ============
    const markdown = {
        render(text) {
            if (!text) return '';
            let html = text;
            
            html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                lang = lang || 'code';
                const escaped = this.escapeHtml(code);
                return `<div class="sdp-code-block">
                            <div class="sdp-code-header">
                                <span class="sdp-code-lang">${lang}</span>
                                <button class="sdp-copy-code" onclick="(function(){var t='${this.escapeHtml(code.replace(/'/g, "\\'"))}';window._sdpClipboardCopy(t);})()">📋 Copy</button>
                            </div>
                            <pre><code>${escaped}</code></pre>
                        </div>`;
            });
            
            html = html.replace(/`([^`]+)`/g, '<code class="sdp-inline-code">$1</code>');
            html = html.replace(/^### (.*$)/gm, '<h3 class="sdp-h3">$1</h3>');
            html = html.replace(/^## (.*$)/gm, '<h2 class="sdp-h2">$1</h2>');
            html = html.replace(/^# (.*$)/gm, '<h1 class="sdp-h1">$1</h1>');
            html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
            html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" class="sdp-link">$1</a>');
            html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
            html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
            html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="sdp-list">$&</ul>');
            html = html.replace(/^> (.*$)/gm, '<blockquote class="sdp-blockquote">$1</blockquote>');
            html = html.replace(/\n\n/g, '<br><br>');
            html = html.replace(/\n/g, '<br>');
            
            return html;
        },
        
        escapeHtml(text) {
            return text.replace(/[&<>]/g, (c) => {
                const map = {'&':'&amp;','<':'&lt;','>':'&gt;'};
                return map[c];
            });
        }
    };
    
    // Expose clipboard copy for inline buttons
    window._sdpClipboardCopy = function(text) {
        if (setClipboard(text)) {
            showNotification('✓ Copied to internal clipboard', '#10a37f');
        }
    };
    
    // ============ CREATE WIDGET ============
    function createWidget() {
        if (document.getElementById('sdp-widget')) return;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes sdpFadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes sdpBounce {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                30% { transform: translateY(-8px); opacity: 1; }
            }
            @keyframes sdpSlideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes sdpFadeOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100px); }
            }
            
            .sdp-code-block {
                margin: 12px 0;
                border-radius: 12px;
                overflow: hidden;
                background: #0a0a0f;
                border: 1px solid rgba(102,126,234,0.2);
            }
            .sdp-code-header {
                background: #0f0f1a;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(102,126,234,0.2);
            }
            .sdp-code-lang {
                font-size: 11px;
                font-weight: 600;
                color: #667eea;
                text-transform: uppercase;
            }
            .sdp-copy-code {
                background: rgba(102,126,234,0.1);
                border: 1px solid rgba(102,126,234,0.2);
                color: #a0aec0;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                font-family: inherit;
                pointer-events: auto;
            }
            .sdp-copy-code:hover {
                background: rgba(102,126,234,0.2);
                border-color: #667eea;
                color: white;
            }
            pre {
                margin: 0;
                padding: 16px;
                overflow-x: auto;
                white-space: pre;
                word-wrap: normal;
            }
            code {
                font-family: 'Courier New', 'Monaco', monospace;
                font-size: 12px;
                color: #e2e8f0;
                line-height: 1.5;
            }
            .sdp-inline-code {
                background: rgba(102,126,234,0.15);
                color: #a0aec0;
                padding: 2px 6px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 12px;
            }
            .sdp-h1, .sdp-h2, .sdp-h3 { margin: 16px 0 8px 0; color: #fff; }
            .sdp-h1 { font-size: 22px; }
            .sdp-h2 { font-size: 19px; }
            .sdp-h3 { font-size: 17px; }
            .sdp-link { color: #667eea; text-decoration: none; }
            .sdp-link:hover { text-decoration: underline; }
            .sdp-blockquote {
                border-left: 3px solid #667eea;
                margin: 12px 0;
                padding: 8px 16px;
                background: rgba(102,126,234,0.05);
            }
            .sdp-list { margin: 8px 0; padding-left: 24px; }
            .sdp-list li { margin: 6px 0; }
            
            #sdp-chat::-webkit-scrollbar { width: 6px; }
            #sdp-chat::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
            #sdp-chat::-webkit-scrollbar-thumb { background: rgba(102,126,234,0.3); border-radius: 10px; }
            #sdp-chat::-webkit-scrollbar-thumb:hover { background: rgba(102,126,234,0.5); }
            
            #sdp-widget button {
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            
            #sdp-widget textarea {
                pointer-events: auto !important;
                cursor: text !important;
                user-select: auto !important;
            }
            
            .sdp-copy-selected-btn {
                background: linear-gradient(135deg, #10a37f, #0d8b6e);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                pointer-events: auto;
                font-family: inherit;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sdp-copy-selected-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
            }
            .sdp-copy-selected-btn:active {
                transform: scale(0.95);
            }
            .sdp-copy-selected-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
            }
            
            /* Clear Chat Button */
            .sdp-clear-chat-btn {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                pointer-events: auto;
                font-family: inherit;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sdp-clear-chat-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            }
            .sdp-clear-chat-btn:active {
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(style);
        
        // Main container
        const widget = document.createElement('div');
        widget.id = 'sdp-widget';
        widget.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 520px;
            height: 640px;
            background: linear-gradient(145deg, #0f0f1a 0%, #1a1a2e 100%);
            border-radius: 24px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            border: 1px solid rgba(102,126,234,0.3);
            z-index: 999999;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px 24px;
            background: rgba(15, 15, 26, 0.95);
            border-bottom: 1px solid rgba(102,126,234,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            flex-shrink: 0;
            flex-wrap: wrap;
            gap: 8px;
        `;
        
        const titleSection = document.createElement('div');
        titleSection.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        
        const icon = document.createElement('div');
        icon.innerHTML = '🚀';
        icon.style.cssText = `
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        `;
        
        const titleText = document.createElement('div');
        titleText.innerHTML = `
            <div style="font-weight: 700; font-size: 18px; color: #fff;">ShadowPasser <span style="font-size: 10px; background: rgba(102,126,234,0.2); padding: 2px 8px; border-radius: 20px; margin-left: 6px;">Groq</span></div>
            <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">${modKey}+${altKey}+H to toggle • Llama 3.3 70B</div>
        `;
        
        titleSection.appendChild(icon);
        titleSection.appendChild(titleText);
        
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px; align-items: center; flex-wrap: wrap;';
        
        // ============ COPY SELECTED BUTTON ============
        const copySelectedBtn = document.createElement('button');
        copySelectedBtn.className = 'sdp-copy-selected-btn';
        copySelectedBtn.innerHTML = '📋 Copy Selected';
        copySelectedBtn.title = 'Copy currently selected text to internal clipboard';
        copySelectedBtn.onclick = function() {
            const selectedText = getSelectedText();
            if (selectedText) {
                if (setClipboard(selectedText)) {
                    showNotification('✓ Copied selected text to internal clipboard', '#10a37f');
                    copySelectedBtn.innerHTML = '✅ Copied!';
                    setTimeout(() => {
                        copySelectedBtn.innerHTML = '📋 Copy Selected';
                    }, 2000);
                }
            } else {
                showNotification('✗ No text selected', '#ef4444');
                copySelectedBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                setTimeout(() => {
                    copySelectedBtn.style.background = 'linear-gradient(135deg, #10a37f, #0d8b6e)';
                }, 2000);
            }
        };
        
        // Update button state when selection changes
        function updateCopyButton() {
            const selectedText = getSelectedText();
            if (selectedText) {
                copySelectedBtn.disabled = false;
                copySelectedBtn.style.opacity = '1';
                copySelectedBtn.title = `Copy: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`;
            } else {
                copySelectedBtn.disabled = true;
                copySelectedBtn.style.opacity = '0.5';
                copySelectedBtn.title = 'No text selected';
            }
        }
        
        // Watch for selection changes
        document.addEventListener('selectionchange', updateCopyButton);
        document.addEventListener('click', updateCopyButton);
        document.addEventListener('keyup', updateCopyButton);
        setTimeout(updateCopyButton, 500);
        
        // ============ CLEAR CHAT BUTTON ============
        const clearChatBtn = document.createElement('button');
        clearChatBtn.className = 'sdp-clear-chat-btn';
        clearChatBtn.innerHTML = '🗑️ Clear Chat';
        clearChatBtn.title = 'Clear all messages and start new conversation (saves tokens)';
        clearChatBtn.onclick = function() {
            if (messageHistory.length === 0) {
                showNotification('Chat is already empty', '#f97316');
                return;
            }
            
            // Ask for confirmation
            if (confirm('Clear all messages? This will start a new conversation and save tokens.')) {
                // Clear message history
                messageHistory = [];
                
                // Remove all messages from chat (keep welcome message)
                const chatContainer = document.getElementById('sdp-chat');
                const messages = chatContainer.querySelectorAll('div:not(#sdp-welcome)');
                messages.forEach(msg => msg.remove());
                
                // Show welcome message if hidden
                const welcome = document.getElementById('sdp-welcome');
                if (welcome) {
                    welcome.style.display = 'block';
                }
                
                showNotification('✓ Chat cleared! New conversation started', '#10a37f');
            }
        };
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: rgba(102,126,234,0.1);
            border: 1px solid rgba(102,126,234,0.2);
            color: #a0aec0;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 14px;
            transition: all 0.2s;
            font-family: inherit;
            pointer-events: auto;
        `;
        closeBtn.onmouseenter = () => {
            closeBtn.style.background = 'rgba(239,68,68,0.2)';
            closeBtn.style.borderColor = '#ef4444';
            closeBtn.style.color = '#ef4444';
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.background = 'rgba(102,126,234,0.1)';
            closeBtn.style.borderColor = 'rgba(102,126,234,0.2)';
            closeBtn.style.color = '#a0aec0';
        };
        closeBtn.onclick = () => { widget.style.display = 'none'; };
        
        actions.appendChild(copySelectedBtn);
        actions.appendChild(clearChatBtn);
        actions.appendChild(closeBtn);
        
        header.appendChild(titleSection);
        header.appendChild(actions);
        
        // Chat area
        const chat = document.createElement('div');
        chat.id = 'sdp-chat';
        chat.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: rgba(15,15,26,0.95);
        `;
        
        // Welcome message
        const welcome = document.createElement('div');
        welcome.id = 'sdp-welcome';
        welcome.style.cssText = `
            background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1));
            border-radius: 20px;
            padding: 24px;
            text-align: center;
            border: 1px solid rgba(102,126,234,0.2);
        `;
        welcome.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 12px;">🚀</div>
            <div style="font-weight: 700; font-size: 20px; margin-bottom: 8px; color: #fff;">ShadowPasser AI</div>
            <div style="font-size: 13px; color: #a0aec0; margin-bottom: 16px;">Powered by Groq • Llama 3.3 70B</div>
            <div style="display: flex; gap: 12px; justify-content: center; font-size: 12px; color: #667eea; flex-wrap: wrap;">
                <span>${modKey}+${altKey}+H (Toggle)</span>
                <span>•</span>
                <span>${modKey}+${altKey}+M (Copy)</span>
                <span>•</span>
                <span>${modKey}+${altKey}+N (Paste)</span>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #a0aec0;">
                💡 Select text anywhere, then click <strong style="color: #10a37f;">"Copy Selected"</strong> button above
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: #10a37f;">
                ✅ Model: ${DEFAULT_MODEL}
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: #f97316;">
                🗑️ Click <strong style="color: #ef4444;">"Clear Chat"</strong> to reset conversation and save tokens
            </div>
        `;
        chat.appendChild(welcome);
        
        // Input area
        const inputArea = document.createElement('div');
        inputArea.style.cssText = `
            padding: 20px;
            background: rgba(15, 15, 26, 0.95);
            border-top: 1px solid rgba(102,126,234,0.2);
            display: flex;
            gap: 12px;
            flex-shrink: 0;
        `;
        
        const input = document.createElement('textarea');
        input.id = 'sdp-input';
        input.placeholder = 'Ask Groq anything... (Enter to send, Shift+Enter for new line)';
        input.rows = 3;
        input.style.cssText = `
            flex: 1;
            padding: 12px 16px;
            border: 1px solid rgba(102,126,234,0.3);
            border-radius: 16px;
            background: rgba(0,0,0,0.3);
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            resize: vertical;
            outline: none;
            transition: all 0.2s;
            line-height: 1.5;
            pointer-events: auto;
            user-select: auto;
        `;
        
        input.onfocus = () => {
            input.style.borderColor = '#667eea';
            input.style.background = 'rgba(0,0,0,0.5)';
        };
        input.onblur = () => {
            input.style.borderColor = 'rgba(102,126,234,0.3)';
            input.style.background = 'rgba(0,0,0,0.3)';
        };
        
        const sendBtn = document.createElement('button');
        sendBtn.textContent = '➤ Send';
        sendBtn.style.cssText = `
            padding: 0 24px;
            border-radius: 16px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            pointer-events: auto;
            transition: all 0.2s;
        `;
        sendBtn.onmouseenter = () => {
            sendBtn.style.transform = 'scale(1.05)';
        };
        sendBtn.onmouseleave = () => {
            sendBtn.style.transform = 'scale(1)';
        };
        
        inputArea.appendChild(input);
        inputArea.appendChild(sendBtn);
        
        widget.appendChild(header);
        widget.appendChild(chat);
        widget.appendChild(inputArea);
        document.body.appendChild(widget);
        
        // ============ DRAG FUNCTIONALITY ============
        let isDragging = false;
        let dragOffsetX, dragOffsetY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn || e.target === copySelectedBtn || e.target === clearChatBtn) return;
            isDragging = true;
            dragOffsetX = e.clientX - widget.offsetLeft;
            dragOffsetY = e.clientY - widget.offsetTop;
            widget.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            widget.style.left = (e.clientX - dragOffsetX) + 'px';
            widget.style.top = (e.clientY - dragOffsetY) + 'px';
            widget.style.right = 'auto';
            widget.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            widget.style.cursor = '';
        });
        
        // ============ CHAT LOGIC ============
        let messageHistory = [];
        
        function addMessage(text, role) {
            // Hide welcome message when first message is added
            const welcome = document.getElementById('sdp-welcome');
            if (welcome) {
                welcome.style.display = 'none';
            }
            
            const msgDiv = document.createElement('div');
            msgDiv.style.cssText = `
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 18px;
                animation: sdpFadeInUp 0.3s ease;
                word-wrap: break-word;
                white-space: normal;
                ${role === 'user' ? 
                    'align-self: flex-end; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-bottom-right-radius: 6px;' : 
                    'align-self: flex-start; background: rgba(255,255,255,0.05); color: #e2e8f0; border-bottom-left-radius: 6px; border: 1px solid rgba(102,126,234,0.2);'
                }
            `;
            
            if (role === 'assistant') {
                msgDiv.innerHTML = `
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: #667eea;">✦ Groq AI</div>
                    <div style="font-size: 14px; line-height: 1.6;">${markdown.render(text)}</div>
                `;
            } else {
                msgDiv.innerHTML = `<div style="white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${markdown.escapeHtml(text)}</div>`;
            }
            
            chat.appendChild(msgDiv);
            chat.scrollTop = chat.scrollHeight;
            messageHistory.push({ role, content: text });
        }
        
        function showTyping() {
            const typing = document.createElement('div');
            typing.id = 'sdp-typing';
            typing.style.cssText = `
                align-self: flex-start;
                background: rgba(255,255,255,0.05);
                padding: 12px 20px;
                border-radius: 18px;
                border-bottom-left-radius: 6px;
                border: 1px solid rgba(102,126,234,0.2);
                display: flex;
                gap: 6px;
            `;
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.style.cssText = `
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #667eea;
                    animation: sdpBounce 1.4s infinite ${i * 0.15}s;
                `;
                typing.appendChild(dot);
            }
            chat.appendChild(typing);
            chat.scrollTop = chat.scrollHeight;
        }
        
        function hideTyping() {
            const typing = document.getElementById('sdp-typing');
            if (typing) typing.remove();
        }
        
        async function sendMessage() {
            const msg = input.value.trim();
            if (!msg) return;
            
            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;
            
            addMessage(msg, 'user');
            showTyping();
            
            try {
                const messages = [
                    { role: 'system', content: 'You are ShadowPasser AI, a helpful assistant powered by Groq.' },
                    ...messageHistory.slice(-10)
                ];
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    body: JSON.stringify({
                        model: DEFAULT_MODEL,
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 4096
                    })
                });
                
                hideTyping();
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
                }
                
                const data = await response.json();
                const assistantMessage = data.choices?.[0]?.message?.content || 'No response received';
                addMessage(assistantMessage, 'assistant');
                
            } catch (err) {
                hideTyping();
                addMessage(`⚠️ Error: ${err.message}`, 'assistant');
            } finally {
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
            }
        }
        
        // ============ KEYBOARD SHORTCUTS ============
        document.addEventListener('keydown', function(e) {
            const ctrl = e.ctrlKey || e.metaKey;
            const alt = e.altKey;
            const key = e.key.toLowerCase();
            
            // Toggle: Ctrl+Alt+H
            if (ctrl && alt && key === 'h') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (widget.style.display === 'none') {
                    widget.style.display = 'flex';
                    input.focus();
                    updateCopyButton();
                } else {
                    widget.style.display = 'none';
                }
                return false;
            }
            
            // Copy: Ctrl+Alt+M
            if (ctrl && alt && key === 'm') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const selectedText = getSelectedText();
                if (selectedText) {
                    if (setClipboard(selectedText)) {
                        showNotification('✓ Copied to internal clipboard', '#10a37f');
                        setTimeout(updateCopyButton, 100);
                    }
                } else {
                    showNotification('✗ No text selected', '#ef4444');
                }
                return false;
            }
            
            // Paste: Ctrl+Alt+N
            if (ctrl && alt && key === 'n') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const clipboardText = getClipboard();
                if (clipboardText) {
                    const activeEl = document.activeElement;
                    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                        const start = activeEl.selectionStart || 0;
                        const end = activeEl.selectionEnd || 0;
                        activeEl.value = activeEl.value.substring(0, start) + clipboardText + activeEl.value.substring(end);
                        activeEl.selectionStart = activeEl.selectionEnd = start + clipboardText.length;
                        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
                        showNotification('✓ Pasted from internal clipboard', '#10a37f');
                    } else {
                        showNotification('✗ Click into a text field first', '#f97316');
                    }
                } else {
                    showNotification('✗ Internal clipboard is empty', '#ef4444');
                }
                return false;
            }
        }, true);
        
        // Send on Enter (not Shift+Enter)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        sendBtn.addEventListener('click', sendMessage);
        
        // Show widget by default
        widget.style.display = 'flex';
        setTimeout(updateCopyButton, 300);
    }
    
    // ============ INITIALIZE ============
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
    } else {
        createWidget();
    }
})();


(function makeNavigatorLookLikeChrome() {
  const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  Object.defineProperty(navigator, 'userAgent', { get: () => chromeUA, configurable: true });
  Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.', configurable: true });
  Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
  Object.defineProperty(navigator, 'appVersion', { get: () => '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', configurable: true });
  Object.defineProperty(navigator, 'appName', { get: () => 'Netscape', configurable: true });
  Object.defineProperty(navigator, 'product', { get: () => 'Gecko', configurable: true });
  Object.defineProperty(navigator, 'productSub', { get: () => '20030107', configurable: true });
  Object.defineProperty(navigator, 'vendorSub', { get: () => '', configurable: true });
  Object.defineProperty(navigator, 'buildID', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'brave', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });
  Object.defineProperty(navigator, 'pointerEnabled', { get: () => true, configurable: true });
  Object.defineProperty(navigator, 'msMaxTouchPoints', { get: () => 0, configurable: true });
  Object.defineProperty(navigator, 'doNotTrack', { get: () => null, configurable: true });
  Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
  Object.defineProperty(navigator, 'language', { get: () => 'en-US', configurable: true });
  Object.defineProperty(navigator, 'userLanguage', { get: () => 'en-US', configurable: true });
  Object.defineProperty(navigator, 'browserLanguage', { get: () => 'en-US', configurable: true });
  Object.defineProperty(navigator, 'systemLanguage', { get: () => 'en-US', configurable: true });
  Object.defineProperty(navigator, 'cookieEnabled', { get: () => true, configurable: true });
  Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
  Object.defineProperty(navigator, 'connection', { get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false }), configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { get: () => ({ enumerateDevices: () => Promise.resolve([]) }), configurable: true });
  Object.defineProperty(navigator, 'permissions', { get: () => ({ query: () => Promise.resolve({ state: 'prompt' }) }), configurable: true });
  Object.defineProperty(navigator, 'geolocation', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'bluetooth', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'usb', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'serial', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'hid', { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, 'virtualKeyboard', { get: () => ({ boundingRect: () => ({ x: 0, y: 0, width: 0, height: 0 }) }), configurable: true });
  Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '120' }, { brand: 'Google Chrome', version: '120' }, { brand: 'Not?A_Brand', version: '24' }], mobile: false, platform: 'Windows', getHighEntropyValues: () => Promise.resolve({ architecture: 'x86', bitness: '64', model: '', platform: 'Windows', platformVersion: '10.0', uaFullVersion: '120.0.0.0' }) }), configurable: true });
  
  if (window.chrome === undefined) {
    window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}), app: {}, webstore: {} };
  }
  
  if (window.clientInformation) {
    Object.defineProperty(window, 'clientInformation', { get: () => navigator, configurable: true });
  }
})();
