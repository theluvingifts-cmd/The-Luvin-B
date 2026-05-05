
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const COLLECTION_NAME = "audit_logs";

export type AuditAction = 
  | 'create_part' 
  | 'update_part' 
  | 'delete_part' 
  | 'adjust_stock' 
  | 'revoke_session' 
  | 'update_order'
  | 'update_template'
  | 'update_background';

export interface AuditLog {
  timestamp: any;
  adminUid: string;
  adminEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details: any;
}

export const createAuditLog = async (
  action: AuditAction, 
  entityType: string, 
  entityId: string, 
  details: any = {}
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const log: Omit<AuditLog, 'timestamp'> & { timestamp: any } = {
      timestamp: serverTimestamp(),
      adminUid: user.uid,
      adminEmail: user.email || 'unknown',
      action,
      entityType,
      entityId,
      details
    };

    await addDoc(collection(db, COLLECTION_NAME), log);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
};
