const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  askerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answererId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'disputed', 'refunded'],
    default: 'pending'
  },
  // 接受/拒绝时间
  acceptedAt: Date,
  rejectedAt: Date,
  // 回答内容
  answer: {
    content: String,
    answeredAt: Date
  },
  // 支付信息
  paidAt: Date,
  // 申诉信息
  dispute: {
    reason: String,
    createdAt: Date,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // 客服ID
    },
    resolution: {
      type: String,
      enum: ['refund', 'pay', 'partial']
    }
  },
  // 会话ID（用于聊天）
  conversationId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// 索引
questionSchema.index({ askerId: 1 });
questionSchema.index({ answererId: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ conversationId: 1 });

module.exports = mongoose.model('Question', questionSchema);




