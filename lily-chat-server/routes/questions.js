const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const User = require('../models/User');
const Message = require('../models/Message');
const { authenticate } = require('./auth');
const { questionLimiter } = require('../middleware/rateLimiter');
const { sanitize } = require('../utils/xssFilter');
const logger = require('../utils/logger');
const router = express.Router();

// 生成会话ID
function generateConversationId(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `conv_${ids[0]}_${ids[1]}`;
}

// 创建付费提问
router.post('/', authenticate, questionLimiter, [
  body('answererId').notEmpty().withMessage('被提问者ID不能为空'),
  body('content').trim().notEmpty().withMessage('问题内容不能为空').isLength({ max: 2000 }).withMessage('问题内容不能超过2000个字符'),
  body('price').isFloat({ min: 0.01, max: 10000 }).withMessage('提问价格必须在0.01-10000元之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { answererId, price } = req.body;
    // XSS 过滤问题内容
    const content = sanitize(req.body.content.trim());

    // 验证 answererId 是否为有效的 ObjectId
    if (!mongoose.Types.ObjectId.isValid(answererId)) {
      return res.status(400).json({ message: '无效的用户ID格式' });
    }

    // 检查被提问者是否存在
    const answerer = await User.findById(answererId);
    if (!answerer) {
      return res.status(404).json({ message: '被提问者不存在' });
    }

    // 不再检查余额和扣除，改为用户自行支付

    // 生成会话ID
    const conversationId = generateConversationId(req.user._id, answererId);

    // 创建提问
    const question = new Question({
      askerId: req.user._id,
      answererId,
      content,
      price,
      conversationId,
      status: 'pending'
    });

    await question.save();

    // 创建消息通知
    const message = new Message({
      conversationId,
      senderId: req.user._id,
      receiverId: answererId,
      content: `付费提问：${content}`, // content 已经过 XSS 过滤
      type: 'question',
      questionId: question._id
    });

    await message.save();

    logger.info('付费提问已创建', { 
      askerId: req.user._id, 
      answererId, 
      price, 
      questionId: question._id 
    });

    res.status(201).json({
      message: '提问已发送',
      question,
      conversationId
    });
  } catch (error) {
    logger.error('创建提问错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 接受提问
router.post('/:questionId/accept', authenticate, async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: '提问不存在' });
    }

    if (question.answererId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权操作' });
    }

    if (question.status !== 'pending') {
      return res.status(400).json({ message: '提问状态不正确' });
    }

    question.status = 'accepted';
    question.acceptedAt = new Date();
    await question.save();

    // 创建接受消息
    const message = new Message({
      conversationId: question.conversationId,
      senderId: req.user._id,
      receiverId: question.askerId,
      content: '已接受您的付费提问',
      type: 'text'
    });

    await message.save();

    logger.info('提问已接受', { questionId: question._id, answererId: req.user._id });

    res.json({
      message: '已接受提问',
      question,
      conversationId: question.conversationId
    });
  } catch (error) {
    logger.error('接受提问错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 拒绝提问
router.post('/:questionId/reject', authenticate, async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: '提问不存在' });
    }

    if (question.answererId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权操作' });
    }

    if (question.status !== 'pending') {
      return res.status(400).json({ message: '提问状态不正确' });
    }

    // 不再退款，因为用户自行支付
    question.status = 'rejected';
    question.rejectedAt = new Date();
    await question.save();

    // 创建拒绝消息
    const message = new Message({
      conversationId: question.conversationId,
      senderId: req.user._id,
      receiverId: question.askerId,
      content: '已拒绝您的付费提问',
      type: 'text'
    });

    await message.save();

    logger.info('提问已拒绝', { questionId: question._id, answererId: req.user._id });

    res.json({
      message: '已拒绝提问',
      question
    });
  } catch (error) {
    logger.error('拒绝提问错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 确认支付（提问者确认已支付）
router.post('/:questionId/confirm-payment', authenticate, async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: '提问不存在' });
    }

    if (question.askerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '只有提问者可以确认支付' });
    }

    if (question.paid) {
      return res.status(400).json({ message: '该提问已确认支付' });
    }

    question.paid = true;
    question.paidBy = req.user._id;
    question.paidAt = new Date();
    await question.save();

    // 创建支付确认消息
    const message = new Message({
      conversationId: question.conversationId,
      senderId: req.user._id,
      receiverId: question.answererId,
      content: `已确认支付 ¥${question.price}，请尽快回答`,
      type: 'text'
    });

    await message.save();

    logger.info('支付已确认', { questionId: question._id, askerId: req.user._id });

    res.json({
      message: '支付确认成功',
      question
    });
  } catch (error) {
    logger.error('确认支付错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 回答提问
router.post('/:questionId/answer', authenticate, [
  body('answer').trim().notEmpty().withMessage('回答内容不能为空').isLength({ max: 5000 }).withMessage('回答内容不能超过5000个字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: '提问不存在' });
    }

    if (question.answererId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权操作' });
    }

    if (question.status !== 'accepted') {
      return res.status(400).json({ message: '提问状态不正确' });
    }

    // 检查是否已支付（可选，如果未支付也可以回答）
    // if (!question.paid) {
    //   return res.status(400).json({ message: '提问者尚未确认支付' });
    // }

    // XSS 过滤回答内容
    const answerContent = sanitize(req.body.answer.trim());
    
    question.answer = {
      content: answerContent,
      answeredAt: new Date()
    };
    question.status = 'completed';
    await question.save();

    logger.info('提问已回答', { questionId: question._id, answererId: req.user._id });

    // 创建回答消息
    const message = new Message({
      conversationId: question.conversationId,
      senderId: req.user._id,
      receiverId: question.askerId,
      content: req.body.answer,
      type: 'text'
    });

    await message.save();

    res.json({
      message: '回答已发送',
      question
    });
  } catch (error) {
    logger.error('回答提问错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取单个提问详情
router.get('/:questionId', authenticate, async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId)
      .populate('askerId', 'username avatar')
      .populate('answererId', 'username avatar');

    if (!question) {
      return res.status(404).json({ message: '提问不存在' });
    }

    // 只有提问双方可以查看
    if (
      question.askerId._id.toString() !== req.user._id.toString() &&
      question.answererId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: '无权查看该提问' });
    }

    res.json(question);
  } catch (error) {
    logger.error('获取提问详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取与指定用户相关的提问列表（会话内所有付费提问）
router.get('/conversation/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // 当前用户与目标用户之间的所有付费提问（无论提问者/回答者）
    const questions = await Question.find({
      $or: [
        { askerId: req.user._id, answererId: userId },
        { askerId: userId, answererId: req.user._id }
      ]
    })
      .populate('askerId', 'username avatar')
      .populate('answererId', 'username avatar')
      .sort({ createdAt: 1 });

    res.json({ questions });
  } catch (error) {
    logger.error('获取会话提问列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取我的提问列表
router.get('/my-asked', authenticate, async (req, res) => {
  try {
    const questions = await Question.find({ askerId: req.user._id })
      .populate('answererId', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({ questions });
  } catch (error) {
    logger.error('获取提问列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取我收到的提问列表
router.get('/my-received', authenticate, async (req, res) => {
  try {
    const questions = await Question.find({ answererId: req.user._id })
      .populate('askerId', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({ questions });
  } catch (error) {
    logger.error('获取收到的提问列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 申诉提问
router.post('/:questionId/dispute', authenticate, [
  body('reason').trim().notEmpty().withMessage('申诉原因不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: '提问不存在' });
    }

    if (question.askerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '只有提问者可以申诉' });
    }

    if (question.status !== 'completed') {
      return res.status(400).json({ message: '只能对已完成的问题申诉' });
    }

    question.status = 'disputed';
    question.dispute = {
      reason: req.body.reason,
      createdAt: new Date()
    };
    await question.save();

    logger.info('提问申诉已提交', { questionId: question._id, askerId: req.user._id });

    res.json({
      message: '申诉已提交，等待客服处理',
      question
    });
  } catch (error) {
    logger.error('申诉错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;




