import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UnreadProvider } from './contexts/UnreadContext';
import { bootstrapAuth } from './apiClient';
import './index.css';

const rootEl = document.getElementById('root');

// 先尝试用 refreshToken 换新 access token，再挂载，避免首屏多请求同时 401
bootstrapAuth().finally(() => {
  ReactDOM.createRoot(rootEl).render(
    <BrowserRouter>
      <UnreadProvider>
        <App />
      </UnreadProvider>
    </BrowserRouter>
  );
});
