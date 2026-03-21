import React, { useState, useRef } from 'react';
import { api } from '../apiClient';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 意见反馈表单（个人页与 /feedback 页共用）
 */
export default function FeedbackSection({ className = '', hideSectionTitle = false }) {
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [feedbackContent, setFeedbackContent] = useState('');
  /** @type {[{ file: File, url: string }]} */
  const [feedbackImages, setFeedbackImages] = useState([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const fileInputRef = useRef(null);

  const onPickFiles = (e) => {
    const list = e.target.files;
    if (!list || !list.length) return;
    const next = [...feedbackImages];
    for (let i = 0; i < list.length && next.length < MAX_IMAGES; i++) {
      const f = list[i];
      if (f.size > MAX_BYTES) {
        setFeedbackMessage('单张图片不能超过 5MB');
        continue;
      }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setFeedbackImages(next);
    e.target.value = '';
  };

  const removeImageAt = (index) => {
    setFeedbackImages((prev) => {
      const item = prev[index];
      if (item?.url) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmitFeedback = async () => {
    const text = feedbackContent.trim();
    if (!text && feedbackImages.length === 0) {
      setFeedbackMessage('请填写反馈内容或上传图片');
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackMessage('');
    try {
      await api.submitFeedback({
        category: feedbackCategory,
        content: text,
        platform: 'web',
        clientInfo:
          typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 200) : undefined,
        images: feedbackImages.length ? feedbackImages.map((x) => x.file) : undefined,
      });
      setFeedbackContent('');
      feedbackImages.forEach((x) => x.url && URL.revokeObjectURL(x.url));
      setFeedbackImages([]);
      setFeedbackMessage('提交成功，感谢反馈');
    } catch (e) {
      setFeedbackMessage(e.message || '提交失败');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {!hideSectionTitle && <div className="profile-section-title">意见反馈</div>}
      <div className="profile-form profile-feedback-block">
        <label className="field-label">
          类型
          <select
            className="field-input"
            value={feedbackCategory}
            onChange={(e) => setFeedbackCategory(e.target.value)}
          >
            <option value="bug">问题 / Bug</option>
            <option value="suggestion">建议</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label className="field-label">
          内容
          <textarea
            className="field-input profile-feedback-textarea"
            rows={4}
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            placeholder="可只发图；若打字，最多2000字"
            maxLength={2000}
          />
        </label>
        <label className="field-label">
          附图（可选，最多 {MAX_IMAGES} 张，每张 ≤5MB）
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="profile-feedback-file-input"
            onChange={onPickFiles}
          />
        </label>
        {feedbackImages.length > 0 && (
          <div className="profile-feedback-previews">
            {feedbackImages.map((item, idx) => (
              <div key={`${item.file.name}-${idx}`} className="profile-feedback-preview-item">
                <img
                  src={item.url}
                  alt=""
                  className="profile-feedback-preview-img"
                />
                <button
                  type="button"
                  className="profile-feedback-remove-img"
                  onClick={() => removeImageAt(idx)}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
        {feedbackMessage && (
          <div
            className={
              feedbackMessage.startsWith('提交成功') ? 'field-hint' : 'field-error'
            }
          >
            {feedbackMessage}
          </div>
        )}
        <button
          type="button"
          className="primary-button profile-feedback-submit"
          onClick={handleSubmitFeedback}
          disabled={feedbackSubmitting}
        >
          {feedbackSubmitting ? '提交中…' : '提交反馈'}
        </button>
      </div>
    </div>
  );
}
