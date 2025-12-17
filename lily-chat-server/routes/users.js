const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Tag = require('../models/Tag');
const { authenticate } = require('./auth');
const router = express.Router();

// 更新用户位置
router.post('/location', authenticate, [
  body('latitude').isFloat().withMessage('纬度格式不正确'),
  body('longitude').isFloat().withMessage('经度格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { latitude, longitude, address } = req.body;

    req.user.location = {
      latitude,
      longitude,
      address,
      lastUpdate: new Date()
    };
    await req.user.save();

    // 自动更新虚拟用户位置到当前用户附近（偏移约100米）
    try {
      const dummyUser = await User.findOne({ username: 'test_teacher' });
      if (dummyUser) {
        // 将虚拟用户位置设置为用户位置附近（偏移0.001度，约100米）
        dummyUser.location = {
          latitude: latitude + 0.001,  // 约100米偏移
          longitude: longitude + 0.001,
          address: '测试位置（自动跟随）',
          lastUpdate: new Date()
        };
        await dummyUser.save();
        console.log(`✅ 虚拟用户位置已更新到用户附近: ${dummyUser.location.latitude}, ${dummyUser.location.longitude}`);
      }
    } catch (dummyError) {
      console.error('更新虚拟用户位置失败:', dummyError);
      // 不阻止用户位置更新
    }

    res.json({
      message: '位置更新成功',
      location: req.user.location
    });
  } catch (error) {
    console.error('更新位置错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取附近用户
router.post('/nearby', authenticate, [
  body('latitude').isFloat().withMessage('纬度格式不正确'),
  body('longitude').isFloat().withMessage('经度格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { latitude, longitude } = req.body;
    const radius = 0.01; // 约1公里范围

    const users = await User.find({
      _id: { $ne: req.user._id },
      'location.latitude': {
        $gte: latitude - radius,
        $lte: latitude + radius
      },
      'location.longitude': {
        $gte: longitude - radius,
        $lte: longitude + radius
      },
      'location.lastUpdate': {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内更新过位置
      }
    }).select('username avatar location');

    // 获取用户的标签
    const usersWithTags = await Promise.all(
      users.map(async (user) => {
        const tags = await Tag.find({
          userId: user._id,
          verificationStatus: { $in: ['approved', 'pending'] }
        }).select('name type level verified');
        
        return {
          id: user._id,
          name: user.username,
          avatar: user.avatar,
          lat: user.location.latitude,
          lng: user.location.longitude,
          tags: tags.map(tag => ({
            id: tag._id,
            name: tag.name,
            type: tag.type,
            level: tag.level,
            verified: tag.verified
          }))
        };
      })
    );

    res.json({ users: usersWithTags });
  } catch (error) {
    console.error('获取附近用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户详情
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username avatar realName balance stats');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const tags = await Tag.find({
      userId: user._id,
      verificationStatus: { $in: ['approved', 'pending'] }
    }).select('name type level verified');

    res.json({
      user: {
        id: user._id,
        name: user.username,
        avatar: user.avatar,
        realName: user.realName,
        balance: user.balance,
        stats: user.stats,
        tags: tags.map(tag => ({
          id: tag._id,
          name: tag.name,
          type: tag.type,
          level: tag.level,
          verified: tag.verified
        }))
      }
    });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户资料
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { email, password, avatar } = req.body;

    if (email) req.user.email = email;
    if (avatar) req.user.avatar = avatar;
    if (password) {
      // 如果以后需要密码功能
      // const bcrypt = require('bcryptjs');
      // req.user.password = await bcrypt.hash(password, 10);
    }

    await req.user.save();

    res.json({
      message: '资料更新成功',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    console.error('更新资料错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建虚拟用户（测试用）
router.post('/create-dummy', async (req, res) => {
  try {
    const { username, realName, idCard, balance = 100, latitude, longitude } = req.body;

    if (!username || !realName || !idCard) {
      return res.status(400).json({ message: '用户名、真实姓名和身份证号不能为空' });
    }

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

    // 生成随机头像
    const avatarSeed = username + Date.now();
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`;

    // 创建虚拟用户
    const dummyUser = new User({
      username,
      realName,
      idCard,
      avatar,
      balance,
      location: latitude && longitude ? {
        latitude,
        longitude,
        address: '虚拟位置',
        lastUpdate: new Date()
      } : undefined
    });

    await dummyUser.save();

    res.status(201).json({
      message: '虚拟用户创建成功',
      user: {
        id: dummyUser._id,
        username: dummyUser.username,
        realName: dummyUser.realName,
        avatar: dummyUser.avatar,
        balance: dummyUser.balance,
        location: dummyUser.location
      }
    });
  } catch (error) {
    console.error('创建虚拟用户错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

module.exports = router;




