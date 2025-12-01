
import { db } from '../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, getDoc, increment } from 'firebase/firestore';
import type { Voucher } from '../types';

const COLLECTION_NAME = "vouchers";

export const getAllVouchers = async (): Promise<Voucher[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const vouchers: Voucher[] = [];
        querySnapshot.forEach((doc) => {
            vouchers.push(doc.data() as Voucher);
        });
        return vouchers;
    } catch (error) {
        console.error("Error fetching vouchers:", error);
        return [];
    }
};

export const addVoucher = async (voucher: Voucher) => {
    try {
        // Use code as ID for uniqueness check
        const id = voucher.code.toUpperCase().trim();
        await setDoc(doc(db, COLLECTION_NAME, id), { ...voucher, id, code: id });
        return true;
    } catch (error) {
        console.error("Error adding voucher:", error);
        return false;
    }
};

export const updateVoucher = async (id: string, updates: Partial<Voucher>) => {
    try {
        await updateDoc(doc(db, COLLECTION_NAME, id), updates);
        return true;
    } catch (error) {
        console.error("Error updating voucher:", error);
        return false;
    }
};

export const deleteVoucher = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting voucher:", error);
        return false;
    }
};

export const validateVoucher = async (code: string, orderValue: number): Promise<{ isValid: boolean; message?: string; voucher?: Voucher }> => {
    try {
        const normalizedCode = code.toUpperCase().trim();
        const docRef = doc(db, COLLECTION_NAME, normalizedCode);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return { isValid: false, message: 'Mã giảm giá không tồn tại.' };
        }

        const voucher = docSnap.data() as Voucher;

        if (!voucher.isActive) {
            return { isValid: false, message: 'Mã giảm giá đã bị khóa.' };
        }

        if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
            return { isValid: false, message: 'Mã giảm giá đã hết hạn.' };
        }

        if (voucher.maxUsage && voucher.usedCount >= voucher.maxUsage) {
            return { isValid: false, message: 'Mã giảm giá đã hết lượt sử dụng.' };
        }

        if (orderValue < voucher.minOrderValue) {
            return { isValid: false, message: `Đơn hàng tối thiểu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(voucher.minOrderValue)} để sử dụng mã này.` };
        }

        return { isValid: true, voucher };
    } catch (error) {
        console.error("Error validating voucher:", error);
        return { isValid: false, message: 'Lỗi kiểm tra mã giảm giá.' };
    }
};

export const incrementVoucherUsage = async (code: string) => {
    try {
        const normalizedCode = code.toUpperCase().trim();
        const docRef = doc(db, COLLECTION_NAME, normalizedCode);
        await updateDoc(docRef, { usedCount: increment(1) });
    } catch (error) {
        console.error("Error incrementing voucher usage:", error);
    }
};
