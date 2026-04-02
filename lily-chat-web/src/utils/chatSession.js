const STORAGE_KEY = 'lily_chat_session_v1';

/**
 * @returns {{ viewedAt: Record<string, number>, lastUserId: string | null, lastTab: 'chat'|'questions' } | null}
 */
export function getChatSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!data.viewedAt || typeof data.viewedAt !== 'object') {
      data.viewedAt = {};
    }
    return data;
  } catch {
    return null;
  }
}

export function recordChatView(userId, tab) {
  if (!userId) return;
  const now = Date.now();
  const prev = getChatSession() || { viewedAt: {}, lastUserId: null, lastTab: 'chat' };
  const next = {
    ...prev,
    viewedAt: { ...prev.viewedAt, [String(userId)]: now },
    lastUserId: String(userId),
    lastTab: tab === 'questions' ? 'questions' : 'chat',
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
}

/**
 * 最近查看的会话在前，其次按服务端 lastTime
 */
export function sortContactsByLastViewed(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return contacts || [];
  const session = getChatSession();
  const viewedAt = session?.viewedAt || {};
  return [...contacts].sort((a, b) => {
    const idA = String(a.id || a._id || '');
    const idB = String(b.id || b._id || '');
    const va = viewedAt[idA] || 0;
    const vb = viewedAt[idB] || 0;
    if (vb !== va) return vb - va;
    const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
    const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
    return tb - ta;
  });
}

export function pickLastViewedUserId(contacts) {
  const session = getChatSession();
  const last = session?.lastUserId;
  if (!last || !Array.isArray(contacts)) return null;
  const ok = contacts.some((c) => String(c.id || c._id) === String(last));
  return ok ? last : null;
}
