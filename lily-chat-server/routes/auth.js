const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

// 认证中间件
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    let user;
    
    // 支持两种 token 格式：
    // 1. token-{userId} 格式（前端发送的格式）
    if (token.startsWith('token-')) {
      const userId = token.replace('token-', '');
      console.log('🔍 认证调试 - Token格式: token-{userId}, 提取的userId:', userId);
      
      // 验证 userId 是否为有效的 ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('❌ 认证失败 - 无效的 ObjectId 格式:', userId);
        return res.status(401).json({ message: 'Token格式无效' });
      }
      
      user = await User.findById(userId);
      if (!user) {
        console.error('❌ 认证失败 - 用户不存在, userId:', userId);
        // 尝试查找所有用户，看看是否有其他用户
        const userCount = await User.countDocuments();
        console.log('📊 数据库中用户总数:', userCount);
        return res.status(401).json({ message: '用户不存在' });
      }
      console.log('✅ 认证成功 - 找到用户:', user.username, 'ID:', user._id);
    } 
    // 2. JWT 格式（标准格式）
    else {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lily-chat-secret-key');
        user = await User.findById(decoded.userId);
      } catch (jwtError) {
        // JWT 验证失败，尝试作为 userId 直接查找（兼容旧格式）
        if (mongoose.Types.ObjectId.isValid(token)) {
          user = await User.findById(token);
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ 认证错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(401).json({ message: 'Token无效' });
  }
};

// 注册（用户名 + 真实姓名 + 身份证号）
router.post('/register', [
  body('username').trim().notEmpty().withMessage('用户名不能为空'),
  body('realName').trim().notEmpty().withMessage('真实姓名不能为空'),
  body('idCard').trim().isLength({ min: 15, max: 18 }).withMessage('身份证号格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { username, realName, idCard } = req.body;

    // 检查用户名是否已存在
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 检查身份证号是否已存在
    const existingIdCard = await User.findOne({ idCard });
    if (existingIdCard) {
      return res.status(400).json({ message: '该身份证号已注册' });
    }

    // 创建新用户
    const user = new User({
      username,
      realName,
      idCard
    });

    await user.save();

    // 返回 token-{userId} 格式（前端期望的格式）
    const token = `token-${user._id}`;

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        realName: user.realName,
        avatar: user.avatar,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登录（真实姓名 + 身份证号）
router.post('/login', [
  body('realName').trim().notEmpty().withMessage('真实姓名不能为空'),
  body('idCard').trim().notEmpty().withMessage('身份证号不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { realName, idCard } = req.body;

    // 使用真实姓名 + 身份证号登录
    const user = await User.findOne({ realName, idCard });
    if (!user) {
      return res.status(401).json({ message: '真实姓名或身份证号错误' });
    }

    // 返回 token-{userId} 格式（前端期望的格式）
    const token = `token-${user._id}`;

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        realName: user.realName,
        avatar: user.avatar,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password');
    
    res.json({ user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
module.exports.authenticate = authenticate;




