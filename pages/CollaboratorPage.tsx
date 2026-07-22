
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
import { Order, SavedDesign } from '../types';
import { getCTVDesigns, deleteCTVDesign } from '../services/shareService';
import { useNavigate } from 'react-router-dom';
import { safeJsonStringify } from '../utils/helpers';

enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    let providerInfo: any[] = [];
    try {
        if (auth.currentUser?.providerData) {
            providerInfo = auth.currentUser.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            }));
        }
    } catch (e) {
        console.error("Error reading providerData:", e);
    }

    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            providerInfo
        },
        operationType,
        path
    };

    try {
        console.error('Firestore Error: ', safeJsonStringify(errInfo));
    } catch (e) {
        console.error('Firestore Error (Unserializable): ', errInfo.error);
    }
    return errInfo;
};

const CollaboratorPage: React.FC = () => {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [designs, setDesigns] = useState<SavedDesign[]>([]);
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
                await Promise.all([
                    fetchOrders(data.referralCode),
                    fetchDesigns(uid)
                ]);
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

    const fetchDesigns = async (uid: string) => {
        const data = await getCTVDesigns(uid);
        setDesigns(data);
    };

    const handleDeleteDesign = async (id: string) => {
        if (confirm(t('collaborator.confirm_delete_design'))) {
            const success = await deleteCTVDesign(id, auth.currentUser?.uid);
            if (success) {
                setDesigns(prev => prev.filter(d => d.id !== id));
            }
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
                setAuthError(t('collaborator.email_or_password_incorrect') || 'Email hoặc mật khẩu không chính xác');
            } else if (error.code === 'auth/invalid-email') {
                setAuthError(t('collaborator.invalid_email') || 'Email không hợp lệ');
            } else {
                setAuthError(t('collaborator.login_error') || 'Lỗi đăng nhập. Vui lòng thử lại.');
            }
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        if (authPassword.length < 6) {
            return setAuthError(t('collaborator.password_min_length') || 'Mật khẩu phải có ít nhất 6 ký tự');
        }
        try {
            await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        } catch (error: any) {
            console.error("Signup error:", error);
            if (error.code === 'auth/email-already-in-use') {
                setAuthError(t('collaborator.email_in_use') || 'Email này đã được sử dụng');
            } else if (error.code === 'auth/invalid-email') {
                setAuthError(t('collaborator.invalid_email') || 'Email không hợp lệ');
            } else {
                setAuthError(t('collaborator.signup_error') || 'Lỗi đăng ký. Vui lòng thử lại.');
            }
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.phone || !formData.fullName) return alert(t('collaborator.required_fields') || "Vui lòng điền đầy đủ thông tin");

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
            status: 'pending',
            createdAt: profile?.createdAt || Date.now()
        };

        try {
            await setDoc(doc(db, 'collaborators', user.uid), newProfile);
            setProfile(newProfile);
            setIsEditing(false);
            localStorage.setItem('referral_id', referralCode);
        } catch (error) {
            console.error("Registration/Update error:", error);
            alert(t('collaborator.save_error') || "Lỗi khi lưu thông tin. Vui lòng thử lại.");
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
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('collaborator.title')}</h1>
                        <p className="text-gray-500">
                            {authMode === 'login' ? t('collaborator.login_subtitle') : t('collaborator.signup_subtitle')}
                        </p>
                    </div>

                    <form onSubmit={authMode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('collaborator.email')}</label>
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
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('collaborator.password')}</label>
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
                            {authMode === 'login' ? t('collaborator.login') : t('collaborator.signup')}
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
                            {authMode === 'login' ? t('collaborator.no_account') : t('collaborator.has_account')}
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
                        {profile ? t('collaborator.update_title') : t('collaborator.register_title')}
                    </h1>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('collaborator.full_name')}</label>
                            <input 
                                type="text" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={formData.fullName}
                                onChange={e => setFormData({...formData, fullName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('collaborator.phone')}</label>
                            <input 
                                type="tel" 
                                required
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none"
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3">{t('collaborator.payment_info')}</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('collaborator.bank_name')}</label>
                                    <input 
                                        type="text" 
                                        placeholder={t('collaborator.bank_name_placeholder') || "Ví dụ: MB Bank, Techcombank..."}
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none text-sm"
                                        value={formData.bankName}
                                        onChange={e => setFormData({...formData, bankName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('collaborator.bank_account')}</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-luvin-pink outline-none text-sm font-mono"
                                        value={formData.bankAccount}
                                        onChange={e => setFormData({...formData, bankAccount: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('collaborator.bank_owner')}</label>
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
                                    {t('collaborator.cancel')}
                                </button>
                            )}
                            <button 
                                type="submit"
                                className="flex-[2] bg-luvin-pink text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition-all shadow-lg"
                            >
                                {profile ? t('collaborator.save_changes') : t('collaborator.complete_register')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    if (profile.status === 'pending') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('collaborator.pending_title')}</h1>
                    <p className="text-gray-600 mb-8">
                        {t('collaborator.pending_desc')}
                    </p>
                    <button onClick={handleLogout} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                        {t('collaborator.logout')}
                    </button>
                </div>
            </div>
        );
    }

    if (profile.status === 'suspended') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('collaborator.suspended_title')}</h1>
                    <p className="text-gray-600 mb-8">
                        {t('collaborator.suspended_desc')}
                    </p>
                    <button onClick={handleLogout} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                        {t('collaborator.logout')}
                    </button>
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
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('collaborator.hello', { name: profile.fullName })}</h1>
                        <div className="flex items-center gap-3">
                            <p className="text-gray-500">{t('collaborator.ref_code', { code: profile.referralCode })}</p>
                            <button onClick={() => setIsEditing(true)} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-200 font-bold">{t('collaborator.edit_profile')}</button>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 font-medium">{t('collaborator.logout')}</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">{t('collaborator.total_orders')}</p>
                        <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">{t('collaborator.successful')}</p>
                        <p className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'Đã giao hàng').length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">{t('collaborator.sales')}</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng').reduce((sum, o) => sum + o.totalPrice, 0), 'payment')}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-luvin-pink/5 border-luvin-pink/20">
                        <p className="text-luvin-pink text-xs mb-1 uppercase font-bold">{t('collaborator.total_commission')}</p>
                        <p className="text-2xl font-bold text-luvin-pink">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng').reduce((sum, o) => {
                                if (o.commissionAmount !== undefined) return sum + o.commissionAmount;
                                const rate = profile.customCommissionRate !== undefined ? profile.customCommissionRate / 100 : (orders.filter(ord => ord.status === 'Đã giao hàng').length < 2 ? 0.05 : 0.1);
                                return sum + Math.round(o.totalPrice * rate);
                            }, 0), 'payment')}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-orange-50 border-orange-200">
                        <p className="text-orange-700 text-xs mb-1 uppercase font-bold">{t('collaborator.unpaid')}</p>
                        <p className="text-2xl font-bold text-orange-700">
                            {formatCurrency(orders.filter(o => o.status === 'Đã giao hàng' && !o.commissionPaid).reduce((sum, o) => {
                                if (o.commissionAmount !== undefined) return sum + o.commissionAmount;
                                const rate = profile.customCommissionRate !== undefined ? profile.customCommissionRate / 100 : (orders.filter(ord => ord.status === 'Đã giao hàng').length < 2 ? 0.05 : 0.1);
                                return sum + Math.round(o.totalPrice * rate);
                            }, 0), 'payment')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h2 className="font-bold text-gray-900 mb-4">{t('collaborator.policy_title')}</h2>
                    {profile.customCommissionRate !== undefined ? (
                        <div className="p-4 rounded-xl bg-luvin-pink/5 border border-luvin-pink/20">
                            <p className="text-luvin-pink font-bold text-sm mb-1">{t('collaborator.custom_rate', { rate: profile.customCommissionRate })}</p>
                            <p className="text-gray-600 text-xs">{t('collaborator.custom_rate_desc')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                                <p className="text-blue-800 font-bold text-sm mb-1">{t('collaborator.level1_title')}</p>
                                <p className="text-blue-600 text-xs">{t('collaborator.level1_desc')}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                                <p className="text-green-800 font-bold text-sm mb-1">{t('collaborator.level2_title')}</p>
                                <p className="text-green-600 text-xs">{t('collaborator.level2_desc')}</p>
                            </div>
                        </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-4 italic">{t('collaborator.policy_note')}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h2 className="font-bold text-gray-900 mb-4">{t('collaborator.referral_link_title')}</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            readOnly 
                            value={referralLink}
                            className="flex-grow p-3 bg-gray-50 border rounded-xl font-mono text-sm"
                        />
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(referralLink);
                                alert(t('collaborator.copy_success') || "Đã copy link!");
                            }}
                            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all"
                        >
                            {t('collaborator.copy_link')}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 italic">{t('collaborator.referral_link_note')}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-bold text-gray-900">{t('collaborator.your_designs')}</h2>
                        <button 
                            onClick={() => navigate(`/builder/1?ref=${profile.referralCode}`)}
                            className="bg-luvin-pink text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-pink-600 transition-all shadow-sm"
                        >
                            {t('collaborator.create_new_design')}
                        </button>
                    </div>
                    
                    {designs.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-400 text-sm">{t('collaborator.no_designs')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {designs.map(design => (
                                <div key={design.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-800 truncate pr-2">{design.name}</h3>
                                        <button 
                                            onClick={() => handleDeleteDesign(design.id)}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mb-4">{new Date(design.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                const url = `${window.location.origin}/builder/3?design=${design.id}&ref=${profile.referralCode}`;
                                                navigator.clipboard.writeText(url);
                                                alert(t('collaborator.copy_design_link_success') || "Đã copy link thiết kế!");
                                            }}
                                            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-xs font-bold hover:bg-black transition-all"
                                        >
                                            {t('collaborator.copy_link')}
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/builder/3?design=${design.id}&ref=${profile.referralCode}`)}
                                            className="px-3 bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all"
                                        >
                                            {t('collaborator.view')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900">{t('collaborator.referred_orders_history')}</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4">{t('collaborator.order_id')}</th>
                                    <th className="px-6 py-4">{t('collaborator.order_date')}</th>
                                    <th className="px-6 py-4">{t('collaborator.customer')}</th>
                                    <th className="px-6 py-4">{t('collaborator.value')}</th>
                                    <th className="px-6 py-4">{t('collaborator.commission')}</th>
                                    <th className="px-6 py-4">{t('collaborator.status')}</th>
                                    <th className="px-6 py-4">{t('collaborator.payment')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-400">{t('collaborator.no_referred_orders')}</td>
                                    </tr>
                                ) : orders.map(order => (
                                    <tr key={order.id} className="text-sm">
                                        <td className="px-6 py-4 font-mono font-bold">{order.id}</td>
                                        <td className="px-6 py-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</td>
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
                                                {order.status === 'Đã giao hàng' ? t('collaborator.delivered') : 
                                                 order.status === 'Huỷ đơn' ? t('collaborator.cancelled') : 
                                                 t('collaborator.processing')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.status === 'Đã giao hàng' ? (
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    order.commissionPaid ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {order.commissionPaid ? t('collaborator.paid') : t('collaborator.unpaid_status')}
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
