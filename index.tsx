import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { QuickSelectionPage } from './pages/QuickSelectionPage';
import { AdminSelectionCodePage } from './pages/AdminSelectionCodePage';

import { LanguageProvider } from './src/contexts/LanguageContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isQuickSelectionPath = normalizedPath === '/chon-nhan-vat' || normalizedPath === '/select';
const isAdminSelectionCodePath = normalizedPath === '/admin/selection-code';


const AdminSelectionShortcut: React.FC = () => {
  const location = useLocation();
  if (!location.pathname.startsWith('/admin') || location.pathname === '/admin/selection-code') return null;
  return (
    <a
      href="/admin/selection-code"
      className="fixed bottom-4 right-4 z-[90] rounded-2xl bg-gray-900 px-4 py-3 text-xs font-extrabold text-white shadow-xl shadow-black/20 transition hover:bg-black active:scale-95"
    >
      Đọc mã khách
    </a>
  );
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        {isQuickSelectionPath ? <QuickSelectionPage /> : isAdminSelectionCodePath ? <AdminSelectionCodePage /> : <>
          <App />
          <AdminSelectionShortcut />
        </>}
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
