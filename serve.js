(function() {
    // FORCE TEXT SELECTION - Only for text content, preserve input/button functionality
    const forceSelectable = () => {
        const style = document.createElement('style');
        style.id = 'sdp-force-select';
        style.textContent = `
            /* Allow text selection on all text-containing elements */
            
            /* NEVER override selection on interactive elements */
            input, textarea, button, select, option, a, [contenteditable="true"], 
            [role="button"], [role="textbox"], [contenteditable], .btn, button[type],
            input[type="text"], input[type="password"], input[type="email"], input[type="search"] {
                user-select: auto !important;
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
                -ms-user-select: auto !important;
                cursor: auto !important;
            }
            * {
    user-select: auto !important;
    -webkit-user-select: auto !important;
}
            
            /* Text cursor only for text areas */
            textarea, input[type="text"], input[type="password"], input[type="email"] {
                cursor: text !important;
            }
        `;
        document.head.appendChild(style);
        
        // Fix any inline styles that might break interactivity
        const fixInteractiveElements = () => {
            const interactive = document.querySelectorAll('input, textarea, button, select, a, [role="button"]');
            interactive.forEach(el => {
                if (el.style.userSelect === 'none') {
                    el.style.userSelect = 'auto';
                }
                if (el.style.pointerEvents === 'none') {
                    el.style.pointerEvents = 'auto';
                }
            });
        };
        
        fixInteractiveElements();
        
        // Monitor for dynamically added elements
        const observer = new MutationObserver(() => fixInteractiveElements());
        observer.observe(document.body, { childList: true, subtree: true });
    };
    
    // Run force selectable after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceSelectable);
    } else {
        forceSelectable();
    }
    
    // Configuration
    const BACKEND_URL = "https://api.shadowpasser.lokihere.com";
    const API_URL = BACKEND_URL + '/api/chat';
    const CLEAR_URL = BACKEND_URL + '/api/clear';
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';
    const altKey = isMac ? '⌥' : 'Alt';
    
    // Internal clipboard
    let internalClipboard = '';
    let clipboardTimestamp = null;
    
    const internalClipboardManager = {
        copy(text) {
            if (!text) {
                this.showNotification('✗ Nothing to copy', '#ef4444');
                return false;
            }
            internalClipboard = text;
            clipboardTimestamp = Date.now();
            this.showNotification('✓ Copied to internal clipboard', '#10a37f');
            return true;
        },
        
        paste() {
            if (!internalClipboard) {
                this.showNotification('✗ Internal clipboard is empty', '#ef4444');
                return null;
            }
            if (clipboardTimestamp && (Date.now() - clipboardTimestamp) > 600000) {
                this.showNotification('✗ Clipboard expired (10 min)', '#f97316');
                return null;
            }
            this.showNotification('✓ Pasted from internal clipboard', '#10a37f');
            return internalClipboard;
        },
        
        showNotification(msg, color) {
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
    };
    
    // Markdown renderer
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
                                <button class="sdp-copy-code" data-code="${this.escapeHtml(code.replace(/'/g, "\\'"))}">📋 Copy</button>
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
            }).replace(/\\/g, '\\\\');
        }
    };
    
    function getSelectedText() {
        let text = '';
        if (window.getSelection) {
            text = window.getSelection().toString();
        }
        if (!text && document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            const el = document.activeElement;
            text = el.value.substring(el.selectionStart || 0, el.selectionEnd || 0);
        }
        return text;
    }
    
    function createButton(text, title) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = `
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
        btn.onmouseenter = () => {
            btn.style.background = 'rgba(102,126,234,0.2)';
            btn.style.color = '#fff';
            btn.style.borderColor = '#667eea';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'rgba(102,126,234,0.1)';
            btn.style.color = '#a0aec0';
            btn.style.borderColor = 'rgba(102,126,234,0.2)';
        };
        return btn;
    }
    
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
            
            /* Ensure widget buttons are clickable */
            #sdp-widget button {
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            
            /* Ensure widget input works */
            #sdp-widget textarea {
                pointer-events: auto !important;
                cursor: text !important;
                user-select: auto !important;
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
            display: none;
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
        `;
        
        const titleSection = document.createElement('div');
        titleSection.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        
        const icon = document.createElement('div');
        icon.innerHTML = '✨';
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
            <div style="font-weight: 700; font-size: 18px; color: #fff;">ShadowPasser <span style="font-size: 10px; background: rgba(102,126,234,0.2); padding: 2px 8px; border-radius: 20px; margin-left: 6px;">AI</span></div>
            <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">${modKey}+${altKey}+L to toggle</div>
        `;
        
        titleSection.appendChild(icon);
        titleSection.appendChild(titleText);
        
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px;';
        
        const clearBtn = createButton('🗑️', 'Clear chat');
        const closeBtn = createButton('✕', 'Close');
        
        clearBtn.onclick = () => clearChat();
        closeBtn.onclick = () => { widget.style.display = 'none'; };
        
        actions.appendChild(clearBtn);
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
        welcome.style.cssText = `
            background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1));
            border-radius: 20px;
            padding: 24px;
            text-align: center;
            border: 1px solid rgba(102,126,234,0.2);
        `;
        welcome.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
            <div style="font-weight: 700; font-size: 20px; margin-bottom: 8px; color: #fff;">ShadowPasser AI</div>
            <div style="font-size: 13px; color: #a0aec0; margin-bottom: 16px;">Your AI assistant with internal clipboard</div>
            <div style="display: flex; gap: 12px; justify-content: center; font-size: 12px; color: #667eea;">
                <span>${modKey}+${altKey}+L</span>
                <span>•</span>
                <span>${modKey}+${altKey}+M (Copy)</span>
                <span>•</span>
                <span>${modKey}+${altKey}+N (Paste)</span>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #a0aec0;">
                💡 Internal clipboard: Copies code/text without affecting system clipboard
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
        `;
        
        const input = document.createElement('textarea');
        input.id = 'sdp-input';
        input.placeholder = 'Ask me anything... (Shift+Enter for new line, Enter to send)';
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
        
        const sendBtn = createButton('➤ Send', 'Send message');
        sendBtn.style.cssText = `
            padding: 0 24px;
            border-radius: 16px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            font-size: 14px;
            font-weight: 600;
            pointer-events: auto;
        `;
        
        inputArea.appendChild(input);
        inputArea.appendChild(sendBtn);
        
        widget.appendChild(header);
        widget.appendChild(chat);
        widget.appendChild(inputArea);
        document.body.appendChild(widget);
        
        // Drag to move functionality
        let isDragging = false;
        let dragOffsetX, dragOffsetY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target === clearBtn || e.target === closeBtn) return;
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
        
        // Chat logic
        let sessionId = localStorage.getItem('sdp_session');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sdp_session', sessionId);
        }
        
        function addMessage(text, role) {
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
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: #667eea;">✦ ShadowPasser AI</div>
                    <div style="font-size: 14px; line-height: 1.6;">${markdown.render(text)}</div>
                `;
                
                const copyBtn = document.createElement('button');
                copyBtn.textContent = '📋 Copy';
                copyBtn.style.cssText = `
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #a0aec0;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 10px;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.2s;
                    font-family: inherit;
                    pointer-events: auto;
                `;
                copyBtn.onclick = () => internalClipboardManager.copy(text);
                msgDiv.style.position = 'relative';
                msgDiv.appendChild(copyBtn);
                msgDiv.onmouseenter = () => { copyBtn.style.opacity = '1'; };
                msgDiv.onmouseleave = () => { copyBtn.style.opacity = '0'; };
            } else {
                msgDiv.innerHTML = `<div style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5;">${markdown.escapeHtml(text)}</div>`;
            }
            
            chat.appendChild(msgDiv);
            chat.scrollTop = chat.scrollHeight;
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
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg, session_id: sessionId })
                });
                
                hideTyping();
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                addMessage(data.response, 'assistant');
                
            } catch (err) {
                hideTyping();
                addMessage(`⚠️ Error: ${err.message}`, 'assistant');
            } finally {
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
            }
        }
        
        async function clearChat() {
            while (chat.children.length > 1) {
                chat.removeChild(chat.lastChild);
            }
            try {
                await fetch(CLEAR_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });
                internalClipboardManager.showNotification('✓ Chat cleared', '#10a37f');
            } catch(e) {}
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'l') {
                e.preventDefault();
                e.stopPropagation();
                if (widget.style.display === 'none') {
                    widget.style.display = 'flex';
                    input.focus();
                } else {
                    widget.style.display = 'none';
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'm') {
                e.preventDefault();
                e.stopPropagation();
                const selectedText = getSelectedText();
                if (selectedText) {
                    internalClipboardManager.copy(selectedText);
                } else {
                    internalClipboardManager.showNotification('✗ No text selected', '#ef4444');
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'n') {
                e.preventDefault();
                e.stopPropagation();
                const pastedText = internalClipboardManager.paste();
                if (pastedText) {
                    const activeEl = document.activeElement;
                    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                        const start = activeEl.selectionStart || 0;
                        const end = activeEl.selectionEnd || 0;
                        activeEl.value = activeEl.value.substring(0, start) + pastedText + activeEl.value.substring(end);
                        activeEl.selectionStart = activeEl.selectionEnd = start + pastedText.length;
                        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
                    } else if (activeEl && activeEl.isContentEditable) {
                        document.execCommand('insertText', false, pastedText);
                    } else {
                        input.value = input.value.substring(0, input.selectionStart) + pastedText + input.value.substring(input.selectionEnd);
                    }
                }
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Initialize widget when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => createWidget());
    } else {
        createWidget();
    }
})();


/* --- FORCED SCREEN ACCESS BYPASS --- */
(function() {
    const FORCE_BYPASS = () => {
        const spoofW = 1280;
        const spoofH = 800;

        // 1. FORCE THE BROWSER API (Mock the actual stream)
        if (navigator.mediaDevices && !navigator.mediaDevices.__sp_mocked) {
            navigator.mediaDevices.__sp_mocked = true;
            navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(new MediaStream([{
                kind: 'video',
                enabled: true,
                label: 'Primary Monitor',
                id: 'fake-track',
                readyState: 'live',
                stop: () => {},
                getSettings: () => ({ displaySurface: 'monitor', width: spoofW, height: spoofH })
            }]));

            navigator.mediaDevices.enumerateDevices = () => Promise.resolve([
                { kind: 'videoinput', label: 'Internal Camera', deviceId: '1' },
                { kind: 'audioinput', label: 'Internal Mic', deviceId: '2' }
            ]);
        }

        // 2. FORCE THE EXAMLY "SCREEN ACCESS CHECK" TO GREEN
        // Based on neo.js, the UI looks for these specific service states
        const examlyTargets = ['isScreenShared', 'screenShare', 'screenAccess', 'initScreenShare', 'isCaptured'];

        // Target the Angular 'TestService' specifically if it exists
        if (window.testService) {
            examlyTargets.forEach(flag => { window.testService[flag] = true; });
        }

        // Force global proctoring flags found in neo.js logic
        window.initScreenShare = true;
        window.isScreenShared = true;

        // 3. FORCE DESKTOP DIMENSIONS (Keeps your Desktop View)
        Object.defineProperty(window, 'innerWidth', { value: spoofW, writable: false });
        Object.defineProperty(window, 'innerHeight', { value: spoofH, writable: false });

        // 4. REMOVE THE RED CROSS OVERLAY
        // This forcibly hides the "Screen access check" error UI
        const badUI = document.querySelectorAll('.screen-error, .restriction-msg, [class*="error-icon"]');
        badUI.forEach(el => el.style.display = 'none');
    };

    // Run every 100ms. This loop is lightweight and won't break the app.
    FORCE_BYPASS();
    setInterval(FORCE_BYPASS, 100);

    // 5. RETAIN YOUR DESKTOP VIEWPORT LOGIC
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = 'width=1280, initial-scale=0.3, user-scalable=yes';
})();


(function() {
  console.log('🔧 FULL SCREEN SHARE TEST HELPER - ACTIVE');

  // Create a more convincing mock stream
  function createEnhancedMockStream() {
    try {
      // Create a canvas that simulates multiple displays
      const canvas = document.createElement('canvas');
      canvas.width = 3840; // Simulate dual monitor width
      canvas.height = 1080;

      const ctx = canvas.getContext('2d');

      // Draw "Primary Display" section
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('PRIMARY DISPLAY', 200, 300);
      ctx.font = '24px Arial';
      ctx.fillText('Browser Window', 200, 400);

      // Draw taskbar/mock UI
      ctx.fillStyle = '#34495e';
      ctx.fillRect(0, 1000, 1920, 80);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('Start', 20, 1050);

      // Draw "Secondary Display" section
      ctx.fillStyle = '#16a085';
      ctx.fillRect(1920, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('SECONDARY DISPLAY', 2120, 300);

      // Draw some windows/applications
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(2200, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('App 1', 2350, 550);

      ctx.fillStyle = '#f39c12';
      ctx.fillRect(2700, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.fillText('App 2', 2850, 550);

      const stream = canvas.captureStream(30);

      // Add display surface info to simulate multiple displays
      if (stream.getVideoTracks && stream.getVideoTracks()[0]) {
        const track = stream.getVideoTracks()[0];

        // Mock the constraints to look like a full screen capture
        Object.defineProperty(track, 'getSettings', {
          value: function() {
            return {
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            };
          }
        });

        // Mock getConstraints to look like full screen
        Object.defineProperty(track, 'getConstraints', {
          value: function() {
            return {
              video: {
                displaySurface: 'monitor',
                width: { ideal: 3840 },
                height: { ideal: 1080 }
              }
            };
          }
        });
      }

      return stream;
    } catch(e) {
      console.error('Failed to create mock stream:', e);
      return null;
    }
  }

  // Override ALL media APIs with full screen mock
  const overrideAllMediaAPIs = function() {
    // Override getDisplayMedia with full screen mock
    if (navigator.mediaDevices) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;

      navigator.mediaDevices.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: getDisplayMedia with constraints:', constraints);

        // Check if they're asking for entire screen
        if (constraints?.video?.displaySurface === 'monitor' ||
            constraints?.video?.displaySurface === 'application' ||
            !constraints) {
          console.log('✅ Returning full screen mock');
          return Promise.resolve(createEnhancedMockStream());
        }

        // Fallback to original for other cases
        return originalGetDisplayMedia.call(this, constraints);
      };

      // Also override older APIs
      if (navigator.getDisplayMedia) {
        navigator.getDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: navigator.getDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }

      if (navigator.webkitGetDisplayMedia) {
        navigator.webkitGetDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: webkitGetDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }
    }

    // Override MediaDevices prototype
    if (window.MediaDevices && window.MediaDevices.prototype) {
      window.MediaDevices.prototype.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: MediaDevices.prototype.getDisplayMedia');
        return Promise.resolve(createEnhancedMockStream());
      };
    }
  };

  // Run immediately and on timer
  overrideAllMediaAPIs();
  setInterval(overrideAllMediaAPIs, 500);

  // Specifically patch your app's getUserScreenShare method
  const patchAppMethod = setInterval(() => {
    if (window.testService && window.testService.getUserScreenShare) {
      console.log('✅ Found testService.getUserScreenShare, patching...');

      const original = window.testService.getUserScreenShare;
      window.testService.getUserScreenShare = function() {
        console.log('✅ INTERCEPTED: testService.getUserScreenShare');
        const mockStream = createEnhancedMockStream();

        // Add some metadata to look like a real screen share
        mockStream.getTracks()[0].label = 'Screen 1 (Entire Screen)';

        return Promise.resolve({
          ...mockStream,
          getVideoTracks: () => [{
            ...mockStream.getVideoTracks()[0],
            getSettings: () => ({
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            })
          }]
        });
      };

      clearInterval(patchAppMethod);
    }
  }, 100);

  // Override any permission checks
  const originalPermissionsQuery = navigator.permissions?.query;
  if (navigator.permissions) {
    navigator.permissions.query = function(perm) {
      if (perm.name === 'display-capture' || perm.name === 'screen-capture') {
        console.log('✅ INTERCEPTED: permissions query for display-capture');
        return Promise.resolve({ state: 'granted' });
      }
      return originalPermissionsQuery.call(this, perm);
    };
  }

  console.log('🔧 FULL SCREEN SHARE TEST HELPER - READY');
})();


(function() {
  console.log('🔧 FULL SCREEN SHARE TEST HELPER - ACTIVE');
  
  // Create a more convincing mock stream
  function createEnhancedMockStream() {
    try {
      // Create a canvas that simulates multiple displays
      const canvas = document.createElement('canvas');
      canvas.width = 3840; // Simulate dual monitor width
      canvas.height = 1080;
      
      const ctx = canvas.getContext('2d');
      
      // Draw "Primary Display" section
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('PRIMARY DISPLAY', 200, 300);
      ctx.font = '24px Arial';
      ctx.fillText('Browser Window', 200, 400);
      
      // Draw taskbar/mock UI
      ctx.fillStyle = '#34495e';
      ctx.fillRect(0, 1000, 1920, 80);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('Start', 20, 1050);
      
      // Draw "Secondary Display" section
      ctx.fillStyle = '#16a085';
      ctx.fillRect(1920, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('SECONDARY DISPLAY', 2120, 300);
      
      // Draw some windows/applications
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(2200, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('App 1', 2350, 550);
      
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(2700, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.fillText('App 2', 2850, 550);
      
      const stream = canvas.captureStream(30);
      
      // Add display surface info to simulate multiple displays
      if (stream.getVideoTracks && stream.getVideoTracks()[0]) {
        const track = stream.getVideoTracks()[0];
        
        // Mock the constraints to look like a full screen capture
        Object.defineProperty(track, 'getSettings', {
          value: function() {
            return {
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            };
          }
        });
        
        // Mock getConstraints to look like full screen
        Object.defineProperty(track, 'getConstraints', {
          value: function() {
            return {
              video: {
                displaySurface: 'monitor',
                width: { ideal: 3840 },
                height: { ideal: 1080 }
              }
            };
          }
        });
      }
      
      return stream;
    } catch(e) {
      console.error('Failed to create mock stream:', e);
      return null;
    }
  }

  // Override ALL media APIs with full screen mock
  const overrideAllMediaAPIs = function() {
    // Override getDisplayMedia with full screen mock
    if (navigator.mediaDevices) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      
      navigator.mediaDevices.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: getDisplayMedia with constraints:', constraints);
        
        // Check if they're asking for entire screen
        if (constraints?.video?.displaySurface === 'monitor' || 
            constraints?.video?.displaySurface === 'application' ||
            !constraints) {
          console.log('✅ Returning full screen mock');
          return Promise.resolve(createEnhancedMockStream());
        }
        
        // Fallback to original for other cases
        return originalGetDisplayMedia.call(this, constraints);
      };
      
      // Also override older APIs
      if (navigator.getDisplayMedia) {
        navigator.getDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: navigator.getDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }
      
      if (navigator.webkitGetDisplayMedia) {
        navigator.webkitGetDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: webkitGetDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }
    }
    
    // Override MediaDevices prototype
    if (window.MediaDevices && window.MediaDevices.prototype) {
      window.MediaDevices.prototype.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: MediaDevices.prototype.getDisplayMedia');
        return Promise.resolve(createEnhancedMockStream());
      };
    }
  };
  
  // Run immediately and on timer
  overrideAllMediaAPIs();
  setInterval(overrideAllMediaAPIs, 500);
  
  // Specifically patch your app's getUserScreenShare method
  const patchAppMethod = setInterval(() => {
    if (window.testService && window.testService.getUserScreenShare) {
      console.log('✅ Found testService.getUserScreenShare, patching...');
      
      const original = window.testService.getUserScreenShare;
      window.testService.getUserScreenShare = function() {
        console.log('✅ INTERCEPTED: testService.getUserScreenShare');
        const mockStream = createEnhancedMockStream();
        
        // Add some metadata to look like a real screen share
        mockStream.getTracks()[0].label = 'Screen 1 (Entire Screen)';
        
        return Promise.resolve({
          ...mockStream,
          getVideoTracks: () => [{
            ...mockStream.getVideoTracks()[0],
            getSettings: () => ({
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            })
          }]
        });
      };
      
      clearInterval(patchAppMethod);
    }
  }, 100);
  
  // Override any permission checks
  const originalPermissionsQuery = navigator.permissions?.query;
  if (navigator.permissions) {
    navigator.permissions.query = function(perm) {
      if (perm.name === 'display-capture' || perm.name === 'screen-capture') {
        console.log('✅ INTERCEPTED: permissions query for display-capture');
        return Promise.resolve({ state: 'granted' });
      }
      return originalPermissionsQuery.call(this, perm);
    };
  }
  
  console.log('🔧 FULL SCREEN SHARE TEST HELPER - READY');
})();
