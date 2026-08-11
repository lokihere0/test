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
    
    // ============ CHAT STORAGE SYSTEM ============
    const STORAGE_KEY = 'shadowpasser_chat_history';
    const CHAT_ID_KEY = 'shadowpasser_chat_id';
    const MAX_HISTORY = 50; // Maximum messages to store per chat
    
    // Generate a random chat ID
    function generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Get or create chat ID
    function getChatId() {
        let chatId = localStorage.getItem(CHAT_ID_KEY);
        if (!chatId) {
            chatId = generateChatId();
            localStorage.setItem(CHAT_ID_KEY, chatId);
        }
        return chatId;
    }
    
    // Save chat history
    function saveChatHistory(chatId, messages) {
        try {
            const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            // Keep only last MAX_HISTORY messages
            const trimmedMessages = messages.slice(-MAX_HISTORY);
            allHistory[chatId] = {
                messages: trimmedMessages,
                updatedAt: Date.now(),
                chatId: chatId
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }
    
    // Load chat history
    function loadChatHistory(chatId) {
        try {
            const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            const chatData = allHistory[chatId];
            if (chatData && chatData.messages) {
                return chatData.messages;
            }
            return [];
        } catch (e) {
            console.error('Failed to load chat history:', e);
            return [];
        }
    }
    
    // Clear chat history for current chat
    function clearChatHistory(chatId) {
        try {
            const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            delete allHistory[chatId];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
        } catch (e) {
            console.error('Failed to clear chat history:', e);
        }
    }
    
    // Clean old chats (older than 7 days)
    function cleanOldChats() {
        try {
            const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            let cleaned = false;
            
            for (const [chatId, data] of Object.entries(allHistory)) {
                if (now - data.updatedAt > sevenDays) {
                    delete allHistory[chatId];
                    cleaned = true;
                }
            }
            
            if (cleaned) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
                console.log('[✓] Cleaned old chat histories');
            }
        } catch (e) {
            console.error('Failed to clean old chats:', e);
        }
    }
    
    // ============ CONFIGURATION ============
    // Configuration - Groq API
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    
    // ⚠️ GET YOUR API KEY FROM: https://console.groq.com/keys
    const API_KEY = "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"; // <-- PASTE YOUR GROQ API KEY HERE
    
    // Available Groq models:
    const DEFAULT_MODEL = "llama-3.3-70b-versatile";
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';
    const altKey = isMac ? '⌥' : 'Alt';
    
    // Internal clipboard
    let internalClipboard = '';
    let clipboardTimestamp = null;
    
    const internalClipboardManager = {
        copy(text) {
            console.log('[Clipboard] Copy called with:', text);
            if (!text) {
                this.showNotification('✗ Nothing to copy', '#ef4444');
                return false;
            }
            internalClipboard = text;
            clipboardTimestamp = Date.now();
            this.showNotification('✓ Copied to internal clipboard', '#10a37f');
            console.log('[Clipboard] Copied:', text.substring(0, 50) + '...');
            return true;
        },
        
        paste() {
            console.log('[Clipboard] Paste called, clipboard has:', internalClipboard ? 'yes' : 'no');
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
        
        // Try to get selected text from the page
        if (window.getSelection) {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
                text = selection.toString().trim();
                console.log('[Selection] Got from window.getSelection:', text.substring(0, 50) + '...');
            }
        }
        
        // If no text, check if it's from input/textarea
        if (!text && document.activeElement) {
            const el = document.activeElement;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                const start = el.selectionStart || 0;
                const end = el.selectionEnd || 0;
                if (start !== end) {
                    text = el.value.substring(start, end);
                    console.log('[Selection] Got from input/textarea:', text.substring(0, 50) + '...');
                }
            }
        }
        
        console.log('[Selection] Final text length:', text.length);
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
        
        // Clean old chats on startup
        cleanOldChats();
        
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
            
            /* Chat ID display */
            .sdp-chat-id {
                font-size: 9px;
                color: rgba(255,255,255,0.2);
                font-family: monospace;
                padding: 2px 8px;
                background: rgba(0,0,0,0.2);
                border-radius: 10px;
                margin-top: 4px;
                display: inline-block;
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
        titleSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-wrap: wrap;';
        
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
        const chatId = getChatId();
        const shortId = chatId.slice(-8);
        titleText.innerHTML = `
            <div style="font-weight: 700; font-size: 18px; color: #fff;">ShadowPasser <span style="font-size: 10px; background: rgba(102,126,234,0.2); padding: 2px 8px; border-radius: 20px; margin-left: 6px;">Groq</span></div>
            <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">${modKey}+${altKey}+L to toggle • Mixtral 8x7B</div>
            <div class="sdp-chat-id">ID: ${shortId}</div>
        `;
        
        titleSection.appendChild(icon);
        titleSection.appendChild(titleText);
        
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
        
        const newChatBtn = createButton('🔄 New', 'Start new chat');
        const clearBtn = createButton('🗑️', 'Clear chat');
        const closeBtn = createButton('✕', 'Close');
        
        newChatBtn.onclick = () => startNewChat();
        clearBtn.onclick = () => clearChat();
        closeBtn.onclick = () => { widget.style.display = 'none'; };
        
        actions.appendChild(newChatBtn);
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
        
        // Welcome message (will be replaced if history exists)
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
            <div style="font-size: 13px; color: #a0aec0; margin-bottom: 16px;">Powered by Groq • Mixtral 8x7B</div>
            <div style="display: flex; gap: 12px; justify-content: center; font-size: 12px; color: #667eea;">
                <span>${modKey}+${altKey}+L</span>
                <span>•</span>
                <span>${modKey}+${altKey}+M (Copy)</span>
                <span>•</span>
                <span>${modKey}+${altKey}+N (Paste)</span>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #a0aec0;">
                💡 Chat history is saved automatically
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: #10a37f;">
                ✅ Model: mixtral-8x7b-32768
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: rgba(255,255,255,0.2);">
                Chat ID: ${chatId}
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
        input.placeholder = 'Ask Groq anything... (Shift+Enter for new line, Enter to send)';
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
            if (e.target === clearBtn || e.target === closeBtn || e.target === newChatBtn) return;
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
        
        // ============ CHAT LOGIC WITH PERSISTENCE ============
        let currentChatId = getChatId();
        let messageHistory = loadChatHistory(currentChatId);
        
        function renderMessages() {
            // Remove all messages except welcome
            while (chat.children.length > 1) {
                chat.removeChild(chat.lastChild);
            }
            
            // Render saved messages
            messageHistory.forEach(msg => {
                const msgDiv = createMessageElement(msg.content, msg.role);
                chat.appendChild(msgDiv);
            });
            
            // Update welcome message if there are messages
            const welcomeEl = document.getElementById('sdp-welcome');
            if (welcomeEl && messageHistory.length > 0) {
                welcomeEl.style.display = 'none';
            } else if (welcomeEl) {
                welcomeEl.style.display = 'block';
            }
            
            chat.scrollTop = chat.scrollHeight;
        }
        
        function createMessageElement(text, role) {
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
                const timestamp = new Date().toLocaleTimeString();
                msgDiv.innerHTML = `
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: #667eea;">✦ Groq AI <span style="color: rgba(255,255,255,0.2); font-weight: normal; font-size: 9px;">${timestamp}</span></div>
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
            
            return msgDiv;
        }
        
        function addMessage(text, role) {
            const msgDiv = createMessageElement(text, role);
            chat.appendChild(msgDiv);
            chat.scrollTop = chat.scrollHeight;
            
            // Store in history
            messageHistory.push({ role, content: text });
            
            // Save to localStorage
            saveChatHistory(currentChatId, messageHistory);
            
            // Hide welcome message if there are messages
            const welcomeEl = document.getElementById('sdp-welcome');
            if (welcomeEl) {
                welcomeEl.style.display = 'none';
            }
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
        
        function startNewChat() {
            // Generate new chat ID
            currentChatId = generateChatId();
            localStorage.setItem(CHAT_ID_KEY, currentChatId);
            
            // Clear message history
            messageHistory = [];
            
            // Clear the chat display
            while (chat.children.length > 1) {
                chat.removeChild(chat.lastChild);
            }
            
            // Show welcome message
            const welcomeEl = document.getElementById('sdp-welcome');
            if (welcomeEl) {
                welcomeEl.style.display = 'block';
                const shortId = currentChatId.slice(-8);
                welcomeEl.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 12px;">🚀</div>
                    <div style="font-weight: 700; font-size: 20px; margin-bottom: 8px; color: #fff;">New Chat Started</div>
                    <div style="font-size: 13px; color: #a0aec0; margin-bottom: 16px;">Powered by Groq • Mixtral 8x7B</div>
                    <div style="display: flex; gap: 12px; justify-content: center; font-size: 12px; color: #667eea;">
                        <span>${modKey}+${altKey}+L</span>
                        <span>•</span>
                        <span>${modKey}+${altKey}+M (Copy)</span>
                        <span>•</span>
                        <span>${modKey}+${altKey}+N (Paste)</span>
                    </div>
                    <div style="margin-top: 12px; font-size: 11px; color: #a0aec0;">
                        💡 Chat history is saved automatically
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; color: #10a37f;">
                        ✅ Chat ID: ${shortId}
                    </div>
                `;
            }
            
            // Update title
            const shortId = currentChatId.slice(-8);
            const titleDiv = titleSection.querySelector('.sdp-chat-id');
            if (titleDiv) {
                titleDiv.textContent = `ID: ${shortId}`;
            }
            
            internalClipboardManager.showNotification('✓ New chat started', '#10a37f');
            input.focus();
        }
        
        async function clearChat() {
            // Clear message history
            messageHistory = [];
            clearChatHistory(currentChatId);
            
            // Clear the chat display
            while (chat.children.length > 1) {
                chat.removeChild(chat.lastChild);
            }
            
            // Show welcome message
            const welcomeEl = document.getElementById('sdp-welcome');
            if (welcomeEl) {
                welcomeEl.style.display = 'block';
                const shortId = currentChatId.slice(-8);
                welcomeEl.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 12px;">🚀</div>
                    <div style="font-weight: 700; font-size: 20px; margin-bottom: 8px; color: #fff;">Chat Cleared</div>
                    <div style="font-size: 13px; color: #a0aec0; margin-bottom: 16px;">Start a new conversation</div>
                    <div style="display: flex; gap: 12px; justify-content: center; font-size: 12px; color: #667eea;">
                        <span>${modKey}+${altKey}+L</span>
                        <span>•</span>
                        <span>${modKey}+${altKey}+M (Copy)</span>
                        <span>•</span>
                        <span>${modKey}+${altKey}+N (Paste)</span>
                    </div>
                    <div style="margin-top: 12px; font-size: 11px; color: #a0aec0;">
                        💡 Chat history is saved automatically
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; color: #10a37f;">
                        ✅ Chat ID: ${shortId}
                    </div>
                `;
            }
            
            internalClipboardManager.showNotification('✓ Chat cleared', '#10a37f');
            input.focus();
        }
        
        async function sendMessage() {
            const msg = input.value.trim();
            if (!msg) return;
            
            // Check API key
            if (!API_KEY || API_KEY === "gsk_YOUR_GROQ_API_KEY_HERE") {
                addMessage('⚠️ Please set your Groq API key in the code. Get one from: https://console.groq.com/keys', 'assistant');
                return;
            }
            
            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;
            
            addMessage(msg, 'user');
            showTyping();
            
            try {
                // Prepare messages for Groq API (OpenAI-compatible)
                // Use message history for context (last 20 messages)
                const contextMessages = messageHistory.slice(-20);
                const messages = [
                    { role: 'system', content: 'You are ShadowPasser AI, a helpful assistant powered by Groq. You have a conversation history and should maintain context.' },
                    ...contextMessages
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
                        max_tokens: 4096,
                        stream: false
                    })
                });
                
                hideTyping();
                
                if (response.status === 401) {
                    addMessage('⚠️ Invalid Groq API key. Please check your API key.', 'assistant');
                    return;
                }
                
                if (response.status === 429) {
                    addMessage('⚠️ Rate limit exceeded. Please wait a moment and try again.', 'assistant');
                    return;
                }
                
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
        
        // Load existing messages
        renderMessages();
        
        // ============ KEYBOARD SHORTCUTS (FIXED) ============
        function handleKeyboardShortcuts(e) {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const isAlt = e.altKey;
            
            // Debug logging
            console.log('[Shortcut] Key:', e.key, 'Ctrl/Cmd:', isCtrlOrCmd, 'Alt:', isAlt);
            
            // Toggle widget: Ctrl+Alt+L
            if (isCtrlOrCmd && isAlt && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Shortcut] Toggle widget');
                if (widget.style.display === 'none') {
                    widget.style.display = 'flex';
                    input.focus();
                } else {
                    widget.style.display = 'none';
                }
                return;
            }
            
            // Copy to internal clipboard: Ctrl+Alt+M
            if (isCtrlOrCmd && isAlt && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Shortcut] Copy triggered');
                const selectedText = getSelectedText();
                if (selectedText) {
                    internalClipboardManager.copy(selectedText);
                } else {
                    internalClipboardManager.showNotification('✗ No text selected', '#ef4444');
                }
                return;
            }
            
            // Paste from internal clipboard: Ctrl+Alt+N
            if (isCtrlOrCmd && isAlt && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Shortcut] Paste triggered');
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
                        // Fallback: try to paste into the chat input
                        if (input) {
                            const start = input.selectionStart || 0;
                            const end = input.selectionEnd || 0;
                            input.value = input.value.substring(0, start) + pastedText + input.value.substring(end);
                            input.selectionStart = input.selectionEnd = start + pastedText.length;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                }
                return;
            }
        }
        
        // Add the keyboard shortcut listener
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Also handle Enter key for sending messages
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
