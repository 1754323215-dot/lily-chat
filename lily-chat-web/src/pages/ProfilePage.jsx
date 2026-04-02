import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getStoredAuth, setStoredAuth, clearStoredAuth, resolveUploadUrl } from '../apiClient';
import { useUnread } from '../contexts/UnreadContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams();
  const { setNotificationPreference } = useUnread();
  const [{ loading, saving, error }, setStatus] = useState({
    loading: true,
    saving: false,
    error: '',
  });
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
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
    const meId = stored.user?.id || stored.user?._id;
    if (!stored.token || !meId) {
      navigate('/login', { replace: true });
      return;
    }

    const targetId = routeUserId != null && routeUserId !== '' ? String(routeUserId) : String(meId ?? '');
    const isOwn = !routeUserId || String(routeUserId) === String(meId ?? '');

    const load = async () => {
      setStatus((s) => ({ ...s, loading: true }));
      try {
        const data = await api.getUser(targetId);
        const u = data.user || data;
        setProfile(u);
        setForm({
          email: u.email || '',
          avatarUrl: u.avatar || '',
          wechatQRCode: u.paymentQRCode?.wechat || '',
          alipayQRCode: u.paymentQRCode?.alipay || '',
          password: '',
          notificationPreference:
            u.notificationPreference === 'notification'
              ? 'notification'
              : (stored.user?.notificationPreference === 'notification' ? 'notification' : 'inApp'),
        });
        setLoadError('');
        setStatus((s) => ({ ...s, loading: false, error: '' }));
      } catch (e) {
        setLoadError(e.message || '加载个人资料失败');
        setStatus((s) => ({ ...s, loading: false }));
      }
    };
    load();
  }, [navigate, routeUserId]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleUploadQRCode = (provider) => async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus((s) => ({ ...s, saving: true, error: '' }));
    try {
      const resp = await api.uploadPaymentQRCode(provider, file);
      const qr = resp.paymentQRCode || {};
      setForm((prev) => ({
        ...prev,
        wechatQRCode: qr.wechat || prev.wechatQRCode,
        alipayQRCode: qr.alipay || prev.alipayQRCode,
      }));
      // 同步到本地 profile，方便预览和后续使用
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              paymentQRCode: qr,
            }
          : prev
      );
    } catch (err) {
      setStatus((s) => ({
        ...s,
        error: err.message || '上传收款码失败',
      }));
    } finally {
      setStatus((s) => ({ ...s, saving: false }));
      // 允许重复选择同一文件
      e.target.value = '';
    }
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
      const stored = getStoredAuth();
      if (stored?.user) {
        setStoredAuth({
          token: stored.token,
          user: {
            ...stored.user,
            notificationPreference: form.notificationPreference,
          },
        });
      }
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

  const handleNotificationPreferenceChange = async (value) => {
    setForm((p) => ({ ...p, notificationPreference: value }));
    setNotificationPreference(value);

    const stored = getStoredAuth();
    if (stored?.user) {
      setStoredAuth({
        token: stored.token,
        user: {
          ...stored.user,
          notificationPreference: value,
        },
      });
    }

    // 仅切到系统通知时尝试申请权限
    if (value === 'notification' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // 选择后立即持久化，避免用户未点“保存修改”导致刷新回退
    try {
      await api.updateProfile({ notificationPreference: value });
    } catch (_) {
      // 保留本地值，失败时由用户点击“保存修改”重试
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">加载中…</div>
      </div>
    );
  }

  const meId = getStoredAuth().user?.id || getStoredAuth().user?._id;
  const isOwnProfile = !routeUserId || String(routeUserId) === String(meId ?? '');

  return (
    <div className="profile-page">
      {loadError && (
        <div className="profile-card profile-error-banner">
          <div className="field-error">{loadError}</div>
          <p className="profile-error-hint">可先尝试重新登录以恢复资料编辑。</p>
          <button
            type="button"
            className="primary-button profile-relogin-button"
            onClick={() => {
              clearStoredAuth();
              navigate('/login', { replace: true });
            }}
          >
            重新登录
          </button>
        </div>
      )}

      {profile && (
      <div className="profile-card">
        {!isOwnProfile && (
          <div className="profile-view-other-bar">
            <button type="button" className="ghost-button profile-back-button" onClick={() => navigate(-1)}>
              返回
            </button>
            <span className="profile-view-other-hint">查看对方资料</span>
            <button
              type="button"
              className="ghost-button"
              onClick={() => navigate(`/chats/${routeUserId}`)}
            >
              发消息
            </button>
          </div>
        )}
        <div className="profile-header">
          <div className="profile-avatar">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt={profile.name || profile.username || ''} />
            ) : (
              <span>{(profile.name || profile.username)?.[0] || 'U'}</span>
            )}
          </div>
          <div className="profile-main-info">
            <div className="profile-name-row">
              <span className="profile-username">{profile.name || profile.username}</span>
              {profile.realName && (
                <span className="profile-realname">（{profile.realName}）</span>
              )}
              {typeof profile.creditScore === 'number' && typeof profile.abilityScore === 'number' && (
                <span style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  能力分：{profile.abilityScore} · 信用分：{profile.creditScore}
                </span>
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

        {!isOwnProfile && (form.wechatQRCode || form.alipayQRCode) && (
          <>
            <div className="profile-section-title">收款码（向对方付款时可扫码）</div>
            <div className="profile-form">
              {form.wechatQRCode && (
                <div className="profile-qrcode-preview">
                  <div className="field-label">微信收款码</div>
                  <a href={resolveUploadUrl(form.wechatQRCode)} target="_blank" rel="noopener noreferrer" className="payment-qrcode-img-link">
                    <img src={resolveUploadUrl(form.wechatQRCode)} alt="微信收款码" className="profile-qrcode-image" />
                  </a>
                  <div className="payment-qrcode-open-hint">点击图片在新窗口打开原图，便于扫码</div>
                </div>
              )}
              {form.alipayQRCode && (
                <div className="profile-qrcode-preview">
                  <div className="field-label">支付宝收款码</div>
                  <a href={resolveUploadUrl(form.alipayQRCode)} target="_blank" rel="noopener noreferrer" className="payment-qrcode-img-link">
                    <img src={resolveUploadUrl(form.alipayQRCode)} alt="支付宝收款码" className="profile-qrcode-image" />
                  </a>
                  <div className="payment-qrcode-open-hint">点击图片在新窗口打开原图，便于扫码</div>
                </div>
              )}
            </div>
          </>
        )}

        {isOwnProfile && (
        <>
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
                onChange={() => handleNotificationPreferenceChange('inApp')}
              />
              <span>仅页面内提示</span>
            </label>
            <label className="profile-radio">
              <input
                type="radio"
                name="notificationPreference"
                value="notification"
                checked={form.notificationPreference === 'notification'}
                onChange={() => handleNotificationPreferenceChange('notification')}
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
            微信收款码图片上传
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadQRCode('wechat')}
            />
          </label>
          {form.wechatQRCode && (
            <div className="profile-qrcode-preview">
              <div className="field-label">微信收款码预览</div>
              <a href={resolveUploadUrl(form.wechatQRCode)} target="_blank" rel="noopener noreferrer" className="payment-qrcode-img-link">
                <img src={resolveUploadUrl(form.wechatQRCode)} alt="微信收款码预览" className="profile-qrcode-image" />
              </a>
              <div className="payment-qrcode-open-hint">点击图片在新窗口打开原图，便于扫码</div>
            </div>
          )}
          <label className="field-label">
            支付宝收款码链接
            <input
              className="field-input"
              value={form.alipayQRCode}
              onChange={handleChange('alipayQRCode')}
              placeholder="可选，用于别人付款给你"
            />
          </label>
          <label className="field-label">
            支付宝收款码图片上传
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadQRCode('alipay')}
            />
          </label>
          {form.alipayQRCode && (
            <div className="profile-qrcode-preview">
              <div className="field-label">支付宝收款码预览</div>
              <a href={resolveUploadUrl(form.alipayQRCode)} target="_blank" rel="noopener noreferrer" className="payment-qrcode-img-link">
                <img src={resolveUploadUrl(form.alipayQRCode)} alt="支付宝收款码预览" className="profile-qrcode-image" />
              </a>
              <div className="payment-qrcode-open-hint">点击图片在新窗口打开原图，便于扫码</div>
            </div>
          )}
        </div>

        {error && <div className="field-error">{error}</div>}

        <button
          className="primary-button profile-save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存修改'}
        </button>
        </>
        )}
      </div>
      )}
    </div>
  );
}

