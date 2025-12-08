
import React from 'react';

export const AdminDesign: React.FC = () => {
    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Studio Design</h2>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Quản lý Thiết kế Studio</h3>
                <p className="text-gray-500 text-sm max-w-md text-center">
                    Trang này sẽ được sử dụng để quản lý các mẫu thiết kế và layout của Studio.
                </p>
            </div>
        </div>
    );
};
