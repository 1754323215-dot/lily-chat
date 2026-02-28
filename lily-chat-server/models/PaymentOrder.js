const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  scene: {
    type: String, // 例如：recharge_for_question
  },
  reason: {
    type: String, // 备注信息，例如：为某次提问充值
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  outTradeNo: {
    type: String, // 商户订单号（预留给真实微信支付集成）
  },
  transactionId: {
    type: String, // 微信支付订单号（预留字段）
  },
  paidAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);


