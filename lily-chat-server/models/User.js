const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

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
  // 加密后的身份证号（用于存储）
  idCardEncrypted: {
    type: String,
    required: false
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
  // 收款码（用户自行收款）
  paymentQRCode: {
    wechat: { type: String, default: null }, // 微信收款码图片URL
    alipay: { type: String, default: null }  // 支付宝收款码图片URL
  },
  // 统计信息
  stats: {
    questionsAsked: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }
  },
  // 通知方式：inApp 仅页面内提示，notification 系统/浏览器通知
  notificationPreference: {
    type: String,
    enum: ['inApp', 'notification'],
    default: 'inApp'
  },
  // App 端 Expo 推送 token（可选，用于后续服务端推送）
  expoPushToken: { type: String, default: null }
}, {
  timestamps: true
});

// 保存前加密身份证号
userSchema.pre('save', async function(next) {
  if (this.isModified('idCard') && this.idCard) {
    try {
      this.idCardEncrypted = encrypt(this.idCard);
      // 保存时不清除 idCard，但查询时使用加密版本
      // 为了兼容性，暂时保留 idCard 字段，但建议迁移后删除
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// 添加虚拟字段用于获取解密后的身份证号（仅用于验证，不返回给前端）
userSchema.virtual('idCardDecrypted').get(function() {
  if (this.idCardEncrypted) {
    try {
      return decrypt(this.idCardEncrypted);
    } catch (error) {
      return null;
    }
  }
  return this.idCard; // 兼容旧数据
});

// 静态方法：通过加密的身份证号查找用户（用于登录）
userSchema.statics.findByEncryptedIdCard = async function(realName, idCard) {
  // 先尝试用明文查找（兼容旧数据）
  let user = await this.findOne({ realName, idCard });
  
  if (!user) {
    // 如果没找到，尝试加密后查找
    const encryptedIdCard = encrypt(idCard);
    user = await this.findOne({ 
      realName, 
      idCardEncrypted: encryptedIdCard 
    });
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);




