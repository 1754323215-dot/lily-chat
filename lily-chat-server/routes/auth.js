const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');
const { sanitize } = require('../utils/xssFilter');
const logger = require('../utils/logger');
const router = express.Router();

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 默认 7 天
const TOKEN_REFRESH_EXPIRES_IN = process.env.TOKEN_REFRESH_EXPIRES_IN || '30d'; // 刷新 token 30 天

if (!JWT_SECRET || JWT_SECRET === 'lily-chat-secret-key-change-in-production') {
  logger.warn('⚠️  警告: JWT_SECRET 未设置或使用默认值，请在生产环境中设置强密钥！');
}

// 生成 JWT Token
function generateToken(userId) {
  return jwt.sign(
    { userId: userId.toString() },
    JWT_SECRET || 'lily-chat-secret-key',
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 生成刷新 Token
function generateRefreshToken(userId) {
  return jwt.sign(
    { userId: userId.toString(), type: 'refresh' },
    JWT_SECRET || 'lily-chat-secret-key',
    { expiresIn: TOKEN_REFRESH_EXPIRES_IN }
  );
}

// 认证中间件
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    let user;
    
    // 支持两种 token 格式（向后兼容）：
    // 1. token-{userId} 格式（旧格式，逐步迁移到 JWT）
    if (token.startsWith('token-')) {
      const userId = token.replace('token-', '');
      logger.debug('使用旧格式 token-{userId} 认证');
      
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn('无效的 ObjectId 格式:', userId);
        return res.status(401).json({ message: 'Token格式无效' });
      }
      
      user = await User.findById(userId);
      if (!user) {
        logger.warn('用户不存在, userId:', userId);
        return res.status(401).json({ message: '用户不存在' });
      }
      logger.debug('认证成功:', user.username);
    } 
    // 2. JWT 格式（推荐格式）
    else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET || 'lily-chat-secret-key');
        
        // 检查是否是刷新 token（不能用于普通认证）
        if (decoded.type === 'refresh') {
          return res.status(401).json({ message: '请使用访问令牌，不是刷新令牌' });
        }
        
        user = await User.findById(decoded.userId);
        if (!user) {
          logger.warn('JWT 中的用户不存在, userId:', decoded.userId);
          return res.status(401).json({ message: '用户不存在' });
        }
        logger.debug('JWT 认证成功:', user.username);
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          logger.warn('Token 已过期');
          return res.status(401).json({ message: 'Token已过期，请重新登录' });
        } else if (jwtError.name === 'JsonWebTokenError') {
          logger.warn('JWT 验证失败:', jwtError.message);
          return res.status(401).json({ message: 'Token无效' });
        } else {
          // 兼容旧格式：尝试作为 userId 直接查找（不推荐，但保持兼容）
          if (mongoose.Types.ObjectId.isValid(token)) {
            logger.warn('使用兼容模式：直接使用 userId 作为 token（不推荐）');
            user = await User.findById(token);
          } else {
            throw jwtError;
          }
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('认证错误:', error);
    res.status(401).json({ message: 'Token无效' });
  }
};

// 注册（用户名 + 真实姓名 + 身份证号）
router.post('/register', authLimiter, [
  body('username').trim().notEmpty().withMessage('用户名不能为空').isLength({ min: 2, max: 20 }).withMessage('用户名长度应在2-20个字符之间'),
  body('realName').trim().notEmpty().withMessage('真实姓名不能为空').isLength({ max: 50 }).withMessage('真实姓名不能超过50个字符'),
  body('idCard').trim().isLength({ min: 15, max: 18 }).withMessage('身份证号格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    // XSS 过滤
    const username = sanitize(req.body.username.trim());
    const realName = sanitize(req.body.realName.trim());
    const idCard = req.body.idCard.trim(); // 身份证号不需要 HTML 过滤，但需要验证格式

    // 检查用户名是否已存在
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      logger.warn('注册失败: 用户名已存在', username);
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 检查身份证号是否已存在（使用加密查找）
    const existingIdCard = await User.findByEncryptedIdCard(realName, idCard);
    if (existingIdCard) {
      logger.warn('注册失败: 身份证号已注册');
      return res.status(400).json({ message: '该身份证号已注册' });
    }

    // 创建新用户（idCard 会在 pre-save hook 中自动加密）
    const user = new User({
      username,
      realName,
      idCard
    });

    await user.save();
    logger.info('新用户注册成功:', username);

    // 生成 JWT Token
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      message: '注册成功',
      token,
      refreshToken,
      // 向后兼容：也返回旧格式
      tokenLegacy: `token-${user._id}`,
      user: {
        id: user._id.toString(),
        username: user.username,
        realName: user.realName,
        avatar: user.avatar,
        balance: user.balance
      }
    });
  } catch (error) {
    logger.error('注册错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登录（真实姓名 + 身份证号）
router.post('/login', authLimiter, [
  body('realName').trim().notEmpty().withMessage('真实姓名不能为空'),
  body('idCard').trim().notEmpty().withMessage('身份证号不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    // XSS 过滤
    const realName = sanitize(req.body.realName.trim());
    const idCard = req.body.idCard.trim();

    // 使用加密方式查找用户
    const user = await User.findByEncryptedIdCard(realName, idCard);
    if (!user) {
      logger.warn('登录失败: 用户名或身份证号错误', realName);
      return res.status(401).json({ message: '真实姓名或身份证号错误' });
    }

    logger.info('用户登录成功:', user.username);

    // 生成 JWT Token
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: '登录成功',
      token,
      refreshToken,
      // 向后兼容：也返回旧格式
      tokenLegacy: `token-${user._id}`,
      user: {
        id: user._id.toString(),
        username: user.username,
        realName: user.realName,
        avatar: user.avatar,
        balance: user.balance
      }
    });
  } catch (error) {
    logger.error('登录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 刷新 Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: '刷新令牌不能为空' });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET || 'lily-chat-secret-key');
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ message: '无效的刷新令牌' });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: '用户不存在' });
      }

      // 生成新的访问令牌
      const newToken = generateToken(user._id);

      res.json({
        message: '令牌刷新成功',
        token: newToken,
        user: {
          id: user._id.toString(),
          username: user.username,
          realName: user.realName,
          avatar: user.avatar,
          balance: user.balance
        }
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '刷新令牌已过期，请重新登录' });
      }
      throw jwtError;
    }
  } catch (error) {
    logger.error('刷新令牌错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -idCard -idCardEncrypted'); // 不返回敏感信息
    
    res.json({ user });
  } catch (error) {
    logger.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
module.exports.authenticate = authenticate;




