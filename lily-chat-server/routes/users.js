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

    res.json({
      message: '位置更新成功',
      location: req.user.location
    });
  } catch (error) {
    console.error('更新位置错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取附近用户（按设计：展示每个用户最后一次上报的位置）
// - 不再按“附近半径”过滤
// - 不强制时间窗口，只要有位置就可以展示
// - 支持可选的地图视野 bounds，用于只加载当前屏幕区域
router.post('/nearby', authenticate, [
  // 保持兼容：latitude/longitude 允许传入，但不再作为必填条件
  body('latitude').optional({ checkFalsy: true }).isFloat().withMessage('纬度格式不正确'),
  body('longitude').optional({ checkFalsy: true }).isFloat().withMessage('经度格式不正确'),
  body('bounds').optional().isObject().withMessage('bounds 格式不正确'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { bounds } = req.body || {};

    // 基础条件：排除自己，只要曾经上报过位置的用户
    const query = {
      _id: { $ne: req.user._id },
      'location.latitude': { $ne: null },
      'location.longitude': { $ne: null }
    };

    // 如果前端传入地图视野 bounds，则只查询当前视野内的用户
    if (bounds && typeof bounds === 'object') {
      const north = Number(bounds.north);
      const south = Number(bounds.south);
      const east = Number(bounds.east);
      const west = Number(bounds.west);

      if (
        Number.isFinite(north) &&
        Number.isFinite(south) &&
        Number.isFinite(east) &&
        Number.isFinite(west)
      ) {
        query['location.latitude'] = { $gte: south, $lte: north };
        query['location.longitude'] = { $gte: west, $lte: east };
      }
    }

    // 返回最近更新过位置的最多 2000 个用户（全局 / 当前视野）
    const users = await User.find(query)
      .sort({ 'location.lastUpdate': -1 })
      .limit(2000)
      .select('username avatar location');

    // 获取用户的标签
    const usersWithTags = await Promise.all(
      users.map(async (user) => {
        const tags = await Tag.find({
          userId: user._id,
          verificationStatus: { $in: ['approved', 'pending'] }
        }).select('name type level verified');
        
        return {
          id: user._id.toString(),
          name: user.username,
          avatar: user.avatar,
          lat: user.location.latitude,
          lng: user.location.longitude,
          tags: tags.map(tag => ({
            id: tag._id.toString(),
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
      .select('username avatar realName balance stats paymentQRCode notificationPreference');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const tags = await Tag.find({
      userId: user._id,
      verificationStatus: { $in: ['approved', 'pending'] }
    }).select('name type level verified');

    // 只有查看自己的信息或对方已设置收款码时才返回收款码
    const isOwnProfile = req.user._id.toString() === user._id.toString();
    const paymentQRCode = isOwnProfile || user.paymentQRCode?.wechat || user.paymentQRCode?.alipay
      ? user.paymentQRCode
      : null;

    const userObj = {
      id: user._id.toString(),
      name: user.username,
      avatar: user.avatar,
      realName: user.realName,
      balance: user.balance,
      stats: user.stats,
      paymentQRCode: paymentQRCode,
      tags: tags.map(tag => ({
          id: tag._id.toString(),
          name: tag.name,
          type: tag.type,
          level: tag.level,
          verified: tag.verified
      }))
    };
    if (isOwnProfile && user.notificationPreference !== undefined) {
      userObj.notificationPreference = user.notificationPreference;
    }
    res.json({ user: userObj });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户资料
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { email, password, avatar, paymentQRCode, notificationPreference } = req.body;

    if (email) req.user.email = email;
    if (avatar) req.user.avatar = avatar;
    if (notificationPreference === 'inApp' || notificationPreference === 'notification') {
      req.user.notificationPreference = notificationPreference;
    }
    if (password) {
      // 如果以后需要密码功能
      // const bcrypt = require('bcryptjs');
      // req.user.password = await bcrypt.hash(password, 10);
    }
    if (paymentQRCode) {
      // 更新收款码
      if (paymentQRCode.wechat !== undefined) {
        req.user.paymentQRCode = req.user.paymentQRCode || {};
        req.user.paymentQRCode.wechat = paymentQRCode.wechat || null;
      }
      if (paymentQRCode.alipay !== undefined) {
        req.user.paymentQRCode = req.user.paymentQRCode || {};
        req.user.paymentQRCode.alipay = paymentQRCode.alipay || null;
      }
    }

    await req.user.save();

    res.json({
      message: '资料更新成功',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
        paymentQRCode: req.user.paymentQRCode,
        notificationPreference: req.user.notificationPreference
      }
    });
  } catch (error) {
    console.error('更新资料错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;




