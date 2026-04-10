
import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut 
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

const CollaboratorPage: React.FC = () => {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({ phone: '', fullName: '' });

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
            const q = query(
                collection(db, 'orders'), 
                where('referredBy', '==', refCode),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const ordersData: Order[] = [];
            querySnapshot.forEach((doc) => {
                ordersData.push(doc.data() as Order);
            });
            setOrders(ordersData);
        } catch (error) {
            console.error("Error fetching orders:", error);
        }
    };

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login error:", error);
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
            referralCode,
            status: 'active',
            createdAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'collaborators', user.uid), newProfile);
            setProfile(newProfile);
            localStorage.setItem('referral_id', referralCode);
        } catch (error) {
            console.error("Registration error:", error);
            alert("Lỗi khi đăng ký. Vui lòng thử lại.");
        }
    };

    const handleLogout = () => signOut(auth);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luvin-pink"></div></div>;

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <Logo className="h-12 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Cổng Cộng Tác Viên</h1>
                    <p className="text-gray-500 mb-8">Đăng nhập để bắt đầu kiếm thu nhập cùng The Luvin</p>
                    <button 
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-6 h-6" alt="Google" />
                        Đăng nhập với Google
                    </button>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Đăng ký Cộng Tác Viên</h1>
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
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Số điện thoại (Dùng làm mã giới thiệu)</label>
                            <input 
                                type="tel" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-luvin-pink text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition-all shadow-lg"
                        >
                            Hoàn tất đăng ký
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const referralLink = `${window.location.origin}/studio?ref=${profile.referralCode}`;

    const COMMISSION_RATE = 0.1; // 10% commission

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chào, {profile.fullName}!</h1>
                        <p className="text-gray-500">Mã CTV: <span className="font-bold text-luvin-pink">{profile.referralCode}</span></p>
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
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng').reduce((sum, o) => sum + o.totalPrice, 0))}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-luvin-pink/5 border-luvin-pink/20">
                        <p className="text-luvin-pink text-xs mb-1 uppercase font-bold">Hoa hồng (10%)</p>
                        <p className="text-2xl font-bold text-luvin-pink">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng').reduce((sum, o) => sum + (o.totalPrice * COMMISSION_RATE), 0))}
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
                                    <th className="px-6 py-4">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Chưa có đơn hàng nào được giới thiệu.</td>
                                    </tr>
                                ) : orders.map(order => (
                                    <tr key={order.id} className="text-sm">
                                        <td className="px-6 py-4 font-mono font-bold">{order.id}</td>
                                        <td className="px-6 py-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                                        <td className="px-6 py-4">{order.customer.name}</td>
                                        <td className="px-6 py-4 font-bold">{formatCurrency(order.totalPrice)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-700' :
                                                order.status === 'Huỷ đơn' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {order.status}
                                            </span>
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
