
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore';

export interface AuditLog {
    id?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'IMPORT' | 'EXPORT';
    targetCollection: string; // 'orders', 'products', 'config'
    targetId: string; // ID của đối tượng bị tác động
    details: string; // Mô tả chi tiết (VD: "Đổi trạng thái từ A sang B")
    performedBy: string; // Email người thực hiện
    timestamp: number;
}

const LOG_COLLECTION = 'system_logs';

export const logAction = async (
    action: AuditLog['action'],
    targetCollection: string,
    targetId: string,
    details: string,
    performedBy: string = 'system'
) => {
    try {
        const newLog: AuditLog = {
            action,
            targetCollection,
            targetId,
            details,
            performedBy,
            timestamp: Date.now()
        };
        await addDoc(collection(db, LOG_COLLECTION), newLog);
    } catch (error) {
        console.error("Failed to write log:", error);
    }
};

export const getLogs = async (limitCount: number = 50): Promise<AuditLog[]> => {
    try {
        const q = query(collection(db, LOG_COLLECTION), orderBy('timestamp', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
    } catch (error) {
        console.error("Failed to fetch logs:", error);
        return [];
    }
};
