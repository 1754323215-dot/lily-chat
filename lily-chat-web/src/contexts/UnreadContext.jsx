import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, clearStoredAuth, getStoredAuth } from '../apiClient';

const UnreadContext = createContext(null);

function showBrowserNotification(title, options = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body: options.body || '', icon: options.icon || undefined });
  } catch (_) {}
}

export function UnreadProvider({ children }) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [contactsError, setContactsError] = useState('');
  const [notificationPreference, setNotificationPreference] = useState('inApp');
  const prevContactsRef = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();

  const refetchContacts = useCallback(async () => {
    setContactsError('');
    try {
      const data = await api.getContacts();
      const list = Array.isArray(data) ? data : [];
      setContacts(list);
      setTotalUnread(list.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
    } catch (err) {
      const msg = err?.message || '加载失败';
      if (msg.includes('未授权') || msg.includes('未登录')) {
        clearStoredAuth();
        navigate('/login', { replace: true, state: { from: location } });
      } else {
        setContactsError(msg);
      }
    }
  }, [navigate, location]);

  useEffect(() => {
    const me = getStoredAuth().user?.id || getStoredAuth().user?._id;
    if (!me) return;
    let cancelled = false;
    api.getUser(me).then((data) => {
      if (cancelled) return;
      const u = data.user || data;
      const pref = u.notificationPreference === 'notification' ? 'notification' : 'inApp';
      setNotificationPreference(pref);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const load = async () => {
      try {
        const data = await api.getContacts();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const prev = prevContactsRef.current;
        const useNotification =
          notificationPreference === 'notification' &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.hidden;
        if (useNotification && list.length > 0) {
          for (const c of list) {
            const old = prev.find((p) => p.id === c.id || p._id === c.id);
            const oldCount = old ? (old.unreadCount || 0) : 0;
            const newCount = c.unreadCount || 0;
            if (newCount > oldCount) {
              showBrowserNotification(`${c.username || c.name || '有人'} 发来新消息`, {
                body: c.lastMessage ? `${c.lastMessage.slice(0, 50)}${c.lastMessage.length > 50 ? '…' : ''}` : '您有新消息',
              });
            }
          }
        }
        prevContactsRef.current = list;
        setContacts(list);
        setTotalUnread(list.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
        setContactsError('');
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || '';
        if (msg.includes('未授权') || msg.includes('未登录')) {
          clearStoredAuth();
          navigate('/login', { replace: true, state: { from: location } });
        } else {
          setContactsError(msg);
        }
      }
    };

    load();
    timer = setInterval(load, 20000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [navigate, location, notificationPreference]);

  const value = {
    totalUnread,
    setTotalUnread,
    contacts,
    setContacts,
    contactsError,
    refetchContacts,
    notificationPreference,
    setNotificationPreference,
  };

  return (
    <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
  );
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) {
    throw new Error('useUnread must be used within UnreadProvider');
  }
  return ctx;
}

