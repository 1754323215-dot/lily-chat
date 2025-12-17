const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据模型
const User = require('./models/User');
const Tag = require('./models/Tag');
const Question = require('./models/Question');
const Message = require('./models/Message');

// 确保虚拟用户存在（测试用）
const ensureDummyUserExists = async () => {
  try {
    const dummyUsername = 'test_teacher';
    let dummyUser = await User.findOne({ username: dummyUsername });
    
    if (!dummyUser) {
      // 创建虚拟用户（初始位置会在用户第一次更新位置时自动调整）
      const avatarSeed = `test_teacher_${Date.now()}`;
      dummyUser = new User({
        username: dummyUsername,
        realName: '测试老师',
        idCard: '370123199001011234',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
        balance: 500,
        location: {
          latitude: 39.9042,  // 临时位置，会在用户更新位置时自动调整
          longitude: 116.4074,
          address: '测试位置（待用户定位后自动调整）',
          lastUpdate: new Date()  // 确保 lastUpdate 是最新的
        }
      });
      
      await dummyUser.save();
      console.log('✅ 虚拟用户已创建:', dummyUser.username, `(ID: ${dummyUser._id})`);
      console.log('📍 虚拟用户初始位置: 39.9042, 116.4074（将在用户更新位置时自动调整到用户附近）');
    } else {
      // 确保虚拟用户有位置信息和最新的 lastUpdate
      const now = new Date();
      const needsUpdate = !dummyUser.location || 
                         !dummyUser.location.latitude || 
                         !dummyUser.location.lastUpdate ||
                         (now - new Date(dummyUser.location.lastUpdate)) > 24 * 60 * 60 * 1000;
      
      if (needsUpdate) {
        // 如果位置缺失或 lastUpdate 过期，更新为临时位置
        dummyUser.location = {
          latitude: dummyUser.location?.latitude || 39.9042,
          longitude: dummyUser.location?.longitude || 116.4074,
          address: dummyUser.location?.address || '测试位置（待用户定位后自动调整）',
          lastUpdate: now
        };
        await dummyUser.save();
        console.log('✅ 虚拟用户位置信息已更新:', dummyUser.username);
      } else {
        console.log('✅ 虚拟用户已存在:', dummyUser.username, `(ID: ${dummyUser._id})`);
        console.log(`📍 虚拟用户位置: ${dummyUser.location.latitude}, ${dummyUser.location.longitude}`);
      }
    }
  } catch (error) {
    console.error('❌ 创建/检查虚拟用户失败:', error);
    console.error('错误详情:', error.message);
    // 不阻止服务器启动，只记录错误
  }
};

// 数据库连接
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lily-chat');
    console.log('✅ MongoDB连接成功 (lily-chat数据库)');
    
    // 数据库连接成功后，确保虚拟用户存在
    await ensureDummyUserExists();
  } catch (error) {
    console.error('❌ MongoDB连接失败:', error);
    process.exit(1);
  }
};

connectDB();

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/messages', require('./routes/messages'));

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`用户加入房间: ${roomId}`);
  });

  socket.on('send-message', async (data) => {
    try {
      const message = new Message({
        conversationId: data.conversationId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || 'text'
      });
      await message.save();
      
      io.to(data.conversationId).emit('new-message', message);
    } catch (error) {
      console.error('发送消息错误:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

// 定时任务：24小时后自动放款
cron.schedule('*/10 * * * *', async () => {
  try {
    const Question = require('./models/Question');
    const User = require('./models/User');
    
    const now = new Date();
    const questions = await Question.find({
      status: 'accepted',
      acceptedAt: { $exists: true },
      paidAt: { $exists: false }
    });

    for (const question of questions) {
      const acceptedTime = new Date(question.acceptedAt);
      const hoursDiff = (now - acceptedTime) / (1000 * 60 * 60);
      
      if (hoursDiff >= 24) {
        // 自动放款给被提问者
        const answerer = await User.findById(question.answererId);
        if (answerer) {
          answerer.balance = (answerer.balance || 0) + question.price;
          await answerer.save();
          
          question.status = 'completed';
          question.paidAt = now;
          await question.save();
          
          // 通知被提问者
          io.emit('question-paid', {
            questionId: question._id,
            amount: question.price
          });
          
          console.log(`自动放款: 问题 ${question._id} 已支付 ${question.price} 元给用户 ${answerer.username}`);
        }
      }
    }
  } catch (error) {
    console.error('自动放款任务错误:', error);
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'lily-chat-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 8083;
server.listen(PORT, () => {
  console.log(`🚀 Lily Chat 服务器运行在端口 ${PORT}`);
});




