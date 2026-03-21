const express = require('express');
const { validationResult, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Feedback = require('../models/Feedback');
const { FEEDBACK_CATEGORIES, FEEDBACK_PLATFORMS } = Feedback;
const { authenticate } = require('./auth');
const { feedbackLimiter } = require('../middleware/rateLimiter');
const { sanitize } = require('../utils/xssFilter');
const logger = require('../utils/logger');
const { notifyFeedbackSubmitted } = require('../utils/mail');

const router = express.Router();

const feedbackStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/feedback');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'fb-' + uniqueSuffix + path.extname(file.originalname || '.jpg'));
  },
});

const feedbackUpload = multer({
  storage: feedbackStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const okExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    const okMime = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype || '');
    if (okExt || okMime) {
      return cb(null, true);
    }
    cb(new Error('只支持 jpeg、png、gif、webp 图片'));
  },
});

function uploadFeedbackIfMultipart(req, res, next) {
  if (req.is('multipart/form-data')) {
    return feedbackUpload.array('images', 5)(req, res, (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? '单张图片不能超过 5MB'
            : err.message || '图片上传失败';
        return res.status(400).json({ message: msg });
      }
      next();
    });
  }
  next();
}

function adminKeyOk(req) {
  const key = process.env.FEEDBACK_ADMIN_KEY;
  if (!key || typeof key !== 'string' || key.length < 8) {
    return false;
  }
  return req.get('x-admin-key') === key;
}

// 提交反馈（需登录）
// 支持 JSON 或 multipart/form-data（字段 images 最多 5 张）
router.post(
  '/',
  authenticate,
  feedbackLimiter,
  uploadFeedbackIfMultipart,
  async (req, res) => {
    try {
      const category = req.body.category;
      const platform = req.body.platform;
      const rawContent = typeof req.body.content === 'string' ? req.body.content : '';
      const content = sanitize(rawContent.trim());
      const appVersion = req.body.appVersion ? sanitize(String(req.body.appVersion).trim()) : undefined;
      const clientInfo = req.body.clientInfo ? sanitize(String(req.body.clientInfo).trim()) : undefined;

      if (!category || !FEEDBACK_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: '请选择反馈类型' });
      }
      if (!platform || !FEEDBACK_PLATFORMS.includes(platform)) {
        return res.status(400).json({ message: '平台信息无效' });
      }
      if (appVersion && appVersion.length > 64) {
        return res.status(400).json({ message: '版本号过长' });
      }
      if (clientInfo && clientInfo.length > 256) {
        return res.status(400).json({ message: '客户端信息过长' });
      }
      if (content.length > 2000) {
        return res.status(400).json({ message: '反馈内容不能超过2000个字符' });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (!content && files.length === 0) {
        return res.status(400).json({ message: '请填写反馈内容或上传至少一张图片' });
      }

      const imageUrls = files.map((f) => `/uploads/feedback/${f.filename}`);

      const doc = await Feedback.create({
        userId: req.user._id,
        category,
        content: content || '（仅附图）',
        platform,
        appVersion: appVersion || undefined,
        clientInfo: clientInfo || undefined,
        images: imageUrls,
      });

      logger.info('用户反馈已提交', { feedbackId: doc._id.toString(), userId: req.user._id.toString() });

      notifyFeedbackSubmitted({
        feedbackDoc: doc,
        submitter: {
          username: req.user.username,
          realName: req.user.realName,
          email: req.user.email,
        },
      }).catch((e) => logger.warn('反馈邮件异步任务异常', { message: e.message }));

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
