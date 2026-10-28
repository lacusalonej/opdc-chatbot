/* ================================================================
   OPDC Chatbot Admin — Shared JavaScript
   ภาษา: Thai
   ================================================================ */

(function () {
    'use strict';

    const API_BASE = window.location.origin + '/api/admin/v1';

    // สถานะตรวจสอบสิทธิ์ (เก็บเฉพาะในหน่วยความจำ session — ห้ามเก็บใน localStorage)
    let currentUser = null;
    let csrfToken = null;

    // DOM elements shared
    const navUser = document.getElementById('nav-user');
    const navRole = document.getElementById('nav-role');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const authRequiredEls = document.querySelectorAll('[data-auth-required]');
    const roleAdminEls = document.querySelectorAll('[data-role-admin]');

    // ---------- Utility ----------
    function showStatus(containerId, message, type = 'success') {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.textContent = message;
        el.className = 'status ' + type + ' show';
        setTimeout(() => { el.classList.remove('show'); }, 5000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- API client ----------
    async function apiRequest(path, options = {}) {
        const headers = { 'Accept': 'application/json', ...options.headers };
        const method = options.method || 'GET';

        // เพิ่ม CSRF token สำหรับคำขอที่เปลี่ยนแปลงสถานะ
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
        }

        const res = await fetch(API_BASE + path, {
            method,
            headers,
            credentials: 'include', // ส่ง cookie (session_id)
            body: options.body,
        });

        // เซสชันหมดอายุหรือยังไม่ได้ล็อกอิน -> กลับไปหน้าเข้าสู่ระบบ
        if (res.status === 401) {
            if (window.location.pathname.endsWith('login.html')) return null;
            window.location.href = 'login.html';
            return null;
        }

        // 403 = สิทธิ์ไม่เพียงพอ
        if (res.status === 403) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'คุณไม่มีสิทธิ์ดำเนินการนี้');
        }

        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await res.json();
        } else {
            data = await res.text();
        }

        // หลังจากคำขอสำเร็จที่เปลี่ยนสถานะ ให้ดึง CSRF token ใหม่ (rotate)
        if (res.ok && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            try {
                await refreshCsrfToken();
            } catch (_) { /* ignore */ }
        }

        return { ok: res.ok, status: res.status, data };
    }

    async function refreshCsrfToken() {
        const res = await fetch(API_BASE + '/auth/csrf-token', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
            const data = await res.json();
            csrfToken = data.csrfToken || null;
        }
    }

    // ---------- Auth ----------
    async function checkAuth() {
        try {
            const res = await apiRequest('/auth/me');
            if (!res || !res.ok) {
                currentUser = null;
                updateUI();
                return false;
            }
            currentUser = res.data.user;
            updateUI();
            await refreshCsrfToken();
            return true;
        } catch (err) {
            currentUser = null;
            updateUI();
            return false;
        }
    }

    async function login(username, password) {
        const res = await apiRequest('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res || !res.ok) {
            const msg = (res && res.data && res.data.error) || 'ล็อกอินไม่สำเร็จ';
            throw new Error(msg);
        }
        currentUser = res.data.user;
        csrfToken = res.data.csrfToken || null;
        updateUI();
        return res.data;
    }

    async function logout() {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (_) { /* ignore */ }
        currentUser = null;
        csrfToken = null;
        updateUI();
        window.location.href = 'login.html';
    }

    function updateUI() {
        const loggedIn = !!currentUser;

        // แสดง/ซ่อนองค์ประกอบที่ต้องการตรวจสอบสิทธิ์
        authRequiredEls.forEach((el) => {
            el.style.display = loggedIn ? '' : 'none';
        });

        // ปุ่มล็อกอิน / ออกจากระบบ
        if (navLoginBtn) navLoginBtn.style.display = loggedIn ? 'none' : '';
        if (navLogoutBtn) navLogoutBtn.style.display = loggedIn ? '' : 'none';

        // ข้อมูลผู้ใช้ในหัวข้อ
        if (navUser) navUser.textContent = currentUser ? currentUser.username : '';
        if (navRole) {
            navRole.textContent = currentUser ? currentUser.role : '';
            if (navRole) navRole.style.display = loggedIn ? '' : 'none';
        }

        // องค์ประกอบสำหรับบทบาท admin เท่านั้น
        roleAdminEls.forEach((el) => {
            el.style.display = (loggedIn && currentUser.role === 'admin') ? '' : 'none';
        });

        // ปุ่มออกจากระบบ
        const logoutBtns = document.querySelectorAll('[data-action="logout"]');
        logoutBtns.forEach((btn) => {
            btn.onclick = (e) => { e.preventDefault(); logout(); };
        });

        // ปุ่มล็อกอินในหน้า login (จัดการในแต่ละหน้า)
    }

    // ---------- Expose to global ----------
    window.AdminApp = {
        API_BASE,
        currentUser: () => currentUser,
        csrfToken: () => csrfToken,
        apiRequest,
        checkAuth,
        login,
        logout,
        showStatus,
        escapeHtml,
        updateUI,
    };

    // รันตรวจสอบสิทธิ์เมื่อโหลดหน้า
    document.addEventListener('DOMContentLoaded', checkAuth);

})();
