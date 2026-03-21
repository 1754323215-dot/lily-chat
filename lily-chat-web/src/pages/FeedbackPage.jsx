import React from 'react';
import FeedbackSection from '../components/FeedbackSection';

export default function FeedbackPage() {
  return (
    <div className="profile-page">
      <div className="profile-card">
        <h1 className="feedback-page-title">意见反馈</h1>
        <p className="feedback-page-desc">遇到问题或有改进建议，欢迎告诉我们。</p>
        <FeedbackSection hideSectionTitle />
      </div>
    </div>
  );
}
