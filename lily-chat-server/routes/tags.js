const express = require('express');
const { body, validationResult } = require('express-validator');
const Tag = require('../models/Tag');
const { authenticate } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/tags');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'tag-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('只支持图片文件'));
  }
});

// 获取用户的所有标签
router.get('/my', authenticate, async (req, res) => {
  try {
    const tags = await Tag.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ tags });
  } catch (error) {
    console.error('获取标签错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加标签（包含证明材料）
router.post('/', authenticate, upload.array('images', 5), [
  body('name').trim().notEmpty().withMessage('标签名称不能为空').isLength({ max: 20 }).withMessage('标签名称不能超过20个字符'),
  body('type').isIn(['required', 'optional', 'custom']).withMessage('标签类型不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, type, proofText } = req.body;

    // 检查是否已有相同名称的标签
    const existingTag = await Tag.findOne({
      userId: req.user._id,
      name: name.trim()
    });

    if (existingTag) {
      return res.status(400).json({ message: '该标签已存在' });
    }

    // 处理上传的图片
    const imageUrls = req.files ? req.files.map(file => {
      return `/uploads/tags/${file.filename}`;
    }) : [];

    // 创建标签
    const tag = new Tag({
      userId: req.user._id,
      name: name.trim(),
      type,
      level: 1, // 默认未认证
      verified: false,
      proof: {
        text: proofText || '',
        images: imageUrls
      },
      verificationStatus: 'pending'
    });

    await tag.save();

    res.status(201).json({
      message: '标签添加成功，等待审核',
      tag
    });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除标签
router.delete('/:tagId', authenticate, async (req, res) => {
  try {
    const tag = await Tag.findOne({
      _id: req.params.tagId,
      userId: req.user._id
    });

    if (!tag) {
      return res.status(404).json({ message: '标签不存在' });
    }

    // 删除关联的图片文件
    if (tag.proof && tag.proof.images) {
      tag.proof.images.forEach(imagePath => {
        const fullPath = path.join(__dirname, '..', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    await tag.deleteOne();

    res.json({ message: '标签删除成功' });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;




