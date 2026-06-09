
// services/autoCancelService.ts
import { adminDb } from '../config/firebase-admin';
import type { Order } from '../types';
import sendEmailHandler from '../api/send-email.js';

const CANCELLATION_TIMEOUT_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

export const runAutoCancelTask = async () => {
    console.log('[AutoCancel] Checking for expired orders...');
    try {
        const now = Date.now();
        
        // Use adminDb to bypass security rules
        const ordersSnapshot = await adminDb.collection('orders')
            .where('status', '==', 'Chờ thanh toán')
            .get();
        
        let cancelledCount = 0;

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data() as Order;
            const createdAt = order.createdAt;

            if (now - createdAt >= CANCELLATION_TIMEOUT_MS) {
                console.log(`[AutoCancel] Cancelling order ${order.id} (Created: ${new Date(createdAt).toLocaleString()})`);
                
                // 1. Update status in Firestore using admin ref
                await orderDoc.ref.update({
                    status: 'Đã hủy',
                    internalNotes: (order.internalNotes || '') + '\n[AutoCancel] Hủy do quá 48h chưa thanh toán.',
                    cancelledAt: now
                });

                // 2. Send Email Notification
                if (order.customer.email) {
                    try {
                        const mockReq = {
                            method: 'POST',
                            body: {
                                to_name: order.customer.name,
                                to_email: order.customer.email,
                                order_id: order.id,
                                type: 'cancellation'
                            }
                        } as any;
                        
                        const mockRes = {
                            status: () => ({ json: () => {}, send: () => {} }),
                        } as any;

                        await sendEmailHandler(mockReq, mockRes);
                        console.log(`[AutoCancel] Email sent to ${order.customer.email}`);
                    } catch (emailError) {
                        console.error(`[AutoCancel] Error sending email for ${order.id}:`, emailError);
                    }
                }

                cancelledCount++;
            }
        }

        if (cancelledCount > 0) {
            console.log(`[AutoCancel] Completed. Cancelled ${cancelledCount} orders.`);
        } else {
            console.log('[AutoCancel] Completed. No expired orders found.');
        }
    } catch (error) {
        console.error('[AutoCancel] Task failed:', error);
    }
};
