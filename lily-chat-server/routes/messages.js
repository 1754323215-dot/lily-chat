const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Question = require('../models/Question');
const User = require('../models/User');
const { authenticate } = require('./auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const { sanitize } = require('../utils/xssFilter');
const logger = require('../utils/logger');
const router = express.Router();

// 生成会话ID
function generateConversationId(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `conv_${ids[0]}_${ids[1]}`;
}

// 获取联系人列表（用于聊天页面）；可复用于 /api/messages/contacts 与 /api/v1/contacts
async function getContacts(req, res) {
  try {
    logger.info('getContacts 被调用', { userId: req.user?._id?.toString() });
    // 获取所有包含当前用户的会话
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    })
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar')
      .sort({ createdAt: -1 });

    // 获取所有联系过的用户ID
    const contactUserIds = new Set();
    const contactMap = new Map();

    const myIdStr = (req.user._id && req.user._id.toString) ? req.user._id.toString() : '';
    if (!myIdStr) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    messages.forEach((msg) => {
      const senderId = msg.senderId && msg.senderId._id ? msg.senderId._id.toString() : '';
      const receiverId = msg.receiverId && msg.receiverId._id ? msg.receiverId._id.toString() : '';
      if (!senderId || !receiverId) return;

      const isSenderSelf = senderId === myIdStr;
      const otherUserId = isSenderSelf ? receiverId : senderId;
      const otherUser = isSenderSelf ? msg.receiverId : msg.senderId;
      if (!otherUser) return;

      const key = otherUserId;

      if (!contactMap.has(key)) {
        const name = otherUser.username || '用户';
        contactMap.set(key, {
          id: key,
          username: name,
          avatar: otherUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          lastMessage: msg.content,
          lastTime: msg.createdAt,
          unreadCount: 0,
        });
      } else {
        // 更新最后一条消息（如果这条消息更新）
        const existing = contactMap.get(key);
        if (new Date(msg.createdAt) > new Date(existing.lastTime)) {
          existing.lastMessage = msg.content;
          existing.lastTime = msg.createdAt;
        }
      }
    });

    // 统计每个联系人发给我且未读的消息数
    try {
      const myId = mongoose.Types.ObjectId(myIdStr);
      const unreadBySender = await Message.aggregate([
        { $match: { receiverId: myId, read: false } },
        { $group: { _id: '$senderId', count: { $sum: 1 } } }
      ]);
      unreadBySender.forEach(({ _id, count }) => {
        if (!_id) return;
        const key = typeof _id.toString === 'function' ? _id.toString() : String(_id);
        if (contactMap.has(key)) contactMap.get(key).unreadCount = count;
      });
    } catch (aggErr) {
      logger.warn('getContacts 未读统计失败', { message: aggErr.message });
    }

    const contacts = Array.from(contactMap.values());
    contacts.sort((a, b) => {
      const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
      const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
      return tb - ta;
    });
    logger.info('getContacts 返回', { count: contacts.length });

    res.json(contacts);
  } catch (error) {
    logger.error('获取联系人列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}

router.get('/contacts', authenticate, getContacts);

// 获取会话列表
router.get('/conversations', authenticate, async (req, res) => {
  try {
    // 获取所有包含当前用户的会话
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    })
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar')
      .sort({ createdAt: -1 });

    // 按会话ID分组，获取每个会话的最后一条消息
    const conversationMap = new Map();
    
    messages.forEach(msg => {
      const convId = msg.conversationId;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          conversationId: convId,
          lastMessage: msg,
          unreadCount: 0
        });
      }
    });

    // 计算未读消息数
    for (const [convId, conv] of conversationMap) {
      const unread = await Message.countDocuments({
        conversationId: convId,
        receiverId: req.user._id,
        read: false
      });
      conv.unreadCount = unread;
    }

    const conversations = Array.from(conversationMap.values());

    res.json({ conversations });
  } catch (error) {
    logger.error('获取会话列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取会话消息
router.get('/conversation/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({ conversationId })
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // 标记消息为已读
    await Message.updateMany(
      {
        conversationId,
        receiverId: req.user._id,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    res.json({ messages: messages.reverse() });
  } catch (error) {
    logger.error('获取消息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 发送消息
router.post('/', authenticate, messageLimiter, [
  body('receiverId').notEmpty().withMessage('接收者ID不能为空'),
  body('content').trim().notEmpty().withMessage('消息内容不能为空').isLength({ max: 5000 }).withMessage('消息内容不能超过5000个字符'),
  body('questionId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('questionId 格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { receiverId, questionId } = req.body;
    // XSS 过滤消息内容
    const content = sanitize(req.body.content.trim());

    // 验证 receiverId 是否为有效的 ObjectId
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: '无效的用户ID格式' });
    }

    // 检查接收者是否存在
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: '接收者不存在' });
    }

    const conversationId = generateConversationId(req.user._id, receiverId);

    let linkedQuestionId = null;
    if (questionId) {
      const question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({ message: '提问不存在' });
      }
      if (question.conversationId !== conversationId) {
        return res.status(400).json({ message: '提问与当前会话不匹配' });
      }
      linkedQuestionId = question._id;
    }

    const message = new Message({
      conversationId,
      senderId: req.user._id,
      receiverId,
      content,
      type: 'text',
      questionId: linkedQuestionId
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar');

    logger.info('消息发送成功', { 
      senderId: req.user._id, 
      receiverId, 
      conversationId 
    });

    res.status(201).json({
      message: '消息发送成功',
      data: populatedMessage,
      conversationId
    });
  } catch (error) {
    logger.error('发送消息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取与特定用户的会话
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 验证 userId 是否为有效的 ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: '无效的用户ID格式' });
    }

    // 检查用户是否存在
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const conversationId = generateConversationId(req.user._id, userId);

    // 打开会话时标记该会话中“发给我”的未读消息为已读
    await Message.updateMany(
      { conversationId, receiverId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    const { since } = req.query;
    const messageQuery = { conversationId };
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        messageQuery.createdAt = { $gt: sinceDate };
      }
    }

    const messages = await Message.find(messageQuery)
      .select('_id senderId receiverId content type questionId createdAt')
      .sort({ createdAt: 1 })
      .lean();

    // 检查是否有未完成的付费提问
    const pendingQuestion = await Question.findOne({
      conversationId,
      status: { $in: ['pending', 'accepted'] }
    });

    res.json({
      messages,
      conversationId,
      pendingQuestion
    });
  } catch (error) {
    logger.error('获取用户会话错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

router.getContacts = getContacts;
module.exports = router;




