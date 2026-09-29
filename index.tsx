import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { QuickSelectionPage } from './pages/QuickSelectionPage';

import { LanguageProvider } from './src/contexts/LanguageContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isQuickSelectionPath = normalizedPath === '/chon-nhan-vat' || normalizedPath === '/select';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        {isQuickSelectionPath ? <QuickSelectionPage /> : <App />}
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
