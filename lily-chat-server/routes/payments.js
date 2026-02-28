const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('./auth');
const PaymentOrder = require('../models/PaymentOrder');
const User = require('../models/User');

const router = express.Router();

// 创建微信支付充值订单（当前为模拟实现：直接入账余额，返回一个示意支付链接）
router.post('/wechat/create', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('充值金额必须大于0'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { amount, scene, reason, questionId } = req.body;
    const user = req.user;

    // 创建本地订单
    const order = new PaymentOrder({
      userId: user._id,
      amount,
      scene: scene || 'recharge_for_question',
      reason,
      questionId,
      status: 'pending',
      outTradeNo: `MOCK_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    });

    // 当前为开发/测试环境：不真正调用微信接口，直接视为支付成功并入账
    order.status = 'paid';
    order.paidAt = new Date();
    await order.save();

    // 给用户账户余额增加
    user.balance = (user.balance || 0) + Number(amount);
    await user.save();

    // 模拟一个微信支付的 H5 页面链接（正式环境应替换为真实微信 mweb_url）
    const basePayDemoUrl = process.env.WECHAT_MOCK_PAY_URL
      || 'http://www.sdgsxy.cn/wechat-pay-demo.html';
    const payUrl = `${basePayDemoUrl}?orderId=${order._id.toString()}&amount=${amount}`;

    res.status(201).json({
      message: '充值订单创建成功（当前为模拟支付，余额已直接入账）',
      orderId: order._id,
      status: order.status,
      balance: user.balance,
      payUrl,
    });
  } catch (error) {
    console.error('创建微信支付订单错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;


