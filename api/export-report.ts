// api/export-report.ts
import { db } from '../config/firebase.js';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { Order } from '../types';

export default async function handler(req: any, res: any) {
    // Only accept GET requests for exporting reports
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Only GET requests allowed' });
    }

    const { token, type = 'json', dataset = 'orders' } = req.query;

    if (!token) {
        return res.status(401).json({ error: 'Thiếu token bảo mật (security token is required)' });
    }

    try {
        // 1. Kiểm tra Token hợp lệ từ Config General
        const configDocRef = doc(db, 'config', 'general');
        const configSnap = await getDoc(configDocRef);
        
        if (!configSnap.exists()) {
            return res.status(500).json({ error: 'Không tìm thấy cấu hình cửa hàng' });
        }

        const configData = configSnap.data();
        if (!configData.reportToken || configData.reportToken !== token) {
            return res.status(403).json({ error: 'Token bảo mật không chính xác' });
        }

        // 2. Lấy danh sách toàn bộ đơn hàng từ Firestore
        const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(ordersQuery);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });

        // 3. Xử lý dữ liệu theo Dataset yêu cầu
        if (dataset === 'orders') {
            return handleOrdersDataset(orders, type, res);
        } else if (dataset === 'customers') {
            return handleCustomersDataset(orders, type, res);
        } else if (dataset === 'revenue') {
            return handleRevenueDataset(orders, type, res);
        } else {
            return res.status(400).json({ error: 'Dataset không hợp lệ. Chọn: orders, customers, hoặc revenue' });
        }

    } catch (error: any) {
        console.error('Lỗi khi xuất báo cáo API:', error);
        return res.status(500).json({ error: `Lỗi hệ thống: ${error.message}` });
    }
}

// Helper: Định dạng thời gian
function formatTime(timestamp: number): string {
    if (!timestamp) return '';
    try {
        // Định dạng theo múi giờ Việt Nam
        return new Date(timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    } catch (e) {
        return new Date(timestamp).toISOString();
    }
}

// Helper: Chuyển đổi dữ liệu sang CSV với BOM UTF-8 để mở bằng Excel không lỗi font Việt Nam
function sendCsvResponse(headers: string[], rows: string[][], filename: string, res: any) {
    const bom = '\uFEFF';
    const headerLine = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const rowLines = rows.map(row => 
        row.map(val => {
            const stringVal = val === undefined || val === null ? '' : String(val);
            return `"${stringVal.replace(/"/g, '""')}"`;
        }).join(',')
    );
    const csvContent = bom + [headerLine, ...rowLines].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
}

// --- DATASET: ORDERS ---
function handleOrdersDataset(orders: Order[], type: string, res: any) {
    const formattedOrders = orders.map(order => {
        // Chi tiết sản phẩm
        const itemsDetail = (order.items || []).map((item, idx) => {
            const charCount = (item.characters || []).length;
            const charmCount = (item.draggableItems || []).filter(di => di.type === 'charm').length;
            const textCount = (item.texts || []).length;
            return `Sản phẩm ${idx + 1} [Khung: ${item.frameId || 'Mặc định'}, Nhân vật: ${charCount}, Phụ kiện/Sticker: ${charmCount}, Chữ: ${textCount}]`;
        }).join(' | ');

        return {
            orderId: order.id,
            createdAt: formatTime(order.createdAt),
            status: order.status || 'Chờ thanh toán',
            customerName: order.customer?.name || '',
            phone: order.customer?.phone || '',
            email: order.customer?.email || '',
            address: order.customer?.address || '',
            province: order.customer?.province || '',
            district: order.customer?.district || '',
            ward: order.customer?.ward || '',
            customerNote: order.customer?.note || '',
            totalPrice: order.totalPrice || 0,
            amountPaid: order.amountPaid || 0,
            amountToPay: order.amountToPay || 0,
            paymentMethod: order.payment?.method === 'deposit' ? 'Đặt cọc' : 'Trả hết',
            shippingMethod: order.shipping?.method === 'express' ? 'Hoả tốc' : order.shipping?.method === 'bookship' ? 'Tự gọi ship' : 'Tiêu chuẩn',
            shippingFee: order.shipping?.fee || 0,
            addGiftBox: order.addGiftBox ? 'Có' : 'Không',
            addLight: order.addLight ? 'Có' : 'Không',
            addPolaroid: order.addPolaroid || 0,
            trackingCode: order.trackingCode || '',
            internalNotes: order.internalNotes || '',
            itemsSummary: itemsDetail
        };
    });

    if (type === 'json') {
        return res.status(200).json(formattedOrders);
    }

    // Export CSV
    const headers = [
        'Mã đơn hàng', 'Ngày đặt', 'Trạng thái', 'Khách hàng', 'Số điện thoại', 'Email', 
        'Địa chỉ', 'Tỉnh/Thành phố', 'Quận/Huyện', 'Phường/Xã', 'Ghi chú của khách',
        'Tổng giá trị đơn', 'Đã thanh toán', 'Còn lại cần trả', 'Hình thức thanh toán',
        'Hình thức vận chuyển', 'Phí vận chuyển', 'Thêm hộp quà', 'Thêm đèn LED', 'Số ảnh Polaroid',
        'Mã vận đơn', 'Ghi chú nội bộ admin', 'Chi tiết sản phẩm'
    ];

    const rows = formattedOrders.map(o => [
        o.orderId, o.createdAt, o.status, o.customerName, o.phone, o.email,
        o.address, o.province, o.district, o.ward, o.customerNote,
        String(o.totalPrice), String(o.amountPaid), String(o.amountToPay), o.paymentMethod,
        o.shippingMethod, String(o.shippingFee), o.addGiftBox, o.addLight, String(o.addPolaroid),
        o.trackingCode, o.internalNotes, o.itemsSummary
    ]);

    return sendCsvResponse(headers, rows, `danh_sach_don_hang_${Date.now()}.csv`, res);
}

// --- DATASET: CUSTOMERS ---
function handleCustomersDataset(orders: Order[], type: string, res: any) {
    // Gom nhóm khách hàng qua Số điện thoại (nếu không có thì gom theo tên + email)
    const customerMap = new Map<string, {
        name: string;
        phone: string;
        email: string;
        address: string;
        province: string;
        district: string;
        ward: string;
        totalOrders: number;
        successOrders: number;
        cancelledOrders: number;
        totalSpent: number;
        totalPaid: number;
        lastOrderAt: number;
    }>();

    orders.forEach(order => {
        const phone = (order.customer?.phone || '').trim();
        const email = (order.customer?.email || '').trim();
        const name = (order.customer?.name || '').trim();
        
        // Key nhận diện khách hàng
        const key = phone || `${name}_${email}`;
        if (!key) return; // Bỏ qua nếu hoàn toàn trống thông tin

        const isCancelled = order.status === 'Huỷ đơn' || order.status === 'Đã huỷ';
        const orderValue = order.totalPrice || 0;
        const paidValue = order.amountPaid || 0;

        if (customerMap.has(key)) {
            const existing = customerMap.get(key)!;
            // Cập nhật thông tin địa chỉ nếu đơn hàng này mới hơn
            const isNewer = order.createdAt > existing.lastOrderAt;
            
            customerMap.set(key, {
                name: isNewer ? name : existing.name,
                phone: phone || existing.phone,
                email: isNewer ? email : existing.email,
                address: isNewer ? (order.customer?.address || '') : existing.address,
                province: isNewer ? (order.customer?.province || '') : existing.province,
                district: isNewer ? (order.customer?.district || '') : existing.district,
                ward: isNewer ? (order.customer?.ward || '') : existing.ward,
                totalOrders: existing.totalOrders + 1,
                successOrders: existing.successOrders + (isCancelled ? 0 : 1),
                cancelledOrders: existing.cancelledOrders + (isCancelled ? 1 : 0),
                totalSpent: existing.totalSpent + (isCancelled ? 0 : orderValue),
                totalPaid: existing.totalPaid + paidValue,
                lastOrderAt: Math.max(existing.lastOrderAt, order.createdAt)
            });
        } else {
            customerMap.set(key, {
                name,
                phone,
                email,
                address: order.customer?.address || '',
                province: order.customer?.province || '',
                district: order.customer?.district || '',
                ward: order.customer?.ward || '',
                totalOrders: 1,
                successOrders: isCancelled ? 0 : 1,
                cancelledOrders: isCancelled ? 1 : 0,
                totalSpent: isCancelled ? 0 : orderValue,
                totalPaid: paidValue,
                lastOrderAt: order.createdAt
            });
        }
    });

    const formattedCustomers = Array.from(customerMap.values()).map(c => ({
        ...c,
        lastOrderDate: formatTime(c.lastOrderAt)
    }));

    if (type === 'json') {
        return res.status(200).json(formattedCustomers);
    }

    // Export CSV
    const headers = [
        'Tên khách hàng', 'Số điện thoại', 'Email', 'Địa chỉ', 'Tỉnh/Thành phố', 'Quận/Huyện', 'Phường/Xã',
        'Tổng số đơn đặt', 'Số đơn hoàn tất/đang xử lý', 'Số đơn bị huỷ', 'Tổng chi tiêu (Đơn thành công)', 'Thực tế đã thanh toán', 'Ngày đặt hàng gần nhất'
    ];

    const rows = formattedCustomers.map(c => [
        c.name, c.phone, c.email, c.address, c.province, c.district, c.ward,
        String(c.totalOrders), String(c.successOrders), String(c.cancelledOrders), String(c.totalSpent), String(c.totalPaid), c.lastOrderDate
    ]);

    return sendCsvResponse(headers, rows, `danh_sach_khach_hang_${Date.now()}.csv`, res);
}

// --- DATASET: REVENUE ---
function handleRevenueDataset(orders: Order[], type: string, res: any) {
    // Gom doanh thu theo Ngày (YYYY-MM-DD)
    const dailyMap = new Map<string, {
        date: string;
        totalOrders: number;
        successOrders: number;
        cancelledOrders: number;
        estimatedRevenue: number; // Tổng giá trị đơn không hủy
        actualCollected: number;  // Tổng tiền thực tế đã thu (amountPaid)
    }>();

    orders.forEach(order => {
        if (!order.createdAt) return;
        
        // Lấy ngày theo định dạng YYYY-MM-DD
        const dateObj = new Date(order.createdAt);
        // Chuyển múi giờ VN để phân nhóm chính xác ngày Việt Nam
        const localDateStr = dateObj.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }); // sv-SE cho ra YYYY-MM-DD

        const isCancelled = order.status === 'Huỷ đơn' || order.status === 'Đã huỷ';
        const orderValue = order.totalPrice || 0;
        const paidValue = order.amountPaid || 0;

        if (dailyMap.has(localDateStr)) {
            const existing = dailyMap.get(localDateStr)!;
            dailyMap.set(localDateStr, {
                date: localDateStr,
                totalOrders: existing.totalOrders + 1,
                successOrders: existing.successOrders + (isCancelled ? 0 : 1),
                cancelledOrders: existing.cancelledOrders + (isCancelled ? 1 : 0),
                estimatedRevenue: existing.estimatedRevenue + (isCancelled ? 0 : orderValue),
                actualCollected: existing.actualCollected + paidValue
            });
        } else {
            dailyMap.set(localDateStr, {
                date: localDateStr,
                totalOrders: 1,
                successOrders: isCancelled ? 0 : 1,
                cancelledOrders: isCancelled ? 1 : 0,
                estimatedRevenue: isCancelled ? 0 : orderValue,
                actualCollected: paidValue
            });
        }
    });

    // Sắp xếp các ngày từ mới nhất đến cũ nhất
    const formattedRevenue = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    if (type === 'json') {
        return res.status(200).json(formattedRevenue);
    }

    // Export CSV
    const headers = [
        'Ngày', 'Tổng số đơn hàng', 'Đơn đặt thành công', 'Đơn hàng bị huỷ', 
        'Doanh thu dự kiến (Đơn thành công)', 'Doanh thu thực thu (Số tiền đã cọc/trả)'
    ];

    const rows = formattedRevenue.map(r => [
        r.date, String(r.totalOrders), String(r.successOrders), String(r.cancelledOrders),
        String(r.estimatedRevenue), String(r.actualCollected)
    ]);

    return sendCsvResponse(headers, rows, `bao_cao_doanh_thu_${Date.now()}.csv`, res);
}
