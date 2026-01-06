
import React, { useState, useEffect } from 'react';
// Fix: Use modular imports for Firebase v9+
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Logo } from '../shared/Logo';
import { getStoreConfig } from '../../services/configService';

export const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        getStoreConfig().then(cfg => {
            if (cfg?.logoUrl) setLogoUrl(cfg.logoUrl);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, loginPass);
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setLoginError("Thông tin đăng nhập không chính xác.");
            } else if (error.code === 'auth/too-many-requests') {
                setLoginError("Quá nhiều lần thử sai. Vui lòng thử lại sau.");
            } else {
                setLoginError("Đã có lỗi xảy ra: " + error.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md text-center">
                <div className="mb-6">
                    <Logo 
                        url={logoUrl} 
                        className="h-16 mx-auto" 
                        textClassName="text-3xl"
                    />
                    <div className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Hệ thống Quản trị
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Email quản trị</label>
                        <input 
                            type="email" 
                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-all" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                            placeholder="admin@theluvin.com"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Mật khẩu</label>
                        <input 
                            type="password" 
                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-all" 
                            value={loginPass} 
                            onChange={e => setLoginPass(e.target.value)} 
                            required 
                            placeholder="••••••••"
                        />
                    </div>
                    {loginError && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-xs font-bold animate-shake">
                            ⚠️ {loginError}
                        </div>
                    )}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-black transition-all mt-4 disabled:opacity-50 shadow-lg shadow-gray-200 active:scale-95"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Đang xác thực...</span>
                            </div>
                        ) : "ĐĂNG NHẬP HỆ THỐNG"}
                    </button>
                </form>
                
                <p className="mt-8 text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                    The Luvin Boutique &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
};
