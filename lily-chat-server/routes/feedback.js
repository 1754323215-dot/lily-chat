const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Feedback = require('../models/Feedback');
const { FEEDBACK_CATEGORIES, FEEDBACK_PLATFORMS } = Feedback;
const { authenticate } = require('./auth');
const { feedbackLimiter } = require('../middleware/rateLimiter');
const { sanitize } = require('../utils/xssFilter');
const logger = require('../utils/logger');

const router = express.Router();

function adminKeyOk(req) {
  const key = process.env.FEEDBACK_ADMIN_KEY;
  if (!key || typeof key !== 'string' || key.length < 8) {
    return false;
  }
  return req.get('x-admin-key') === key;
}

// 提交反馈（需登录）
router.post(
  '/',
  authenticate,
  feedbackLimiter,
  [
    body('category')
      .trim()
      .notEmpty()
      .withMessage('请选择反馈类型')
      .isIn(FEEDBACK_CATEGORIES)
      .withMessage('反馈类型无效'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('反馈内容不能为空')
      .isLength({ max: 2000 })
      .withMessage('反馈内容不能超过2000个字符'),
    body('platform')
      .trim()
      .notEmpty()
      .withMessage('平台信息缺失')
      .isIn(FEEDBACK_PLATFORMS)
      .withMessage('平台信息无效'),
    body('appVersion').optional().trim().isLength({ max: 64 }).withMessage('版本号过长'),
    body('clientInfo').optional().trim().isLength({ max: 256 }).withMessage('客户端信息过长'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const category = req.body.category;
      const content = sanitize(req.body.content.trim());
      const platform = req.body.platform;
      const appVersion = req.body.appVersion ? sanitize(String(req.body.appVersion).trim()) : undefined;
      const clientInfo = req.body.clientInfo ? sanitize(String(req.body.clientInfo).trim()) : undefined;

      if (!content) {
        return res.status(400).json({ message: '反馈内容不能为空' });
      }

      const doc = await Feedback.create({
        userId: req.user._id,
        category,
        content,
        platform,
        appVersion: appVersion || undefined,
        clientInfo: clientInfo || undefined,
      });

      logger.info('用户反馈已提交', { feedbackId: doc._id.toString(), userId: req.user._id.toString() });

      return res.status(201).json({
        message: '感谢您的反馈',
        id: doc._id.toString(),
      });
    } catch (error) {
      logger.error('提交反馈失败:', error);
      return res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 运维查看（需配置 FEEDBACK_ADMIN_KEY，且请求头 x-admin-key 一致）
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('skip').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res) => {
    if (!adminKeyOk(req)) {
      return res.status(404).json({ message: 'Not found' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const limit = req.query.limit != null ? req.query.limit : 50;
      const skip = req.query.skip != null ? req.query.skip : 0;

      const [items, total] = await Promise.all([
        Feedback.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'username realName')
          .lean(),
        Feedback.countDocuments(),
      ]);

      return res.json({
        items,
        total,
        skip,
        limit,
      });
    } catch (error) {
      logger.error('列出反馈失败:', error);
      return res.status(500).json({ message: '服务器错误' });
    }
  }
);

module.exports = router;
