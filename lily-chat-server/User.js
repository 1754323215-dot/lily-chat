const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: false // 可选，因为可以用身份证号登录
  },
  avatar: {
    type: String,
    default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'
  },
  // 实名认证信息
  realName: {
    type: String,
    required: true,
    trim: true
  },
  idCard: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // 用户位置信息
  location: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    address: String,
    lastUpdate: Date
  },
  // 余额
  balance: {
    type: Number,
    default: 0
  },
  // 统计信息
  stats: {
    questionsAsked: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);




