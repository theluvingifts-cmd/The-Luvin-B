
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
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-96 text-center">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                <p className="text-gray-500 mb-8 text-sm">
                    Vui lòng đăng nhập để tiếp tục
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                        <input type="email" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mật khẩu</label>
                        <input type="password" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                    </div>
                    {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-gray-900 text-white font-bold py-2.5 rounded hover:bg-black transition-colors mt-4 disabled:opacity-50"
                    >
                        {isLoading ? "Đang xử lý..." : "Đăng nhập"}
                    </button>
                </form>
            </div>
        </div>
    );
};
