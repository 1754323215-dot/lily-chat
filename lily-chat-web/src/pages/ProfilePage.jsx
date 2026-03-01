import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getStoredAuth } from '../apiClient';
import { useUnread } from '../contexts/UnreadContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { setNotificationPreference } = useUnread();
  const [{ loading, saving, error }, setStatus] = useState({
    loading: true,
    saving: false,
    error: '',
  });
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    email: '',
    avatarUrl: '',
    wechatQRCode: '',
    alipayQRCode: '',
    password: '',
    notificationPreference: 'inApp',
  });

  useEffect(() => {
    const stored = getStoredAuth();
    const userId = stored.user?.id || stored.user?._id;
    if (!stored.token || !userId) {
      navigate('/login', { replace: true });
      return;
    }

    const load = async () => {
      try {
        const data = await api.getUser(userId);
        const u = data.user || data;
        setProfile(u);
        setForm({
          email: u.email || '',
          avatarUrl: u.avatar || '',
          wechatQRCode: u.paymentQRCode?.wechat || '',
          alipayQRCode: u.paymentQRCode?.alipay || '',
          password: '',
          notificationPreference: u.notificationPreference === 'notification' ? 'notification' : 'inApp',
        });
        setStatus((s) => ({ ...s, loading: false, error: '' }));
      } catch (e) {
        setStatus((s) => ({
          ...s,
          loading: false,
          error: e.message || '加载个人资料失败',
        }));
      }
    };
    load();
  }, [navigate]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      setStatus((s) => ({ ...s, saving: true, error: '' }));
      await api.updateProfile({
        email: form.email,
        password: form.password,
        avatarUrl: form.avatarUrl,
        wechatQRCode: form.wechatQRCode,
        alipayQRCode: form.alipayQRCode,
        notificationPreference: form.notificationPreference,
      });
      setNotificationPreference(form.notificationPreference);
      setStatus((s) => ({ ...s, saving: false }));
      setForm((prev) => ({ ...prev, password: '' }));
    } catch (e) {
      setStatus((s) => ({
        ...s,
        saving: false,
        error: e.message || '保存失败',
      }));
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">加载中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <div className="field-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt={profile.username} />
            ) : (
              <span>{profile.username?.[0] || 'U'}</span>
            )}
          </div>
          <div className="profile-main-info">
            <div className="profile-name-row">
              <span className="profile-username">{profile.name || profile.username}</span>
              {profile.realName && (
                <span className="profile-realname">（{profile.realName}）</span>
              )}
            </div>
            {profile.tags && profile.tags.length > 0 && (
              <div className="profile-tags">
                {profile.tags.map((t) => (
                  <span key={t.id || t._id} className="profile-tag">
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="profile-section-title">账户信息</div>
        <div className="profile-form">
          <label className="field-label">
            邮箱
            <input
              className="field-input"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="可选，方便找回账号"
            />
          </label>
          <label className="field-label">
            登录密码
            <input
              className="field-input"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              placeholder="不修改请留空"
            />
          </label>
        </div>

        <div className="profile-section-title">设置</div>
        <div className="profile-form">
          <div className="field-label">通知方式</div>
          <div className="profile-notification-options">
            <label className="profile-radio">
              <input
                type="radio"
                name="notificationPreference"
                value="inApp"
                checked={form.notificationPreference === 'inApp'}
                onChange={() => setForm((p) => ({ ...p, notificationPreference: 'inApp' }))}
              />
              <span>仅页面内提示</span>
            </label>
            <label className="profile-radio">
              <input
                type="radio"
                name="notificationPreference"
                value="notification"
                checked={form.notificationPreference === 'notification'}
                onChange={() => {
                  setForm((p) => ({ ...p, notificationPreference: 'notification' }));
                  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    Notification.requestPermission();
                  }
                }}
              />
              <span>通知提示（浏览器/系统弹窗）</span>
            </label>
          </div>
        </div>

        <div className="profile-section-title">头像与收款码</div>
        <div className="profile-form">
          <label className="field-label">
            头像链接
            <input
              className="field-input"
              value={form.avatarUrl}
              onChange={handleChange('avatarUrl')}
              placeholder="图片 URL，用于展示头像"
            />
          </label>
          <label className="field-label">
            微信收款码链接
            <input
              className="field-input"
              value={form.wechatQRCode}
              onChange={handleChange('wechatQRCode')}
              placeholder="可选，用于别人付款给你"
            />
          </label>
          <label className="field-label">
            支付宝收款码链接
            <input
              className="field-input"
              value={form.alipayQRCode}
              onChange={handleChange('alipayQRCode')}
              placeholder="可选，用于别人付款给你"
            />
          </label>
        </div>

        {error && <div className="field-error">{error}</div>}

        <button
          className="primary-button profile-save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存修改'}
        </button>
      </div>
    </div>
  );
}

