/**
 * OPDC Chatbot Widget
 * วิดเจ็ตแชทบอทสำหรับฝังในเว็บไซต์ของ ก.พ.ร.
 * รองรับการทำงานร่วมกับ backend API ที่ /v1/chat
 */
(function() {
    // ตั้งค่าเริ่มต้น
    const config = {
        // เปลี่ยนเป็น URL ของ backend เมื่อ deploy
        apiEndpoint: 'http://localhost:8001/v1/chat', // เปลี่ยนเป็น '/v1/chat' เมื่อ deploy
        widgetId: 'opdc-chatbot-widget',
        theme: {
            primaryColor: '#0066cc', // สีหลักของ ก.พ.ร. (ปรับได้ตาม brand)
            backgroundColor: '#ffffff',
            textColor: '#333333',
            botMessageColor: '#f0f0f0',
            userMessageColor: '#e3f2fd'
        }
    };

    // สร้าง HTML structure ของวิดเจ็ต
    function createWidgetHTML() {
        return `
            <div id="${config.widgetId}" style="position:fixed; bottom:20px; right:20px; z-index:10000; font-family:system-ui, sans-serif;">
                <!-- ปุ่มเปิด/ปิดแชท -->
                <div id="${config.widgetId}-toggle" style="width:60px; height:60px; border-radius:50%; background-color:${config.theme.primaryColor}; color:white; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,0.2);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                        <path d="M12 15v3m0 0v3m0-3h3m-3 0H9m12-6a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                    </svg>
                </div>

                <!-- กล่องแชท (ซ่อนโดยปริยาย) -->
                <div id="${config.widgetId}-container" style="position:relative; width:350px; height:500px; background-color:${config.theme.backgroundColor}; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.15); display:flex; flex-direction:column; overflow:hidden; opacity:0; transform:scale(0.9); transition:opacity 0.2s ease, transform 0.2s ease; pointer-events:none;">
                    <!-- หัวแชท -->
                    <div id="${config.widgetId}-header" style="background-color:${config.theme.primaryColor}; color:white; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2a4.5 4.5 0 0 0-4.5 4.5V7H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h5.5a4.5 4.5 0 0 0 4.5-4.5V9a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h.5a2 2 0 0 0 2-2v-3a4.5 4.5 0 0 0-4.5-4.5z"/>
                            </svg>
                            <span>สนทนากับ ก.พ.ร.</span>
                        </div>
                        <div id="${config.widgetId}-close" style="cursor:pointer; font-size:18px; line-height:1;">×</div>
                    </div>

                    <!-- บริเวณแสดงข้อความ -->
                    <div id="${config.widgetId}-messages" style="flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px;"></div>

                    <!-- กล่องป้อนข้อความ -->
                    <div id="${config.widgetId}-input-area" style="display:flex; padding:8px; background-color:#fafafa; border-top:1px solid #eee;">
                        <input id="${config.widgetId}-input" type="text" placeholder="พิมพ์ข้อความที่นี่..." style="flex:1; padding:8px 12px; border:1px solid #ddd; border-radius:20px; font-size:14px; outline:none;">
                        <button id="${config.widgetId}-send" style="margin-left:8px; padding:0 16px; background-color:${config.theme.primaryColor}; color:white; border:none; border-radius:20px; cursor:pointer; font-size:14px;">ส่ง</button>
                    </div>
                </div>
            </div>
        `;
    }

    // เพิ่มวิดเจ็ตเข้าไปในหน้าเว็บ
    function mountWidget() {
        if (document.getElementById(config.widgetId)) return; // ป้องกันการเพิ่มซ้ำ

        // สร้าง container สำหรับวิดเจ็ต
        const container = document.createElement('div');
        container.innerHTML = createWidgetHTML();
        document.body.appendChild(container);

        // องค์ประกอบต่างๆ
        const widgetEl = document.getElementById(config.widgetId);
        const toggleEl = document.getElementById(`${config.widgetId}-toggle`);
        const containerEl = document.getElementById(`${config.widgetId}-container`);
        const closeEl = document.getElementById(`${config.widgetId}-close`);
        const messagesEl = document.getElementById(`${config.widgetId}-messages`);
        const inputEl = document.getElementById(`${config.widgetId}-input`);
        const sendEl = document.getElementById(`${config.widgetId}-send`);

        // สถานะ
        let isOpen = false;
        let sessionId = null; // จะสร้างเมื่อเริ่มสนทนา

        // ฟังก์ชันเปิด/ปิดวิดเจ็ต
        function openWidget() {
            isOpen = true;
            containerEl.style.opacity = '1';
            containerEl.style.transform = 'scale(1)';
            containerEl.style.pointerEvents = 'all';
            toggleEl.style.opacity = '0.5';
            toggleEl.style.pointerEvents = 'none';
            inputEl.focus();
        }

        function closeWidget() {
            isOpen = false;
            containerEl.style.opacity = '0';
            containerEl.style.transform = 'scale(0.9)';
            containerEl.style.pointerEvents = 'none';
            toggleEl.style.opacity = '1';
            toggleEl.style.pointerEvents = 'all';
        }

        // เพิ่มข้อความเข้าไปในกล่องแชท
        function addMessage(text, isUser = false) {
            const msgEl = document.createElement('div');
            msgEl.style.display = 'flex';
            msgEl.style.alignItems = 'flex-start';
            msgEl.style.margin = '0 0 8px 0';
            msgEl.style.maxWidth = '80%';

            if (isUser) {
                msgEl.style.justifyContent = 'flex-end';
                msgEl.innerHTML = `
                    <div style="background-color:${config.theme.userMessageColor}; color:${config.theme.textColor}; border-radius:18px 18px 4px 18px; padding:10px 14px; word-wrap:break-word;">
                        ${text}
                    </div>
                `;
            } else {
                msgEl.style.justifyContent = 'flex-start';
                msgEl.innerHTML = `
                    <div style="background-color:${config.theme.botMessageColor}; color:${config.theme.textColor}; border-radius:18px 18px 18px 4px; padding:10px 14px; word-wrap:break-word;">
                        ${text}
                    </div>
                `;
            }

            messagesEl.appendChild(msgEl);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        // ส่งข้อความไปยัง backend
        async function sendMessage(text) {
            if (!text.trim()) return;

            // แสดงข้อความของผู้ใช้ทันที
            addMessage(text, true);
            inputEl.value = '';

            try {
                const response = await fetch(config.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: text,
                        session_id: sessionId
                    })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                sessionId = data.session_id || sessionId; // อัปเดต session_id จากเซิร์ฟเวอร์

                // แสดงข้อความบอท
                addMessage(data.answer, false);
            } catch (err) {
                console.error(err);
                addMessage('ขออภัย ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง', false);
            }
        }

        // เหตุการณ์ต่างๆ
        toggleEl.addEventListener('click', openWidget);
        closeEl.addEventListener('click', closeWidget);
        sendEl.addEventListener('click', () => {
            const text = inputEl.value.trim();
            if (text) sendMessage(text);
        });
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = inputEl.value.trim();
                if (text) sendMessage(text);
            }
        });

        // เริ่มต้นในสถานะปิด
        closeWidget();
    }

    // รอจนหน้าเว็บโหลดเสร็จแล้วค่อย mount
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountWidget);
    } else {
        mountWidget();
    }
})();