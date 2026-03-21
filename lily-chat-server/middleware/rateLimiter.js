const rateLimit = require('express-rate-limit');

// 通用 API 速率限制（每分钟 100 次请求）
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 最多 100 次请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录/注册速率限制（更严格，防止暴力破解）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 15 分钟内最多 5 次尝试
  message: '登录尝试次数过多，请 15 分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功请求不计入限制
});

// 消息发送速率限制（防止刷屏）
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 30, // 每分钟最多 30 条消息
  message: '消息发送过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 提问创建速率限制
const questionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每分钟最多 10 个提问
  message: '提问创建过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 用户反馈提交（防刷）
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 每 15 分钟最多 5 条
  message: '反馈提交过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  messageLimiter,
  questionLimiter,
  feedbackLimiter,
};

