import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useLocation, useParams } from 'react-router-dom';
import { api, getStoredAuth, resolveUploadUrl } from '../apiClient';
import { useUnread } from '../contexts/UnreadContext';
import { getChatSession, recordChatView, sortContactsByLastViewed, pickLastViewedUserId } from '../utils/chatSession';

function showBrowserNotification(title, options = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body: options.body || '', icon: options.icon || undefined });
  } catch (_) {}
}

function normalizeQuestionId(qid) {
  if (qid == null || qid === '') return '';
  if (typeof qid === 'object' && qid._id != null) return String(qid._id);
  return String(qid);
}

/** 普通私信：无 questionId，且非提问类型系统消息 */
function isNormalChatMessage(m) {
  if (!m) return false;
  if (m.type === 'question') return false;
  if ((m.content || '').startsWith('付费提问：')) return false;
  if (normalizeQuestionId(m.questionId)) return false;
  return true;
}

function messageBelongsToQuestion(m, questionId) {
  if (!questionId) return false;
  return normalizeQuestionId(m.questionId) === normalizeQuestionId(questionId);
}

function previewQuestionLabel(content, maxLen = 22) {
  if (!content || typeof content !== 'string') return '…';
  const t = content.trim();
  if (!t) return '…';
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

function dicebearSvg(seed) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(seed || 'user'))}`;
}

function normalizeSystemMessage(content, isMe) {
  if (!content || typeof content !== 'string') return content || '';
  if (content === '已接受您的付费提问') {
    return isMe ? '您已接受对方的付费提问' : '对方已接受您的付费提问';
  }
  if (content === '已拒绝您的付费提问') {
    return isMe ? '您已拒绝对方的付费提问' : '对方已拒绝您的付费提问';
  }
  if (content.startsWith('已确认支付 ¥')) {
    return isMe ? content.replace('已确认支付', '您已确认支付') : content;
  }
  return content;
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
        {contacts.map((c) => {
          const cid = c.id || c._id;
          const profileId = cid != null && cid !== '' ? String(cid) : '';
          return (
            <div
              key={cid}
              className={
                'chat-contact' +
                (activeUserId === String(cid) ? ' chat-contact-active' : '') +
                (c.unreadCount > 0 ? ' chat-contact-has-unread' : '')
              }
            >
              <Link
                to={profileId ? `/profile/${encodeURIComponent(profileId)}` : '/profile'}
                className="chat-contact-avatar"
                aria-label={`查看 ${c.username || '用户'} 的资料`}
                title="查看资料"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <img src={c.avatar} alt="" draggable={false} />
              </Link>
              <div
                className="chat-contact-main"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(c);
                  }
                }}
              >
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatDetail() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [latestQuestion, setLatestQuestion] = useState(null);
  const [questionsList, setQuestionsList] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'questions'
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [payeeQRCode, setPayeeQRCode] = useState(null);
  const [payeeLoading, setPayeeLoading] = useState(false);
  const { refetchContacts, notificationPreference, contacts } = useUnread();
  const activeContact =
    userId && Array.isArray(contacts)
      ? contacts.find((c) => String(c.id || c._id) === String(userId))
      : null;
  const storedUser = getStoredAuth().user;
  const currentUserId = storedUser?.id || storedUser?._id;
  const currentUserAvatarUrl = storedUser?.avatar || dicebearSvg(storedUser?.username || storedUser?.name || 'me');
  const peerAvatarUrl = activeContact?.avatar || dicebearSvg(activeContact?.username || userId || 'user');
  const lastNotifiedMessageIdRef = useRef(null);
  const lastNotifiedQuestionIdRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const contactsRef = useRef(contacts);
  const refetchContactsRef = useRef(refetchContacts);
  const notificationPreferenceRef = useRef(notificationPreference);
  const messagesRef = useRef([]);
  contactsRef.current = contacts;
  refetchContactsRef.current = refetchContacts;
  notificationPreferenceRef.current = notificationPreference;
  messagesRef.current = messages;

  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const tab = search.get('tab');
    const qid = search.get('questionId');
    if (tab === 'questions') {
      setActiveTab('questions');
    } else if (tab === 'chat') {
      setActiveTab('chat');
    }
    if (qid) {
      setActiveQuestionId(qid);
    }
  }, [location.search, userId]);

  useEffect(() => {
    if (!questionsList.length) return;
    if (!activeQuestionId) {
      setActiveQuestionId(questionsList[0]._id || questionsList[0].id);
    }
  }, [questionsList, activeQuestionId]);

  useEffect(() => {
    if (!userId) return;
    initialLoadDoneRef.current = false;
    let cancelled = false;
    const load = async (isBackgroundRefresh = false, includeQuestions = true) => {
      if (!isBackgroundRefresh) setLoading(true);
      setError('');
      try {
        let since = null;
        if (isBackgroundRefresh && messagesRef.current && messagesRef.current.length > 0) {
          const last = messagesRef.current[messagesRef.current.length - 1];
          if (last && last.createdAt) {
            since = last.createdAt;
          }
        }

        const [data, qData] = await Promise.all([
          since
            ? api.getConversationWithUser(userId, { since })
            : api.getConversationWithUser(userId),
          includeQuestions
            ? api.getConversationQuestions(userId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          const myId = currentUserIdRef.current || '';
          const fetchedMessages = Array.isArray(data.messages)
            ? data.messages.map((m) => {
                const sid = m.senderId?._id?.toString?.() || m.senderId?.toString?.() || '';
                return {
                  id: m._id,
                  content: m.content,
                  type: m.type || 'text',
                  questionId: m.questionId?._id || m.questionId || null,
                  isMe: String(sid) === String(myId || ''),
                  createdAt: m.createdAt,
                };
              })
            : [];
          let mergedMessages;
          if (isBackgroundRefresh && messagesRef.current.length > 0) {
            const existing = messagesRef.current;
            const existingIds = new Set(existing.map((m) => m.id));
            const appended = fetchedMessages.filter((m) => !existingIds.has(m.id));
            mergedMessages = appended.length > 0 ? [...existing, ...appended] : existing;
          } else {
            mergedMessages = fetchedMessages;
          }

          const prevCount = prevMessageCountRef.current;
          prevMessageCountRef.current = mergedMessages.length;
          const useNotif =
            notificationPreferenceRef.current === 'notification' &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.hidden;
          if (useNotif && mergedMessages.length > prevCount && mergedMessages.length > 0) {
            const last = mergedMessages[mergedMessages.length - 1];
            if (!last.isMe && last.id !== lastNotifiedMessageIdRef.current) {
              lastNotifiedMessageIdRef.current = last.id;
              const list = contactsRef.current || [];
              const contact = list.find((c) => c.id === userId || c._id === userId);
              const contactName = contact?.username || contact?.name || '对方';
              showBrowserNotification(`${contactName} 发来新消息`, {
                body: (last.content || '').slice(0, 80) + ((last.content || '').length > 80 ? '…' : ''),
              });
            }
          }
          setMessages(mergedMessages);
          messagesRef.current = mergedMessages;

          if (qData && Array.isArray(qData.questions)) {
            let newLatest = null;
            if (qData.questions.length > 0) {
              newLatest = qData.questions[qData.questions.length - 1];
            }
            const isAnswerer =
              newLatest &&
              (newLatest.answererId?._id === currentUserIdRef.current || newLatest.answererId === currentUserIdRef.current);
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
            setQuestionsList(qData.questions);
          }
          // 不在每次 load 后调 refetchContacts，避免 context 更新导致 effect 反复执行；会话列表由 UnreadContext 每 20s 轮询更新
        }
      } catch (err) {
        if (!cancelled) setError(err.message || '加载消息失败');
      } finally {
        if (!cancelled) {
          initialLoadDoneRef.current = true;
          setLoading(false);
        }
      }
    };
    // 首次加载包含消息与付费提问数据
    load(false, true);
    // 消息高频轮询：提升聊天实时性
    const messageTimer = setInterval(() => load(true, false), 3000);
    // 付费提问低频轮询：减少不必要接口压力
    const questionTimer = setInterval(() => load(true, true), 15000);
    return () => {
      cancelled = true;
      clearInterval(messageTimer);
      clearInterval(questionTimer);
    };
  }, [userId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    try {
      const resp = await api.sendMessage(
        userId,
        content,
        activeTab === 'questions' && selectedQuestion ? (selectedQuestion._id || selectedQuestion.id) : undefined
      );
      const newMsg = resp?.data;
      setMessages((prev) => [
        ...prev,
        {
          id: newMsg?._id,
          content: newMsg?.content || content,
          questionId: newMsg?.questionId?._id || newMsg?.questionId || (activeTab === 'questions' && selectedQuestion ? (selectedQuestion._id || selectedQuestion.id) : null),
          isMe: true,
          createdAt: newMsg?.createdAt || new Date().toISOString(),
        },
      ]);
      refetchContactsRef.current?.();
    } catch (err) {
      setError(err.message || '发送失败');
    }
  };

  const refreshQuestions = async () => {
    try {
      const updated = await api.getConversationQuestions(userId);
      const list = Array.isArray(updated?.questions) ? updated.questions : [];
      setQuestionsList(list);
      if (list.length > 0) setLatestQuestion(list[list.length - 1]);
      else setLatestQuestion(null);
    } catch (_) {}
  };

  const handleAcceptQuestion = async (q) => {
    if (!q?._id) return;
    try {
      await api.acceptQuestion(q._id);
      await refreshQuestions();
      setActiveQuestionId(q._id);
      setActiveTab('questions');
      navigate(`/chats/${userId}?tab=questions&questionId=${q._id}`, { replace: true });
    } catch (err) {
      setError(err.message || '接受提问失败');
    }
  };

  const handleRejectQuestion = async (q) => {
    if (!q?._id) return;
    try {
      await api.rejectQuestion(q._id);
      await refreshQuestions();
    } catch (err) {
      setError(err.message || '拒绝提问失败');
    }
  };

  const handleConfirmPaid = async (q) => {
    if (!q?._id) return;
    try {
      await api.confirmQuestionPayment(q._id);
      await refreshQuestions();
    } catch (err) {
      setError(err.message || '记录订单失败');
    }
  };

  if (!userId) {
    return <div className="hint-text">请选择左侧联系人开始聊天</div>;
  }

  const isAsker = (q) => q && (q.askerId?._id === currentUserId || q.askerId === currentUserId);
  const isAnswerer = (q) => q && (q.answererId?._id === currentUserId || q.answererId === currentUserId);
  const statusText = (status) =>
    status === 'pending' ? '等待对方选择'
    : status === 'accepted' ? '对方已接受，聊天中交流'
    : status === 'completed' ? '对方已解答'
    : status === 'rejected' ? '对方无法回答'
    : status || '';
  const selectedQuestion =
    (activeQuestionId && questionsList.find((q) => q._id === activeQuestionId || q.id === activeQuestionId)) ||
    questionsList.find((q) => q.status === 'accepted') ||
    questionsList[questionsList.length - 1] ||
    null;
  const selectedQuestionId = selectedQuestion ? (selectedQuestion._id || selectedQuestion.id) : null;
  const selectedQuestionMessages = messages.filter((m) => {
    if (!selectedQuestionId) return false;
    return (
      m.type !== 'question' &&
      !(m.content || '').startsWith('付费提问：') &&
      messageBelongsToQuestion(m, selectedQuestionId)
    );
  });

  // 当当前用户是提问方，且问题已完成时，加载被提问者的收款码（用于展示给提问方）
  useEffect(() => {
    let cancelled = false;
    const loadPayee = async () => {
      if (!selectedQuestion || !isAsker(selectedQuestion) || selectedQuestion.status !== 'completed') {
        setPayeeQRCode(null);
        return;
      }
      const payeeId =
        selectedQuestion.answererId?._id || selectedQuestion.answererId || null;
      if (!payeeId) {
        setPayeeQRCode(null);
        return;
      }
      setPayeeLoading(true);
      try {
        const data = await api.getUser(payeeId);
        if (cancelled) return;
        const u = data.user || data;
        const qr = u.paymentQRCode || null;
        if (qr && (qr.wechat || qr.alipay)) {
          setPayeeQRCode(qr);
        } else {
          setPayeeQRCode(null);
        }
      } catch (_) {
        if (!cancelled) setPayeeQRCode(null);
      } finally {
        if (!cancelled) setPayeeLoading(false);
      }
    };
    loadPayee();
    return () => {
      cancelled = true;
    };
  }, [selectedQuestionId]);

  const switchToChatTab = () => {
    setActiveTab('chat');
    navigate(`/chats/${userId}?tab=chat`, { replace: true });
  };

  const switchToQuestionsTab = () => {
    setActiveTab('questions');
    const qid = activeQuestionId || selectedQuestionId;
    navigate(
      `/chats/${userId}?tab=questions${qid ? `&questionId=${qid}` : ''}`,
      { replace: true }
    );
  };

  return (
    <div
      className={
        'chat-main' +
        (activeTab === 'chat' ? ' chat-main-mode-normal' : ' chat-main-mode-paid')
      }
    >
      <div className="chat-main-header">
        <div className="chat-main-header-top">
          {userId && (
            <Link
              to={`/profile/${encodeURIComponent(String(userId))}`}
              className="chat-main-peer-avatar"
              title="查看对方资料"
            >
              <img src={peerAvatarUrl} alt="" />
            </Link>
          )}
          <h2 className="chat-main-title">对话</h2>
        </div>
        <div className="chat-main-tabs">
          <button
            type="button"
            className={'chat-tab' + (activeTab === 'chat' ? ' chat-tab-active' : '')}
            onClick={switchToChatTab}
          >
            普通聊天
          </button>
          <button
            type="button"
            className={'chat-tab' + (activeTab === 'questions' ? ' chat-tab-active' : '')}
            onClick={switchToQuestionsTab}
          >
            付费提问
            {questionsList.length > 0 && (
              <span className="chat-tab-badge">{questionsList.length}</span>
            )}
          </button>
        </div>
        {activeTab === 'questions' && questionsList.length > 0 && (
          <div className="question-picker-row" role="tablist" aria-label="选择悬赏提问">
            {questionsList.map((q) => {
              const qid = q._id || q.id;
              const selected =
                activeQuestionId && (q._id === activeQuestionId || q.id === activeQuestionId);
              return (
                <button
                  key={qid}
                  type="button"
                  role="tab"
                  aria-selected={!!selected}
                  className={'question-chip' + (selected ? ' question-chip-active' : '')}
                  onClick={() => {
                    setActiveQuestionId(qid);
                    navigate(`/chats/${userId}?tab=questions&questionId=${qid}`, { replace: true });
                  }}
                >
                  <span className="question-chip-price">¥{q.price}</span>
                  <span className="question-chip-preview">{previewQuestionLabel(q.content)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="chat-main-body">
        {activeTab === 'chat' && (() => {
          const chatMessages = messages.filter(isNormalChatMessage);
          return (
            <div className="chat-pane chat-pane-normal">
              {loading && messages.length === 0 && <div className="hint-text">加载中…</div>}
              <div className="chat-messages">
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      'chat-message' + (m.isMe ? ' chat-message-me' : ' chat-message-other')
                    }
                  >
                    {!m.isMe && userId && (
                      <Link
                        to={`/profile/${encodeURIComponent(String(userId))}`}
                        className="chat-message-avatar-btn"
                        title="查看对方资料"
                        aria-label="查看对方资料"
                      >
                        <img src={peerAvatarUrl} alt="" className="chat-message-avatar-img" />
                      </Link>
                    )}
                    <div className="chat-message-bubble">{normalizeSystemMessage(m.content, m.isMe)}</div>
                    {m.isMe && currentUserId && (
                      <Link
                        to={`/profile/${encodeURIComponent(String(currentUserId))}`}
                        className="chat-message-avatar-btn"
                        title="查看我的主页"
                        aria-label="查看我的主页"
                      >
                        <img src={currentUserAvatarUrl} alt="" className="chat-message-avatar-img" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {activeTab === 'questions' && (
          <div className="chat-questions-pane chat-pane chat-pane-paid">
            {loading && questionsList.length === 0 && <div className="hint-text">加载中…</div>}
            {!loading && questionsList.length === 0 && (
              <div className="hint-text">暂无付费提问</div>
            )}
            {selectedQuestion && (
              <div className="question-thread-panel">
                <div className="question-thread-summary">
                  <span className="question-thread-summary-price">¥{selectedQuestion.price}</span>
                  <span className="question-thread-summary-status">{statusText(selectedQuestion.status)}</span>
                  <span className="question-thread-summary-text">{selectedQuestion.content}</span>
                </div>
                <div className="question-thread-actions">
                  {isAnswerer(selectedQuestion) && selectedQuestion.status === 'pending' && (
                    <>
                      <button type="button" className="primary-button" onClick={() => handleAcceptQuestion(selectedQuestion)}>
                        接受
                      </button>
                      <button type="button" className="ghost-button" onClick={() => handleRejectQuestion(selectedQuestion)}>
                        拒绝
                      </button>
                    </>
                  )}
                  {isAsker(selectedQuestion) && selectedQuestion.status === 'completed' && !selectedQuestion.paid && (
                    <button type="button" className="primary-button" onClick={() => handleConfirmPaid(selectedQuestion)}>
                      对方已解答，记录这次订单
                    </button>
                  )}
                </div>
                {isAsker(selectedQuestion) && selectedQuestion.status === 'completed' && (
                  <div className="question-dialog-subtitle question-thread-panel-pay">
                    {payeeLoading && <span>收款码加载中…</span>}
                    {!payeeLoading && payeeQRCode && (
                      <div className="question-dialog-qrcodes">
                        <div className="question-dialog-qrcode-item">
                          <div className="question-dialog-qrcode-title">付款后点「记录这次订单」</div>
                          <div className="question-dialog-qrcode-images">
                            {payeeQRCode.wechat && (
                              <div className="question-dialog-qrcode-block">
                                <div className="question-dialog-qrcode-label">微信收款码</div>
                                <a href={resolveUploadUrl(payeeQRCode.wechat)} target="_blank" rel="noopener noreferrer" className="payment-qrcode-img-link">
                                  <img src={resolveUploadUrl(payeeQRCode.wechat)} alt="微信收款码" className="question-dialog-qrcode-image" />
                                </a>
                              </div>
                            )}
                            {payeeQRCode.alipay && (
                              <div className="question-dialog-qrcode-block">
                                <div className="question-dialog-qrcode-label">支付宝收款码</div>
                                <a href={resolveUploadUrl(payeeQRCode.alipay)} target="_blank" rel="noopener noreferrer" className="payment-qrcode-img-link">
                                  <img src={resolveUploadUrl(payeeQRCode.alipay)} alt="支付宝收款码" className="question-dialog-qrcode-image" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="payment-qrcode-open-hint">点击图片在新窗口打开原图，便于扫码</div>
                        </div>
                      </div>
                    )}
                    {!payeeLoading && !payeeQRCode && (
                      <div className="question-dialog-subtitle">对方未设置收款码</div>
                    )}
                  </div>
                )}
                <div className="chat-messages chat-messages-paid-thread" aria-label="悬赏对话">
                  {selectedQuestionMessages.map((m) => (
                      <div
                        key={`q-${m.id}`}
                        className={'chat-message' + (m.isMe ? ' chat-message-me' : ' chat-message-other')}
                      >
                        {!m.isMe && userId && (
                          <Link
                            to={`/profile/${encodeURIComponent(String(userId))}`}
                            className="chat-message-avatar-btn"
                            title="查看对方资料"
                            aria-label="查看对方资料"
                          >
                            <img src={peerAvatarUrl} alt="" className="chat-message-avatar-img" />
                          </Link>
                        )}
                        <div className="chat-message-bubble">{normalizeSystemMessage(m.content, m.isMe)}</div>
                        {m.isMe && currentUserId && (
                          <Link
                            to={`/profile/${encodeURIComponent(String(currentUserId))}`}
                            className="chat-message-avatar-btn"
                            title="查看我的主页"
                            aria-label="查看我的主页"
                          >
                            <img src={currentUserAvatarUrl} alt="" className="chat-message-avatar-img" />
                          </Link>
                        )}
                      </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(activeTab === 'chat' || activeTab === 'questions') && (
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
            <button type="button" className="primary-button" onClick={handleSend}>
              发送
            </button>
          </div>
        </div>
      )}
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
    const id = contact?.id || contact?._id;
    if (id) navigate(`/chats/${id}`);
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

