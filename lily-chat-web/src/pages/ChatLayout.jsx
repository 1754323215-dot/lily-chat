import React, { useEffect, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useLocation, useParams } from 'react-router-dom';
import { api, getStoredAuth } from '../apiClient';
import { useUnread } from '../contexts/UnreadContext';

function showBrowserNotification(title, options = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body: options.body || '', icon: options.icon || undefined });
  } catch (_) {}
}

function ChatList({ contacts, loading, error, onSelect, activeUserId }) {
  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>会话</h2>
      </div>
      <div className="chat-sidebar-body">
        {loading && <div className="hint-text">加载中…</div>}
        {!loading && error && (
          <div className="chat-sidebar-error">
            <span className="hint-text">{error}</span>
          </div>
        )}
        {!loading && !error && contacts.length === 0 && (
          <div className="hint-text">暂时没有会话</div>
        )}
        {contacts.map((c) => (
          <button
            key={c.id}
            className={
              'chat-contact' +
              (activeUserId === c.id ? ' chat-contact-active' : '') +
              (c.unreadCount > 0 ? ' chat-contact-has-unread' : '')
            }
            onClick={() => onSelect(c)}
          >
            <div className="chat-contact-avatar">
              <img src={c.avatar} alt={c.username} />
            </div>
            <div className="chat-contact-main">
              <div className="chat-contact-row">
                <span className="chat-contact-name">{c.username}</span>
                {c.lastTime && (
                  <span className="chat-contact-time">
                    {new Date(c.lastTime).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="chat-contact-row">
                <span className="chat-contact-last">{c.lastMessage || '暂无消息'}</span>
                {c.unreadCount > 0 && (
                  <span className="chat-contact-unread">{c.unreadCount}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatDetail() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [latestQuestion, setLatestQuestion] = useState(null);
  const { refetchContacts, notificationPreference, contacts } = useUnread();
  const lastNotifiedMessageIdRef = useRef(null);
  const lastNotifiedQuestionIdRef = useRef(null);
  const prevMessageCountRef = useRef(0);

  const currentUserId = getStoredAuth().user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [data, qData] = await Promise.all([
          api.getConversationWithUser(userId),
          api.getConversationQuestions(userId).catch(() => null),
        ]);
        if (!cancelled) {
          const myId = currentUserId || '';
          const newMessages = Array.isArray(data.messages)
            ? data.messages.map((m) => {
                const sid = m.senderId?._id?.toString?.() || m.senderId?.toString?.() || '';
                return {
                  id: m._id,
                  content: m.content,
                  isMe: sid === myId,
                  createdAt: m.createdAt,
                };
              })
            : [];
          const prevCount = prevMessageCountRef.current;
          prevMessageCountRef.current = newMessages.length;
          const useNotif =
            notificationPreference === 'notification' &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.hidden;
          if (useNotif && newMessages.length > prevCount && newMessages.length > 0) {
            const last = newMessages[newMessages.length - 1];
            if (!last.isMe && last.id !== lastNotifiedMessageIdRef.current) {
              lastNotifiedMessageIdRef.current = last.id;
              const contact = contacts.find((c) => c.id === userId);
              const contactName = contact?.username || contact?.name || '对方';
              showBrowserNotification(`${contactName} 发来新消息`, {
                body: (last.content || '').slice(0, 80) + ((last.content || '').length > 80 ? '…' : ''),
              });
            }
          }
          setMessages(newMessages);

          let newLatest = null;
          if (qData && Array.isArray(qData.questions) && qData.questions.length > 0) {
            newLatest = qData.questions[qData.questions.length - 1];
          }
          const isAnswerer =
            newLatest &&
            (newLatest.answererId?._id === currentUserId || newLatest.answererId === currentUserId);
          if (
            useNotif &&
            newLatest &&
            newLatest.status === 'pending' &&
            isAnswerer &&
            newLatest._id !== lastNotifiedQuestionIdRef.current
          ) {
            lastNotifiedQuestionIdRef.current = newLatest._id;
            showBrowserNotification('新提问', {
              body: (newLatest.content || '').slice(0, 80) + ((newLatest.content || '').length > 80 ? '…' : ''),
            });
          }
          setLatestQuestion(newLatest);
          refetchContacts();
        }
      } catch (err) {
        if (!cancelled) setError(err.message || '加载消息失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId, currentUserId, refetchContacts, notificationPreference, contacts]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    try {
      const resp = await api.sendMessage(userId, content);
      const newMsg = resp?.data;
      setMessages((prev) => [
        ...prev,
        {
          id: newMsg?._id,
          content: newMsg?.content || content,
          isMe: true,
          createdAt: newMsg?.createdAt || new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err.message || '发送失败');
    }
  };

  const handleAcceptQuestion = async () => {
    if (!latestQuestion?._id) return;
    try {
      await api.acceptQuestion(latestQuestion._id);
      const updated = await api.getConversationQuestions(userId);
      if (Array.isArray(updated.questions) && updated.questions.length > 0) {
        setLatestQuestion(updated.questions[updated.questions.length - 1]);
      }
    } catch (err) {
      setError(err.message || '接受提问失败');
    }
  };

  const handleRejectQuestion = async () => {
    if (!latestQuestion?._id) return;
    try {
      await api.rejectQuestion(latestQuestion._id);
      const updated = await api.getConversationQuestions(userId);
      if (Array.isArray(updated.questions) && updated.questions.length > 0) {
        setLatestQuestion(updated.questions[updated.questions.length - 1]);
      } else {
        setLatestQuestion(null);
      }
    } catch (err) {
      setError(err.message || '拒绝提问失败');
    }
  };

  const handleConfirmPaid = async () => {
    if (!latestQuestion?._id) return;
    try {
      await api.confirmQuestionPayment(latestQuestion._id);
      const updated = await api.getConversationQuestions(userId);
      if (Array.isArray(updated.questions) && updated.questions.length > 0) {
        setLatestQuestion(updated.questions[updated.questions.length - 1]);
      }
    } catch (err) {
      setError(err.message || '记录订单失败');
    }
  };

  if (!userId) {
    return <div className="hint-text">请选择左侧联系人开始聊天</div>;
  }

  const q = latestQuestion;
  const isAsker =
    q && (q.askerId?._id === currentUserId || q.askerId === currentUserId);
  const isAnswerer =
    q && (q.answererId?._id === currentUserId || q.answererId === currentUserId);

  return (
    <div className="chat-main">
      <div className="chat-main-header">
        <div>
          <h2 className="chat-main-title">对话</h2>
        </div>
      </div>

      <div className="chat-main-body">
        {q && (
          <div className="question-banner">
            <div className="question-banner-main">
              <div className="question-banner-title">
                悬赏提问 · ¥{q.price}
              </div>
              <div className="question-banner-content">{q.content}</div>
              <div className="question-banner-status">
                当前状态：{q.status === 'pending'
                  ? '等待对方选择'
                  : q.status === 'accepted'
                  ? '对方已接受，聊天中交流'
                  : q.status === 'completed'
                  ? '对方已解答'
                  : q.status === 'rejected'
                  ? '对方无法回答'
                  : q.status}
              </div>
            </div>
            <div className="question-banner-actions">
              {isAnswerer && q.status === 'pending' && (
                <>
                  <button
                    className="ghost-button"
                    onClick={handleAcceptQuestion}
                  >
                    我有能力回答
                  </button>
                  <button
                    className="ghost-button"
                    onClick={handleAcceptQuestion}
                  >
                    我愿意交流
                  </button>
                  <button
                    className="ghost-button"
                    onClick={handleRejectQuestion}
                  >
                    我不能回答
                  </button>
                </>
              )}
              {isAsker && q.status === 'completed' && !q.paid && (
                <button className="primary-button" onClick={handleConfirmPaid}>
                  对方已解答，记录这次订单
                </button>
              )}
            </div>
          </div>
        )}
        {loading && <div className="hint-text">加载中…</div>}
        {!loading && messages.length === 0 && (
          <div className="hint-text">还没有消息，先打个招呼吧～</div>
        )}
        <div className="chat-messages">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                'chat-message' + (m.isMe ? ' chat-message-me' : ' chat-message-other')
              }
            >
              <div className="chat-message-bubble">{m.content}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main-input">
        {error && <div className="field-error">{error}</div>}
        <div className="chat-input-row">
          <input
            className="field-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息内容…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button className="primary-button" onClick={handleSend}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeUserId = location.pathname.match(/\/chats\/([^/]+)/)?.[1] || null;
  const { contacts, contactsError } = useUnread();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contacts) setLoading(false);
  }, [contacts]);

  const handleSelectContact = (contact) => {
    navigate(`/chats/${contact.id}`);
  };

  return (
    <div className="chat-page">
      <div className="chat-layout">
        <ChatList
          contacts={contacts}
          loading={loading}
          error={contactsError}
          onSelect={handleSelectContact}
          activeUserId={activeUserId}
        />
        <div className="chat-main-wrapper">
          <Routes>
            <Route path=":userId" element={<ChatDetail />} />
            <Route
              path="*"
              element={<div className="hint-text">请选择左侧联系人开始聊天</div>}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

