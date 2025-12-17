const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20
  },
  type: {
    type: String,
    enum: ['required', 'optional', 'custom'],
    required: true
  },
  level: {
    type: Number,
    enum: [1, 2], // 1=未认证, 2=已认证
    default: 1
  },
  verified: {
    type: Boolean,
    default: false
  },
  // 认证证明材料
  proof: {
    text: String, // 文字说明
    images: [String] // 图片URL数组
  },
  // 认证审核信息
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // 客服ID
  },
  rejectionReason: String
}, {
  timestamps: true
});

// 索引
tagSchema.index({ userId: 1 });
tagSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('Tag', tagSchema);




