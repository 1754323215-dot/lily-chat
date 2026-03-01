const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export function getStoredAuth() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  return {
    token,
    user: userJson ? JSON.parse(userJson) : null,
  };
}

export function setStoredAuth({ token, user }) {
  if (token) {
    localStorage.setItem('token', token);
  }
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function request(path, options = {}) {
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
  getContacts() {
    return request('/messages/contacts');
  },
  getConversationWithUser(userId) {
    return request(`/messages/user/${userId}`);
  },
  sendMessage(receiverId, content) {
    return request('/messages', {
      method: 'POST',
      body: JSON.stringify({ receiverId, content }),
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
};

