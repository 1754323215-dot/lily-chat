const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * 将后端返回的上传文件路径（如 /uploads/payment-qrcodes/xxx.png）转为浏览器可用的图片地址。
 * - 已是 http(s) 或 data: 则原样返回。
 * - 若 VITE_API_BASE_URL 为完整 URL（如 https://api.xxx.com/api），则拼到 API 同源下。
 * - 若为相对 /api，则返回以 / 开头的路径（依赖站点对 /uploads 的反向代理，见 lily-chat-web/server.js）。
 */
export function resolveUploadUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  if (base.startsWith('http://') || base.startsWith('https://')) {
    try {
      const u = new URL(base.endsWith('/') ? base : `${base}/`);
      return `${u.origin}${path}`;
    } catch {
      return path;
    }
  }
  return path;
}

export function getStoredAuth() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  const refreshToken = localStorage.getItem('refreshToken');
  return {
    token,
    refreshToken,
    user: userJson ? JSON.parse(userJson) : null,
  };
}

export function setStoredAuth(payload) {
  const { token, user, refreshToken } = payload;
  if (token) {
    localStorage.setItem('token', token);
  }
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  // 登录时显式传入 refreshToken（含 undefined）时同步覆盖，避免换账号后仍用旧 refresh
  if (Object.prototype.hasOwnProperty.call(payload, 'refreshToken')) {
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }
}

export function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
}

let refreshInFlight = null;

/**
 * 调用 /auth/refresh 并写入新 access token。
 * @param {{ clearOnUnauthorized?: boolean }} [opts] 若为 true 且服务端返回 401，则 clearStoredAuth（用于 bootstrap）
 */
async function performTokenRefresh(opts = {}) {
  const { clearOnUnauthorized = false } = opts;
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return false;

  try {
    const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.token) {
      if (clearOnUnauthorized && resp.status === 401) {
        clearStoredAuth();
      }
      return false;
    }
    const prev = getStoredAuth();
    setStoredAuth({
      token: data.token,
      user: data.user || prev.user,
      refreshToken: prev.refreshToken,
    });
    return true;
  } catch {
    return false;
  }
}

async function tryRefreshAccessToken() {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = performTokenRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * 首屏启动时调用：若有 refreshToken，先换新 access token，避免多接口同时 401。
 * 刷新令牌也失效（401）时清本地登录态。
 */
export async function bootstrapAuth() {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return;
  await performTokenRefresh({ clearOnUnauthorized: true });
}

function redirectToLoginIfNeeded() {
  if (typeof window === 'undefined') return;
  const p = window.location.pathname || '';
  if (p.includes('/login')) return;
  window.location.assign('/login');
}

/** 带 Bearer 的请求：401 时尝试 refresh 后重试一次（用于 FormData 上传等） */
async function fetchWithAuthRetry(url, options = {}, isRetry = false) {
  const { token } = getStoredAuth();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url, { ...options, headers });
  const isAuthPath = url.includes('/auth/login') || url.includes('/auth/refresh');
  if (resp.status === 401 && !isRetry && !isAuthPath) {
    const ok = await tryRefreshAccessToken();
    if (ok) {
      return fetchWithAuthRetry(url, options, true);
    }
    clearStoredAuth();
    redirectToLoginIfNeeded();
  }
  return resp;
}

async function request(path, options = {}, isRetryAfterRefresh = false) {
  const { token } = getStoredAuth();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const skipRefresh =
    path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register';
  if (resp.status === 401 && !isRetryAfterRefresh && !skipRefresh) {
    const ok = await tryRefreshAccessToken();
    if (ok) {
      return request(path, options, true);
    }
    clearStoredAuth();
    redirectToLoginIfNeeded();
  }

  if (!resp.ok) {
    let message = '请求失败';
    try {
      const data = await resp.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    // #region agent log
    fetch('http://127.0.0.1:7581/ingest/c87ce979-585c-4f3d-b544-9059937f150e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'99d6d7'},body:JSON.stringify({sessionId:'99d6d7',runId:'pre-fix',hypothesisId:'H3',location:'apiClient.js:request',message:'api request failed',data:{path,status:resp.status,errorMessage:message,hasToken:!!token},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(message);
  }

  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  loginWithRealName(realName, idCard) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ realName, idCard }),
    });
  },
  registerWithRealName(username, realName, idCard) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, realName, idCard }),
    });
  },
  uploadPaymentQRCode(type, file) {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('image', file);

    return fetchWithAuthRetry(`${API_BASE_URL}/users/payment-qrcode`, {
      method: 'POST',
      body: formData,
    }).then(async (resp) => {
      if (!resp.ok) {
        let message = '上传失败';
        try {
          const data = await resp.json();
          if (data?.message) message = data.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      return resp.json();
    });
  },
  getContacts() {
    return request('/messages/contacts');
  },
  getConversationWithUser(userId, options) {
    const params = new URLSearchParams();
    if (options && options.since) {
      params.set('since', options.since);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/messages/user/${userId}${query}`);
  },
  sendMessage(receiverId, content, questionId) {
    return request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        receiverId,
        content,
        questionId: questionId || undefined,
      }),
    });
  },
  // 悬赏提问相关接口
  createQuestion({ answererId, content, price }) {
    return request('/questions', {
      method: 'POST',
      body: JSON.stringify({ answererId, content, price }),
    });
  },
  getConversationQuestions(userId) {
    return request(`/questions/conversation/${userId}`);
  },
  getPendingQuestions() {
    return request('/questions/pending');
  },
  acceptQuestion(questionId) {
    return request(`/questions/${questionId}/accept`, {
      method: 'POST',
    });
  },
  rejectQuestion(questionId) {
    return request(`/questions/${questionId}/reject`, {
      method: 'POST',
    });
  },
  confirmQuestionPayment(questionId) {
    return request(`/questions/${questionId}/confirm-payment`, {
      method: 'POST',
    });
  },
  updateLocation(latitude, longitude, address) {
    return request('/users/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, address: address || '当前位置' }),
    });
  },
  // 获取指定用户详情（用于个人主页）
  getUser(userId) {
    return request(`/users/${userId}`);
  },
  // 更新当前用户个人资料
  updateProfile({ email, password, avatarUrl, wechatQRCode, alipayQRCode, notificationPreference }) {
    return request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify({
        email,
        password: password || undefined,
        avatar: avatarUrl || undefined,
        paymentQRCode: {
          wechat: wechatQRCode || null,
          alipay: alipayQRCode || null,
        },
        notificationPreference: notificationPreference === 'inApp' || notificationPreference === 'notification' ? notificationPreference : undefined,
      }),
    });
  },
  /**
   * 获取“附近的人”/地图上的用户位置
   * - bounds 为可选的地图视野范围：{ north, south, east, west }
   * - 不传 bounds 时，后端会返回全局最近的若干用户（最多 2000）
   */
  getNearbyUsers(bounds) {
    return request('/users/nearby', {
      method: 'POST',
      body: JSON.stringify(
        bounds && typeof bounds === 'object'
          ? { bounds }
          : {} // 不传 bounds 时由后端决定范围（全局）
      ),
    });
  },
  submitFeedback({ category, content, platform, appVersion, clientInfo, images }) {
    const files = Array.isArray(images) ? images.filter(Boolean) : [];
    if (files.length > 0) {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('content', content != null ? String(content) : '');
      fd.append('platform', platform);
      if (appVersion) fd.append('appVersion', String(appVersion));
      if (clientInfo) fd.append('clientInfo', String(clientInfo));
      files.forEach((file) => fd.append('images', file));
      return fetchWithAuthRetry(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        body: fd,
      }).then(async (resp) => {
        if (!resp.ok) {
          let message = '请求失败';
          try {
            const data = await resp.json();
            if (data?.message) message = data.message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        return resp.json();
      });
    }
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        category,
        content,
        platform,
        appVersion: appVersion || undefined,
        clientInfo: clientInfo || undefined,
      }),
    });
  },
};

