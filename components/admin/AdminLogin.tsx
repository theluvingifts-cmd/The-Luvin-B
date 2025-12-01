
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';

export const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
                setLoginError("Quá nhiều lần thử thất bại. Vui lòng thử lại sau.");
            } else {
                setLoginError("Lỗi đăng nhập: " + error.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 w-96 text-center">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                    <p className="text-gray-500 text-sm">Hệ thống quản lý</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            placeholder="admin@theluvin.vn"
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu</label>
                        <input 
                            type="password" 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all" 
                            value={loginPass} 
                            onChange={e => setLoginPass(e.target.value)} 
                            placeholder="••••••••"
                            required 
                        />
                    </div>
                    
                    {loginError && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-start gap-2">
                            <span>⚠️</span>
                            <span>{loginError}</span>
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
                    >
                        {isLoading ? "Đang xử lý..." : "Đăng nhập"}
                    </button>
                </form>
                
                <p className="text-xs text-gray-400 mt-6 border-t pt-4">
                    Nếu quên mật khẩu, vui lòng liên hệ kỹ thuật viên.
                </p>
            </div>
        </div>
    );
};
