
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';

export const AdminLogin: React.FC = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, loginPass);
            } else {
                await signInWithEmailAndPassword(auth, email, loginPass);
            }
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                setLoginError("Email này đã được đăng ký. Vui lòng đăng nhập.");
            } else if (error.code === 'auth/weak-password') {
                setLoginError("Mật khẩu quá yếu (tối thiểu 6 ký tự).");
            } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setLoginError("Thông tin đăng nhập không chính xác.");
            } else {
                setLoginError("Đã có lỗi xảy ra: " + error.message);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-96 text-center">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                <p className="text-gray-500 mb-6 text-sm">
                    {isRegistering ? "Tạo tài khoản nhân viên mới" : "Vui lòng đăng nhập để tiếp tục"}
                </p>
                
                <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                    <button 
                        onClick={() => { setIsRegistering(false); setLoginError(''); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${!isRegistering ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Đăng nhập
                    </button>
                    <button 
                        onClick={() => { setIsRegistering(true); setLoginError(''); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${isRegistering ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Đăng ký
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                        <input type="email" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{isRegistering ? 'Tạo Mật khẩu' : 'Mật khẩu'}</label>
                        <input type="password" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                    </div>
                    {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
                    <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2.5 rounded hover:bg-black transition-colors mt-4">
                        {isRegistering ? "Đăng ký tài khoản" : "Đăng nhập"}
                    </button>
                </form>
                {isRegistering && (
                    <p className="text-xs text-gray-400 mt-4 italic">
                        * Chỉ email đã được Admin thêm vào danh sách Cấu hình mới có quyền truy cập sau khi đăng ký.
                    </p>
                )}
            </div>
        </div>
    );
};
