'use strict';

const path = require('path');

// โหลดฐานข้อมูลและโมเดลจากโฟลเดอร์ backend (รันสคริปต์นี้จากโฟลเดอร์ backend)
const { initialize: initDb, close: closeDb } = require('../database/db');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

async function main() {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    const role = process.env.ADMIN_ROLE || 'admin';

    if (!username || !password) {
        console.error('การใช้งาน: ADMIN_USERNAME=<ชื่อผู้ใช้> ADMIN_PASSWORD=<รหัสผ่าน> node scripts/create-admin.js');
        console.error('ตัวแปรเสริม: ADMIN_ROLE=admin|editor|viewer (ค่าเริ่มต้น: admin)');
        process.exit(1);
    }

    if (typeof password !== 'string' || password.length < 8) {
        console.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
        process.exit(1);
    }

    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
        console.error(`บทบาท '${role}' ไม่ถูกต้อง ต้องเป็นหนึ่งใน: ${validRoles.join(', ')}`);
        process.exit(1);
    }

    await initDb();

    try {
        const existing = await User.getUserByUsername(username);
        if (existing) {
            console.error(`ผู้ใช้ '${username}' มีอยู่แล้วในระบบ`);
            process.exit(1);
        }

        const user = await User.createUser({ username, password, role });

        await AuditLog.createAuditLog({
            userId: user.id,
            action: 'create_first_admin',
            entityType: 'user',
            entityId: String(user.id),
            details: 'สร้างบัญชีแอดมินแรกของระบบผ่านสคริปต์ provisioning',
            ipAddress: '127.0.0.1',
            userAgent: 'create-admin script',
        });

        console.log(`สร้างบัญชีแอดมินสำเร็จแล้ว`);
        console.log(`  ชื่อผู้ใช้: ${user.username}`);
        console.log(`  บทบาท: ${user.role}`);
        console.log(`  รหัสผู้ใช้: ${user.id}`);
        console.log('');
        console.log('หมายเหตุ: รหัสผ่านถูกแฮชด้วย bcrypt ก่อนบันทึก ไม่มีการเก็บรหัสผ่านเป็นข้อความธรรมดา');
    } finally {
        await closeDb();
    }
}

main().catch((err) => {
    console.error('เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
});
