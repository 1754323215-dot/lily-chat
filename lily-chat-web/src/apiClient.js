const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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

export function setStoredAuth({ token, user, refreshToken }) {
  if (token) {
    localStorage.setItem('token', token);
  }
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  if (refreshToken !== undefined) {
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

let refreshPromise = null;

async function tryRefreshAccessToken() {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.token) {
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
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
  }

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
  submitFeedback({ category, content, platform, appVersion, clientInfo }) {
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

