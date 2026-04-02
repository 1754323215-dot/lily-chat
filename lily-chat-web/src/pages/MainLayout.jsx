import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearStoredAuth } from '../apiClient';
import { useUnread } from '../contexts/UnreadContext';
import { pickLastViewedUserId } from '../utils/chatSession';

export default function MainLayout() {
  const navigate = useNavigate();
  const {
    totalUnread,
    pendingQuestionNotice,
    setPendingQuestionNotice,
    pendingQuestions,
    contacts,
  } = useUnread();

  const badgeText =
    totalUnread > 99 ? '99+' : totalUnread > 0 ? String(totalUnread) : '';
  const latestPending = pendingQuestions && pendingQuestions.length > 0 ? pendingQuestions[0] : null;
  const visiblePendingNotice = pendingQuestionNotice || (latestPending
    ? {
        userId: latestPending.fromUserId || latestPending.fromUser,
        userName: latestPending.fromUserName || '用户',
        price: latestPending.price,
      }
    : null);

  const handlePendingQuestionClick = () => {
    const last = pickLastViewedUserId(contacts || []);
    const fallback = visiblePendingNotice?.userId;
    const target = last || fallback;
    if (!target) return;
    navigate(`/chats/${target}?tab=questions`);
    if (pendingQuestionNotice) {
      setPendingQuestionNotice(null);
    }
  };

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
            <NavLink
              to="/feedback"
              className={({ isActive }) =>
                'app-nav-link' + (isActive ? ' active' : '')
              }
            >
              意见反馈
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
        {visiblePendingNotice && (
          <div className="chat-pending-notice" role="button" tabIndex={0} onClick={handlePendingQuestionClick} onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handlePendingQuestionClick();
          }}>
            <span>
              {pendingQuestions?.length > 1
                ? `您有 ${pendingQuestions.length} 个待处理提问`
                : `新提问：${visiblePendingNotice.userName || '用户'} 向您提问${visiblePendingNotice.price ? `（¥${visiblePendingNotice.price}）` : ''}`}
            </span>
            <span className="chat-pending-notice-action">查看</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
