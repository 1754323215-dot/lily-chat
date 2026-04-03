import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, setStoredAuth } from '../apiClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
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
    if (mode === 'register') {
      const u = username.trim();
      if (u.length < 2 || u.length > 20) {
        setError('用户名长度需在 2～20 个字符');
        return;
      }
      const id = idCard.trim();
      if (id.length < 15 || id.length > 18) {
        setError('身份证号应为 15 或 18 位');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const data =
        mode === 'login'
          ? await api.loginWithRealName(realName.trim(), idCard.trim())
          : await api.registerWithRealName(username.trim(), realName.trim(), idCard.trim());
      if (data?.token && data?.user) {
        setStoredAuth({
          token: data.token,
          user: data.user,
          refreshToken: data.refreshToken,
        });
        navigate(from, { replace: true });
      } else {
        setError(mode === 'login' ? '登录返回数据异常' : '注册返回数据异常');
      }
    } catch (err) {
      setError(err.message || (mode === 'login' ? '登录失败' : '注册失败'));
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
            <p className="auth-subtitle">
              {mode === 'login' ? '实名认证后使用聊天服务' : '新用户注册：设置用户名并完成实名'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <label className="field-label">
              用户名
              <input
                className="field-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2～20 个字符，用于展示"
                autoComplete="username"
              />
            </label>
          )}

          <label className="field-label">
            真实姓名
            <input
              className="field-input"
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="与身份证一致的姓名"
              autoComplete="name"
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
              autoComplete="off"
            />
          </label>

          {error && <div className="field-error">{error}</div>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading
              ? mode === 'login'
                ? '登录中…'
                : '注册中…'
              : mode === 'login'
                ? '登录'
                : '注册并登录'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                去登录
              </button>
            </>
          )}
        </p>

        <p className="auth-tip">请确保在安全网络环境下输入个人信息。</p>
      </div>
    </div>
  );
}
