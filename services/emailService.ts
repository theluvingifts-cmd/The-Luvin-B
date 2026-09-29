// services/emailService.ts
import type { Order } from '../types';
import { auth } from '../config/firebase';

/**
 * Public checkout confirmation.
 * The API receives ONLY the order id, then loads the recipient/content from
 * Firestore server-side. This prevents /api/send-email from acting as an
 * arbitrary SMTP relay.
 */
export const sendOrderEmail = async (order: Order) => {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                order_id: order.id,
                type: 'confirmation',
            }),
        });

        if (response.ok) {
            console.log('Email xác nhận đơn hàng đã gửi thành công!');
            return true;
        }

        console.error('Lỗi gửi email xác nhận:', await response.text());
        return false;
    } catch (error) {
        console.error('Lỗi kết nối API email:', error);
        return false;
    }
};

/**
 * Staff-only email. Firebase ID token is sent to the API and verified on the
 * server before the email can be dispatched.
 */
export const sendThankYouEmail = async (order: Order) => {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('Không thể gửi email cảm ơn: chưa đăng nhập tài khoản nhân viên.');
            return false;
        }

        const idToken = await user.getIdToken();
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                order_id: order.id,
                type: 'thank_you',
            }),
        });

        if (response.ok) {
            console.log('Email cảm ơn đã gửi thành công!');
            return true;
        }

        console.error('Lỗi gửi email cảm ơn:', await response.text());
        return false;
    } catch (error) {
        console.error('Lỗi khi gửi email cảm ơn:', error);
        return false;
    }
};
