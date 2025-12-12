
import React, { useState, useEffect } from 'react';
import { getLogs, AuditLog } from '../../services/logService';

export const AdminLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const data = await getLogs(100); // Get last 100 logs
        setLogs(data);
        setLoading(false);
    };

    const getActionColor = (action: string) => {
        switch(action) {
            case 'CREATE': return 'text-green-600 bg-green-50';
            case 'UPDATE': return 'text-blue-600 bg-blue-50';
            case 'DELETE': return 'text-red-600 bg-red-50';
            case 'IMPORT': return 'text-purple-600 bg-purple-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-140px)] flex flex-col animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">Nhật ký Hoạt động (Audit Logs)</h3>
                <button onClick={fetchLogs} className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="Làm mới">
                    <svg className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
            
            <div className="flex-grow overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 w-40">Thời gian</th>
                            <th className="px-6 py-3 w-32">Người dùng</th>
                            <th className="px-6 py-3 w-24">Hành động</th>
                            <th className="px-6 py-3 w-32">Đối tượng</th>
                            <th className="px-6 py-3">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.map((log, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                                </td>
                                <td className="px-6 py-3 font-medium text-gray-900 truncate max-w-[150px]" title={log.performedBy}>
                                    {log.performedBy}
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getActionColor(log.action)}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-gray-600">
                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs mr-1 uppercase">{log.targetCollection}</span>
                                    <span className="font-mono text-xs text-blue-600">{log.targetId}</span>
                                </td>
                                <td className="px-6 py-3 text-gray-600 truncate max-w-xs" title={log.details}>
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Chưa có nhật ký nào được ghi lại.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
