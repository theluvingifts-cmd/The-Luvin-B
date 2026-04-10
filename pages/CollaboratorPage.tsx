
import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy
} from 'firebase/firestore';
import { useLanguage } from '../src/contexts/LanguageContext';
import { Logo } from '../components/shared/Logo';
import { formatCurrency } from '../utils/pricing';
import { Order } from '../types';

enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    return errInfo;
};

const CollaboratorPage: React.FC = () => {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [authError, setAuthError] = useState('');
    const [formData, setFormData] = useState({ fullName: '', phone: '', bankName: '', bankAccount: '', bankOwner: '' });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (profile) {
            setFormData({
                fullName: profile.fullName || '',
                phone: profile.phone || '',
                bankName: profile.bankName || '',
                bankAccount: profile.bankAccount || '',
                bankOwner: profile.bankOwner || ''
            });
        }
    }, [profile]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await fetchProfile(currentUser.uid);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });
        return unsubscribe;
    }, []);

    const fetchProfile = async (uid: string) => {
        setLoading(true);
        try {
            const docSnap = await getDoc(doc(db, 'collaborators', uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile(data);
                await fetchOrders(data.referralCode);
            } else {
                setProfile(null);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        }
        setLoading(false);
    };

    const fetchOrders = async (refCode: string) => {
        try {
            // Remove orderBy to avoid index requirement, sort in memory instead
            const q = query(
                collection(db, 'orders'), 
                where('referredBy', '==', refCode)
            );
            const querySnapshot = await getDocs(q);
            const ordersData: Order[] = [];
            querySnapshot.forEach((doc) => {
                ordersData.push(doc.data() as Order);
            });
            
            // Sort in memory: newest first
            ordersData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            
            setOrders(ordersData);
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'orders');
            console.error("Error fetching orders:", error);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        try {
            await signInWithEmailAndPassword(auth, authEmail, authPassword);
        } catch (error: any) {
            console.error("Login error:", error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setAuthError('Email hoặc mật khẩu không chính xác');
            } else if (error.code === 'auth/invalid-email') {
                setAuthError('Email không hợp lệ');
            } else {
                setAuthError('Lỗi đăng nhập. Vui lòng thử lại.');
            }
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        if (authPassword.length < 6) {
            return setAuthError('Mật khẩu phải có ít nhất 6 ký tự');
        }
        try {
            await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        } catch (error: any) {
            console.error("Signup error:", error);
            if (error.code === 'auth/email-already-in-use') {
                setAuthError('Email này đã được sử dụng');
            } else if (error.code === 'auth/invalid-email') {
                setAuthError('Email không hợp lệ');
            } else {
                setAuthError('Lỗi đăng ký. Vui lòng thử lại.');
            }
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.phone || !formData.fullName) return alert("Vui lòng điền đầy đủ thông tin");

        const referralCode = formData.phone; // Use phone as ref code for simplicity
        const newProfile = {
            uid: user.uid,
            email: user.email,
            phone: formData.phone,
            fullName: formData.fullName,
            bankName: formData.bankName,
            bankAccount: formData.bankAccount,
            bankOwner: formData.bankOwner,
            referralCode,
            status: 'active',
            createdAt: profile?.createdAt || Date.now()
        };

        try {
            await setDoc(doc(db, 'collaborators', user.uid), newProfile);
            setProfile(newProfile);
            setIsEditing(false);
            localStorage.setItem('referral_id', referralCode);
        } catch (error) {
            console.error("Registration/Update error:", error);
            alert("Lỗi khi lưu thông tin. Vui lòng thử lại.");
        }
    };

    const handleLogout = () => signOut(auth);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luvin-pink"></div></div>;

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                    <div className="text-center mb-8">
                        <Logo className="h-12 mx-auto mb-6" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cổng Cộng Tác Viên</h1>
                        <p className="text-gray-500">
                            {authMode === 'login' ? 'Đăng nhập để bắt đầu kiếm thu nhập' : 'Đăng ký tài khoản CTV mới'}
                        </p>
                    </div>

                    <form onSubmit={authMode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                            <input 
                                type="email" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={authEmail}
                                onChange={e => setAuthEmail(e.target.value)}
                                placeholder="example@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mật khẩu</label>
                            <input 
                                type="password" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={authPassword}
                                onChange={e => setAuthPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        {authError && (
                            <p className="text-red-500 text-sm font-medium text-center">{authError}</p>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-luvin-pink text-white py-3 rounded-xl font-bold hover:bg-luvin-pink/90 transition-all shadow-lg shadow-luvin-pink/20"
                        >
                            {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button 
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                setAuthError('');
                            }}
                            className="text-luvin-pink text-sm font-bold hover:underline"
                        >
                            {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile || isEditing) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                        {profile ? 'Cập nhật thông tin' : 'Đăng ký Cộng Tác Viên'}
                    </h1>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Họ và tên</label>
                            <input 
                                type="text" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={formData.fullName}
                                onChange={e => setFormData({...formData, fullName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Số điện thoại (Mã giới thiệu)</label>
                            <input 
                                type="tel" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Thông tin nhận thanh toán</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tên ngân hàng</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ví dụ: MB Bank, Techcombank..."
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none text-sm"
                                        value={formData.bankName}
                                        onChange={e => setFormData({...formData, bankName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Số tài khoản</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none text-sm font-mono"
                                        value={formData.bankAccount}
                                        onChange={e => setFormData({...formData, bankAccount: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Chủ tài khoản</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none text-sm uppercase"
                                        value={formData.bankOwner}
                                        onChange={e => setFormData({...formData, bankOwner: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            {profile && (
                                <button 
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                                >
                                    Hủy
                                </button>
                            )}
                            <button 
                                type="submit"
                                className="flex-[2] bg-luvin-pink text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition-all shadow-lg"
                            >
                                {profile ? 'Lưu thay đổi' : 'Hoàn tất đăng ký'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    const referralLink = `${window.location.origin}/builder/3?ref=${profile.referralCode}`;

    const COMMISSION_RATE = 0.1; // 10% commission

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chào, {profile.fullName}!</h1>
                        <div className="flex items-center gap-3">
                            <p className="text-gray-500">Mã CTV: <span className="font-bold text-luvin-pink">{profile.referralCode}</span></p>
                            <button onClick={() => setIsEditing(true)} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-200 font-bold">Sửa hồ sơ</button>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 font-medium">Đăng xuất</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">Tổng đơn</p>
                        <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">Thành công</p>
                        <p className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'Đã giao hàng').length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">Doanh số</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng').reduce((sum, o) => sum + o.totalPrice, 0), 'payment')}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-luvin-pink/5 border-luvin-pink/20">
                        <p className="text-luvin-pink text-xs mb-1 uppercase font-bold">Hoa hồng (10%)</p>
                        <p className="text-2xl font-bold text-luvin-pink">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng').reduce((sum, o) => sum + (o.commissionAmount || o.totalPrice * COMMISSION_RATE), 0), 'payment')}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-orange-50 border-orange-200">
                        <p className="text-orange-700 text-xs mb-1 uppercase font-bold">Chưa thanh toán</p>
                        <p className="text-2xl font-bold text-orange-700">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng' && !o.commissionPaid).reduce((sum, o) => sum + (o.commissionAmount || o.totalPrice * COMMISSION_RATE), 0), 'payment')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h2 className="font-bold text-gray-900 mb-4">Link giới thiệu của bạn</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            readOnly 
                            value={referralLink}
                            className="flex-grow p-3 bg-gray-50 border rounded-xl font-mono text-sm"
                        />
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(referralLink);
                                alert("Đã copy link!");
                            }}
                            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all"
                        >
                            Copy Link
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 italic">* Gửi link này cho bạn bè, khi họ mua hàng bạn sẽ được ghi nhận doanh số.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900">Lịch sử đơn hàng giới thiệu</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4">Mã đơn</th>
                                    <th className="px-6 py-4">Ngày đặt</th>
                                    <th className="px-6 py-4">Khách hàng</th>
                                    <th className="px-6 py-4">Giá trị</th>
                                    <th className="px-6 py-4">Hoa hồng</th>
                                    <th className="px-6 py-4">Trạng thái</th>
                                    <th className="px-6 py-4">Thanh toán</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Chưa có đơn hàng nào được giới thiệu.</td>
                                    </tr>
                                ) : orders.map(order => (
                                    <tr key={order.id} className="text-sm">
                                        <td className="px-6 py-4 font-mono font-bold">{order.id}</td>
                                        <td className="px-6 py-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                                        <td className="px-6 py-4">{order.customer.name}</td>
                                        <td className="px-6 py-4 font-bold">{formatCurrency(order.totalPrice, 'payment')}</td>
                                        <td className="px-6 py-4 text-luvin-pink font-bold">
                                            {formatCurrency(order.commissionAmount || order.totalPrice * COMMISSION_RATE, 'payment')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-700' :
                                                order.status === 'Huỷ đơn' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.status === 'Đã giao hàng' ? (
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    order.commissionPaid ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {order.commissionPaid ? 'Đã trả' : 'Chờ trả'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-[10px]">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CollaboratorPage;
