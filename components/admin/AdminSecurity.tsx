
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { getAllSessions, revokeSession, deleteSession } from '../../services/adminSessionService';
import { Shield, Ban, Clock, User, Globe, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminSecurityProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

export const AdminSecurity: React.FC<AdminSecurityProps> = ({ showToast }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time audit logs
    const logsQuery = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Audit Logs monitor error:", error);
    });

    // Sessions (Refreshable)
    fetchSessions();

    return () => unsubLogs();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getAllSessions();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn thu hồi phiên đăng nhập này? Người dùng sẽ bị đăng xuất ngay lập tức.")) return;
    try {
      await revokeSession(sessionId);
      if (showToast) showToast("Đã thu hồi phiên đăng nhập.", 'success');
      fetchSessions();
    } catch (error) {
      if (showToast) showToast("Lỗi khi thu hồi.", 'error');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
      try {
          await deleteSession(sessionId);
          setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      } catch (e) {}
  };

  const formatDate = (ts: any) => {
    if (!ts) return '---';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return date.toLocaleString('vi-VN');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Giám sát Bảo mật & Nhật ký
          </h2>
          <p className="text-gray-500">Quản lý các phiên đăng nhập và theo dõi thay đổi hệ thống.</p>
        </div>
        <button 
          onClick={fetchSessions}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Clock className="w-4 h-4" /> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold flex items-center gap-2">
                <User className="w-4 h-4" /> Phiên đăng nhập Admin
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Đang tải...</div>
              ) : sessions.map((session) => (
                <div key={session.sessionId} className={`p-4 hover:bg-gray-50 transition-colors ${session.isRevoked ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm truncate max-w-[150px]">{session.email}</span>
                    {session.isRevoked ? (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded-full font-bold uppercase">Bị thu hồi</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase">Đang hoạt động</span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 mb-3">
                    <p className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.userAgent.substring(0, 40)}...</p>
                    <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(session.lastActive)}</p>
                    <p className="font-mono text-[9px]">{session.sessionId}</p>
                  </div>
                  {!session.isRevoked && (
                    <button 
                      onClick={() => handleRevoke(session.sessionId)}
                      className="w-full py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Ban className="w-3 h-3" /> Kích tài khoản
                    </button>
                  )}
                  {session.isRevoked && (
                      <button 
                        onClick={() => handleDeleteSession(session.sessionId)}
                        className="w-full mt-2 py-1 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded text-[10px] transition-colors"
                      >
                          Xóa bản ghi
                      </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Logs Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Nhật ký thay đổi (Audit Logs)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Hành động</th>
                    <th className="px-4 py-3">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-xs">{log.adminEmail}</div>
                        <div className="text-[9px] text-gray-400 font-mono italic">{log.adminUid}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.action.includes('delete') ? 'bg-red-100 text-red-700' :
                          log.action.includes('create') ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <span className="text-gray-400">[{log.entityType}]</span> {log.entityId}
                        </div>
                        {log.details && (
                          <pre className="mt-1 text-[9px] bg-gray-50 p-1 rounded max-w-[300px] overflow-hidden truncate">
                            {JSON.stringify(log.details)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                      <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">Chưa có bản ghi nào.</td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
