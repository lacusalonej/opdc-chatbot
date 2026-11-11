/**
 * MOF Chatbot Widget — Vanilla JS embed widget
 * ใส่แท็กนี้ในหน้าเว็บที่ต้องการให้แสดงแชทบอท:
 *   <script src="https://your-domain.com/chat-widget.js"></script>
 *   <script>MOFChatbot.init({ endpoint: 'http://localhost:8001' });</script>
 */

(function (window, document) {
  'use strict';

  var defaultConfig = {
    endpoint: 'http://localhost:8001',
    position: 'bottom-right', // bottom-right | bottom-left
    primaryColor: '#0f62fe',
    title: 'MOF Chatbot',
    subtitle: 'ถามคำถามเกี่ยวกับ สปก.',
    welcomeMessage: 'สวัสดีครับ ยินดีให้บริการครับ มีอะไรให้ช่วยไหมครับ',
    quickReplies: [
      'สปก. คืออะไร',
      'วิธีการติดต่อเจ้าหน้าที่',
      'ข้อมูลทั่วไปเกี่ยวกับ สปก.',
      'ค้นหาเอกสารและข่าวสาร'
    ]
  };

  var config = {};
  var sessionId = null;
  var isOpen = false;

  function mergeConfig(userConfig) {
    config = {};
    Object.keys(defaultConfig).forEach(function (key) {
      config[key] = (userConfig && userConfig[key] !== undefined)
        ? userConfig[key]
        : defaultConfig[key];
    });
  }

  function createWidget() {
    var wrapper = document.createElement('div');
    wrapper.id = 'mof-chatbot-wrapper';
    wrapper.style.position = 'fixed';
    wrapper.style.bottom = '24px';
    wrapper.style.right = config.position === 'bottom-left' ? '24px' : '24px';
    if (config.position === 'bottom-left') {
      wrapper.style.right = 'auto';
      wrapper.style.left = '24px';
    }
    wrapper.style.zIndex = '9999';
    wrapper.style.fontFamily = 'inherit';

    // Button to open chat
    var btn = document.createElement('button');
    btn.id = 'mof-chatbot-toggle';
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    btn.style.position = 'relative';
    btn.style.width = '56px';
    btn.style.height = '56px';
    btn.style.borderRadius = '50%';
    btn.style.backgroundColor = config.primaryColor;
    btn.style.color = '#ffffff';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 12px rgba(15, 98, 254, 0.4)';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';

    // Chat panel
    var panel = document.createElement('div');
    panel.id = 'mof-chatbot-panel';
    panel.style.position = 'absolute';
    panel.style.bottom = '76px';
    panel.style.right = '0';
    panel.style.width = '360px';
    panel.style.height = '520px';
    panel.style.background = '#ffffff';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
    panel.style.display = 'none';
    panel.style.flexDirection = 'column';
    panel.style.border = '1px solid #e5e7eb';
    panel.style.overflow = 'hidden';

    // Header
    var header = document.createElement('div');
    header.style.padding = '14px 16px';
    header.style.background = config.primaryColor;
    header.style.color = '#ffffff';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    var headerTitle = document.createElement('div');
    headerTitle.style.fontWeight = '600';
    headerTitle.style.fontSize = '1rem';
    headerTitle.textContent = config.title;

    var headerSub = document.createElement('div');
    headerSub.style.fontSize = '0.75rem';
    headerSub.style.opacity = '0.9';
    headerSub.style.marginTop = '2px';
    headerSub.textContent = config.subtitle;

    var headerLeft = document.createElement('div');
    headerLeft.appendChild(headerTitle);
    headerLeft.appendChild(headerSub);

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.fontSize = '1.25rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = toggleChat;

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);

    // Messages area
    var messages = document.createElement('div');
    messages.id = 'mof-chatbot-messages';
    messages.style.flex = '1';
    messages.style.overflowY = 'auto';
    messages.style.padding = '16px';
    messages.style.display = 'flex';
    messages.style.flexDirection = 'column';
    messages.style.gap = '12px';

    // Welcome message
    addMessage(config.welcomeMessage, 'bot');

    // Quick replies
    var quickReplies = document.createElement('div');
    quickReplies.style.display = 'flex';
    quickReplies.style.flexWrap = 'wrap';
    quickReplies.style.gap = '6px';
    quickReplies.style.marginBottom = '6px';
    config.quickReplies.forEach(function (text) {
      var chip = document.createElement('button');
      chip.textContent = text;
      chip.style.flex = 'auto';
      chip.style.minWidth = '60px';
      chip.style.padding = '6px 10px';
      chip.style.background = '#f3f4f6';
      chip.style.border = '1px solid #d1d5db';
      chip.style.borderRadius = '16px';
      chip.style.fontSize = '0.75rem';
      chip.style.cursor = 'pointer';
      chip.style.color = '#111827';
      chip.onclick = function () { sendMessage(text); };
      quickReplies.appendChild(chip);
    });

    // Input area
    var inputArea = document.createElement('div');
    inputArea.style.padding = '12px 16px';
    inputArea.style.background = '#f9fafb';
    inputArea.style.borderTop = '1px solid #e5e7eb';
    inputArea.style.display = 'flex';
    inputArea.style.gap = '8px';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'พิมพ์คำถามของคุณ...';
    input.style.flex = '1';
    input.style.padding = '10px 14px';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '24px';
    input.style.fontSize = '0.9rem';
    input.style.outline = 'none';
    input.onkeypress = function (e) { if (e.key === 'Enter') sendMessage(input.value); };

    var sendBtn = document.createElement('button');
    sendBtn.textContent = 'ส่ง';
    sendBtn.style.padding = '10px 18px';
    sendBtn.style.background = config.primaryColor;
    sendBtn.style.color = '#ffffff';
    sendBtn.style.border = 'none';
    sendBtn.style.borderRadius = '24px';
    sendBtn.style.cursor = 'pointer';
    sendBtn.style.fontSize = '0.9rem';
    sendBtn.onclick = function () { sendMessage(input.value); };

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(quickReplies);
    panel.appendChild(inputArea);

    wrapper.appendChild(btn);
    wrapper.appendChild(panel);

    btn.onclick = toggleChat;

    document.body.appendChild(wrapper);
    return { wrapper: wrapper, panel: panel, messages: messages, input: input };
  }

  var ui = null;

  function toggleChat() {
    isOpen = !isOpen;
    if (ui) {
      ui.panel.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) ui.input.focus();
    }
  }

  function addMessage(text, sender) {
    if (!ui) return;
    var bubble = document.createElement('div');
    bubble.style.padding = '10px 14px';
    bubble.style.borderRadius = '16px';
    bubble.style.fontSize = '0.9rem';
    bubble.style.maxWidth = '85%';
    bubble.style.lineHeight = '1.5';
    bubble.style.wordBreak = 'break-word';
    if (sender === 'bot') {
      bubble.style.background = '#f3f4f6';
      bubble.style.color = '#111827';
      bubble.style.alignSelf = 'flex-start';
      bubble.style.borderBottomLeftRadius = '4px';
    } else {
      bubble.style.background = config.primaryColor;
      bubble.style.color = '#ffffff';
      bubble.style.alignSelf = 'flex-end';
      bubble.style.borderBottomRightRadius = '4px';
    }
    bubble.textContent = text;
    ui.messages.appendChild(bubble);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function showTyping() {
    if (!ui) return;
    var typing = document.createElement('div');
    typing.id = 'mof-typing';
    typing.style.padding = '10px 14px';
    typing.style.background = '#f3f4f6';
    typing.style.color = '#6b7280';
    typing.style.borderRadius = '16px';
    typing.style.fontSize = '0.85rem';
    typing.style.fontStyle = 'italic';
    typing.style.alignSelf = 'flex-start';
    typing.style.borderBottomLeftRadius = '4px';
    typing.textContent = 'กำลังพิมพ์...';
    ui.messages.appendChild(typing);
    ui.messages.scrollTop = ui.messages.scrollHeight;
    return typing;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();
    addMessage(text, 'user');
    if (ui) ui.input.value = '';
    var typing = showTyping();

    fetch(config.endpoint + '/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        removeTyping(typing);
        if (data.session_id && !sessionId) sessionId = data.session_id;
        addMessage(data.answer || data.response || 'ขออภัยครับ ระบบเกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'bot');
      })
      .catch(function (err) {
        removeTyping(typing);
        addMessage('ขออภัยครับ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้งภายหลัง', 'bot');
        console.error('[MOF Chatbot] Error:', err);
      });
  }

  window.MOFChatbot = {
    init: function (userConfig) {
      mergeConfig(userConfig);
      if (!ui) ui = createWidget();
    }
  };

})(window, document);
