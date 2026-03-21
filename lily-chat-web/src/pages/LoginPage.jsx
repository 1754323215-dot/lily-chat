import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, setStoredAuth } from '../apiClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname || '/chats';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!realName || !idCard) {
      setError('请输入真实姓名和身份证号');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.loginWithRealName(realName.trim(), idCard.trim());
      if (data?.token && data?.user) {
        setStoredAuth({
          token: data.token,
          user: data.user,
          refreshToken: data.refreshToken || undefined,
        });
        navigate(from, { replace: true });
      } else {
        setError('登录返回数据异常');
      }
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">L</div>
          <div>
            <h1 className="auth-title">Lily Chat</h1>
            <p className="auth-subtitle">实名认证后使用聊天服务</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field-label">
            真实姓名
            <input
              className="field-input"
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="与身份证一致的姓名"
            />
          </label>

          <label className="field-label">
            身份证号
            <input
              className="field-input"
              type="text"
              value={idCard}
              onChange={(e) => setIdCard(e.target.value)}
              placeholder="仅用于实名认证"
            />
          </label>

          {error && <div className="field-error">{error}</div>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="auth-tip">请确保在安全网络环境下输入个人信息。</p>
      </div>
    </div>
  );
}

