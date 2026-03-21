import React, { useState } from 'react';
import { api } from '../apiClient';

/**
 * 意见反馈表单（个人页与 /feedback 页共用）
 */
export default function FeedbackSection({ className = '', hideSectionTitle = false }) {
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleSubmitFeedback = async () => {
    const text = feedbackContent.trim();
    if (!text) {
      setFeedbackMessage('请填写反馈内容');
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
      });
      setFeedbackContent('');
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
            placeholder="请描述遇到的问题或建议（最多2000字）"
            maxLength={2000}
          />
        </label>
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
