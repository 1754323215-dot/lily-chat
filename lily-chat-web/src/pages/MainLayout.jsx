import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearStoredAuth } from '../apiClient';
import { useUnread } from '../contexts/UnreadContext';

export default function MainLayout() {
  const navigate = useNavigate();
  const { totalUnread } = useUnread();

  const badgeText =
    totalUnread > 99 ? '99+' : totalUnread > 0 ? String(totalUnread) : '';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/chats" className="app-logo">
            <span className="app-logo-mark">L</span>
            <span className="app-logo-text">Lily Chat</span>
          </NavLink>
          <nav className="app-nav">
            <NavLink
              to="/map"
              className={({ isActive }) =>
                'app-nav-link' + (isActive ? ' active' : '')
              }
            >
              地图
            </NavLink>
            <NavLink
              to="/chats"
              className={({ isActive }) =>
                'app-nav-link' +
                (isActive ? ' active' : '') +
                (totalUnread > 0 ? ' has-unread' : '')
              }
            >
              <span>聊天</span>
              {badgeText && (
                <span className="app-nav-link-badge">{badgeText}</span>
              )}
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                'app-nav-link' + (isActive ? ' active' : '')
              }
            >
              个人主页
            </NavLink>
          </nav>
          <button
            className="ghost-button"
            onClick={() => {
              clearStoredAuth();
              navigate('/login', { replace: true });
            }}
          >
            退出登录
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
