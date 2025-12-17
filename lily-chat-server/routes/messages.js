const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Question = require('../models/Question');
const { authenticate } = require('./auth');
const router = express.Router();

// 生成会话ID
function generateConversationId(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `conv_${ids[0]}_${ids[1]}`;
}

// 获取联系人列表（用于聊天页面）
router.get('/contacts', authenticate, async (req, res) => {
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

    // 获取所有联系过的用户ID
    const contactUserIds = new Set();
    const contactMap = new Map();

    messages.forEach(msg => {
      const otherUserId = msg.senderId._id.toString() === req.user._id.toString() 
        ? msg.receiverId._id 
        : msg.senderId._id;
      
      const otherUser = msg.senderId._id.toString() === req.user._id.toString() 
        ? msg.receiverId 
        : msg.senderId;

      if (!contactMap.has(otherUserId.toString())) {
        contactMap.set(otherUserId.toString(), {
          id: otherUserId,
          username: otherUser.username,
          avatar: otherUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`,
          lastMessage: msg.content,
          lastTime: msg.createdAt
        });
      } else {
        // 更新最后一条消息（如果这条消息更新）
        const existing = contactMap.get(otherUserId.toString());
        if (new Date(msg.createdAt) > new Date(existing.lastTime)) {
          existing.lastMessage = msg.content;
          existing.lastTime = msg.createdAt;
        }
      }
    });

    const contacts = Array.from(contactMap.values());
    
    res.json(contacts);
  } catch (error) {
    console.error('获取联系人列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

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
    console.error('获取会话列表错误:', error);
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
    console.error('获取消息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 发送消息
router.post('/', authenticate, [
  body('receiverId').notEmpty().withMessage('接收者ID不能为空'),
  body('content').trim().notEmpty().withMessage('消息内容不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { receiverId, content } = req.body;

    const conversationId = generateConversationId(req.user._id, receiverId);

    const message = new Message({
      conversationId,
      senderId: req.user._id,
      receiverId,
      content,
      type: 'text'
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar');

    res.status(201).json({
      message: '消息发送成功',
      data: populatedMessage,
      conversationId
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取与特定用户的会话
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const conversationId = generateConversationId(req.user._id, req.params.userId);

    const messages = await Message.find({ conversationId })
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar')
      .sort({ createdAt: 1 });

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
    console.error('获取用户会话错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;




