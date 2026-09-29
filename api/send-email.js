// api/send-email.js
// Secure server-side email dispatcher for The Luvin.
// IMPORTANT: never hardcode Gmail App Passwords or Firebase service-account secrets here.

import nodemailer from 'nodemailer';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const globalRateMap = globalThis.__theLuvinEmailRateMap || new Map();
globalThis.__theLuvinEmailRateMap = globalRateMap;

const DEFAULT_ADMIN_EMAILS = new Set([
    'theluvin.gifts@gmail.com',
    'theluvingifts@gmail.com',
    'jinbduong@gmail.com',
    'ngominh@gmail.com',
]);

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
};

const checkRateLimit = (req) => {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const maxRequests = 30;
    const ip = getClientIp(req);
    const previous = globalRateMap.get(ip) || [];
    const recent = previous.filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
        return false;
    }

    recent.push(now);
    globalRateMap.set(ip, recent);
    return true;
};

const getAllowedOrigins = () => {
    const defaults = [
        'https://theluvin.vn',
        'https://www.theluvin.vn',
    ];

    if (process.env.VERCEL_URL) {
        defaults.push(`https://${process.env.VERCEL_URL}`);
    }

    const custom = String(process.env.ALLOWED_EMAIL_ORIGINS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return new Set([...defaults, ...custom]);
};

const hasAllowedOrigin = (req) => {
    const origin = req.headers.origin;
    if (!origin) return true; // allow trusted server-to-server calls
    return getAllowedOrigins().has(origin);
};

const getFirebaseAdminApp = () => {
    if (getApps().length) return getApps()[0];

    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (error) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
        }
    } else if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    ) {
        serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }

    if (!serviceAccount) {
        throw new Error(
            'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
        );
    }

    return initializeApp({
        credential: cert(serviceAccount),
    });
};

const getMailConfig = () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_APP_PASSWORD;

    if (!user || !pass) {
        throw new Error('Missing EMAIL_USER or EMAIL_APP_PASSWORD environment variable');
    }

    return { user, pass };
};

const getBearerToken = (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice(7).trim();
};

const isAuthorizedStaff = async (req, db, app) => {
    const token = getBearerToken(req);
    if (!token) return false;

    let decoded;
    try {
        decoded = await getAuth(app).verifyIdToken(token, true);
    } catch {
        return false;
    }

    const email = normalizeEmail(decoded.email || '');
    if (!email || decoded.email_verified === false) return false;
    if (DEFAULT_ADMIN_EMAILS.has(email)) return true;

    try {
        const generalSnap = await db.collection('config').doc('general').get();
        const staffEmails = Array.isArray(generalSnap.data()?.staffEmails)
            ? generalSnap.data().staffEmails.map(normalizeEmail)
            : [];
        return staffEmails.includes(email);
    } catch {
        return false;
    }
};

const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(Number.isFinite(amount) ? amount : 0);
};

const formatAddress = (customer = {}) => {
    const parts = [
        customer.address,
        customer.ward,
        customer.district,
        customer.province,
    ].filter(Boolean);

    // address may already contain ward/district/province in legacy orders
    return [...new Set(parts.map((item) => String(item).trim()).filter(Boolean))].join(', ');
};

const formatItems = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) return 'Sản phẩm theo đơn hàng đã đặt';

    return items.map((item, index) => {
        const chars = Array.isArray(item.characters) ? item.characters.length : 0;
        const quantity = Number(item.quantity || 1);
        const name = item.templateName || item.customFormData?.template_name || item.frameId || `Sản phẩm ${index + 1}`;
        return `- ${name} (${chars} nhân vật) x${quantity}`;
    }).join('\n');
};

const buildMail = ({ type, order, emailUser }) => {
    const customer = order.customer || {};
    const toName = escapeHtml(customer.name || 'bạn');
    const orderId = escapeHtml(order.id || '');
    const total = escapeHtml(formatCurrency(order.totalPrice));
    const address = escapeHtml(formatAddress(customer));
    const itemsText = formatItems(order.items);
    const itemsHtml = escapeHtml(itemsText).replace(/\n/g, '<br>');

    if (type === 'thank_you') {
        return {
            from: `"The Luvin" <${emailUser}>`,
            to: customer.email,
            subject: `Cảm ơn bạn đã tin chọn món quà từ The Luvin! - Đơn ${order.id}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <h2 style="color: #e63946;">Chào ${toName} thân mến,</h2>
                    <p>Món quà ý nghĩa của bạn đã được giao đến nơi an toàn! The Luvin xin gửi lời cảm ơn chân thành vì bạn đã tin tưởng chúng mình.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px dashed #e63946;">
                        <p style="margin: 0; font-size: 14px;"><strong>📦 Thông tin đơn hàng:</strong> ${orderId}</p>
                        <p style="margin: 10px 0 0 0; color: #e63946; font-weight: bold;">🎁 Giảm ngay 5% cho đơn hàng tiếp theo</p>
                        <p style="margin: 5px 0 0 0; font-size: 13px;">Mã: <strong style="background:#e63946;color:white;padding:2px 8px;border-radius:4px;">THELUVIN5</strong></p>
                    </div>
                    <p>Nếu có bất kỳ thắc mắc nào, bạn có thể nhắn The Luvin qua Fanpage hoặc Zalo.</p>
                    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                    <p style="font-size:12px;color:#777;">The Luvin - Personalized Lego Frame Gifts<br>Hotline: 0968 432 043 - 0345 126 019<br>Website: theluvin.vn</p>
                </div>
            `,
            text: `Chào ${customer.name || 'bạn'},\n\nCảm ơn bạn đã tin chọn The Luvin. Đơn ${order.id} đã được giao.\nMã ưu đãi cho đơn tiếp theo: THELUVIN5.`,
        };
    }

    if (type === 'cancellation') {
        return {
            from: `"The Luvin" <${emailUser}>`,
            to: customer.email,
            subject: `Thông báo Hủy đơn hàng tự động - Mã đơn ${order.id}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color:#333;">
                    <h2 style="color:#666;">Chào ${toName},</h2>
                    <p>Đơn hàng <strong>${orderId}</strong> đã quá thời gian thanh toán và được hệ thống hủy.</p>
                    <div style="background:#fff5f5;padding:15px;border-radius:8px;margin:20px 0;border:1px solid #feb2b2;">
                        <p style="margin:0;color:#c53030;font-weight:bold;">🚫 ĐƠN HÀNG ĐÃ BỊ HỦY</p>
                    </div>
                    <p>Nếu bạn vẫn muốn mua sản phẩm, hãy quay lại theluvin.vn để tạo đơn mới.</p>
                    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                    <p style="font-size:12px;color:#777;">Hotline: 0968 432 043 - 0345 126 019</p>
                </div>
            `,
            text: `Chào ${customer.name || 'bạn'},\n\nĐơn ${order.id} đã bị hủy do quá thời gian thanh toán. Nếu bạn vẫn muốn mua, vui lòng tạo đơn mới tại theluvin.vn.`,
        };
    }

    return {
        from: `"The Luvin" <${emailUser}>`,
        to: customer.email,
        subject: `Xác nhận đơn hàng ${order.id} - The Luvin`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color:#333;">
                <h2 style="color:#1d3557;">The Luvin đã nhận đơn của ${toName}</h2>
                <p>Cảm ơn bạn đã đặt hàng tại The Luvin. Đơn hàng của bạn đã được ghi nhận.</p>
                <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:20px 0;">
                    <p><strong>📦 Mã đơn:</strong> ${orderId}</p>
                    <p><strong>💰 Tổng tiền:</strong> ${total}</p>
                    <p><strong>📍 Địa chỉ nhận:</strong> ${address || 'Theo thông tin đơn hàng'}</p>
                </div>
                <p><strong>Chi tiết sản phẩm:</strong><br>${itemsHtml}</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                <p style="font-size:12px;color:#777;">The Luvin sẽ sớm liên hệ để xác nhận. Hotline: 0968 432 043 - 0345 126 019</p>
            </div>
        `,
        text: `Xin chào ${customer.name || 'bạn'},\n\nCảm ơn bạn đã đặt hàng tại The Luvin.\n\nMã đơn: ${order.id}\nTổng tiền: ${formatCurrency(order.totalPrice)}\nĐịa chỉ nhận: ${formatAddress(customer)}\n\n${itemsText}\n\nHotline: 0968 432 043 - 0345 126 019`,
    };
};

const getDispatchFields = (type) => {
    if (type === 'thank_you') {
        return {
            sentAt: 'thankYouEmailServerSentAt',
            sendingAt: 'thankYouEmailServerSendingAt',
        };
    }

    if (type === 'cancellation') {
        return {
            sentAt: 'cancellationEmailServerSentAt',
            sendingAt: 'cancellationEmailServerSendingAt',
        };
    }

    return {
        sentAt: 'confirmationEmailServerSentAt',
        sendingAt: 'confirmationEmailServerSendingAt',
    };
};

const claimDispatch = async (db, orderRef, type) => {
    const { sentAt, sendingAt } = getDispatchFields(type);
    const now = Date.now();
    const sendingLockMs = 5 * 60 * 1000;
    const confirmationWindowMs = 30 * 60 * 1000;

    return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(orderRef);
        if (!snap.exists) {
            return { status: 'missing' };
        }

        const order = snap.data();
        const alreadySentAt = Number(order[sentAt] || 0);
        if (alreadySentAt > 0) {
            return { status: 'already_sent', order };
        }

        const activeLockAt = Number(order[sendingAt] || 0);
        if (activeLockAt > 0 && now - activeLockAt < sendingLockMs) {
            return { status: 'busy', order };
        }

        if (type === 'confirmation') {
            const createdAt = Number(order.createdAt || 0);
            if (!createdAt || Math.abs(now - createdAt) > confirmationWindowMs) {
                return { status: 'expired', order };
            }
        }

        transaction.update(orderRef, { [sendingAt]: now });
        return { status: 'claimed', order };
    });
};

const finishDispatch = async (orderRef, type, success) => {
    const { sentAt, sendingAt } = getDispatchFields(type);

    if (!success) {
        await orderRef.update({ [sendingAt]: FieldValue.delete() });
        return;
    }

    const update = {
        [sentAt]: Date.now(),
        [sendingAt]: FieldValue.delete(),
    };

    if (type === 'thank_you') update.thankYouEmailSent = true;
    if (type === 'cancellation') update.cancellationEmailSent = true;

    await orderRef.update(update);
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST requests allowed' });
    }

    if (!hasAllowedOrigin(req)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    if (!checkRateLimit(req)) {
        return res.status(429).json({ error: 'Too many email requests. Try again later.' });
    }

    const orderId = String(req.body?.order_id || '').trim();
    const type = String(req.body?.type || 'confirmation').trim();

    if (!['confirmation', 'thank_you', 'cancellation'].includes(type)) {
        return res.status(400).json({ error: 'Unsupported email type' });
    }

    if (!orderId || orderId.length > 80 || !/^#?TL[A-Za-z0-9_-]+$/.test(orderId)) {
        return res.status(400).json({ error: 'Invalid order id' });
    }

    try {
        const app = getFirebaseAdminApp();
        const db = getFirestore(app);
        const orderRef = db.collection('orders').doc(orderId);

        if (type !== 'confirmation') {
            const allowed = await isAuthorizedStaff(req, db, app);
            if (!allowed) {
                return res.status(401).json({ error: 'Staff authentication required' });
            }
        }

        const claim = await claimDispatch(db, orderRef, type);

        if (claim.status === 'missing') {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (claim.status === 'expired') {
            return res.status(409).json({ error: 'Confirmation email window expired' });
        }

        if (claim.status === 'already_sent') {
            return res.status(200).json({ success: true, duplicate: true });
        }

        if (claim.status === 'busy') {
            return res.status(202).json({ success: true, pending: true });
        }

        const order = claim.order;
        const recipient = normalizeEmail(order?.customer?.email || '');

        if (!isValidEmail(recipient)) {
            await finishDispatch(orderRef, type, false);
            return res.status(400).json({ error: 'Order has no valid customer email' });
        }

        // Recipient and email content are derived from Firestore.
        // The browser is never allowed to choose an arbitrary destination address.
        order.customer = { ...order.customer, email: recipient };

        const { user, pass } = getMailConfig();
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass },
        });

        const mailOptions = buildMail({ type, order, emailUser: user });

        try {
            await transporter.sendMail(mailOptions);
            await finishDispatch(orderRef, type, true);
            return res.status(200).json({ success: true });
        } catch (mailError) {
            await finishDispatch(orderRef, type, false);
            console.error('Email send failed:', mailError);
            return res.status(500).json({ error: 'Email delivery failed' });
        }
    } catch (error) {
        console.error('send-email handler error:', error);
        return res.status(500).json({ error: 'Email service is not configured correctly' });
    }
}
