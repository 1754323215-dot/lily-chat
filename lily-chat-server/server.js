const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
const logger = require('./utils/logger');
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

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据模型
const User = require('./models/User');
const Tag = require('./models/Tag');
const Question = require('./models/Question');
const Message = require('./models/Message');

// 数据库连接
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lily-chat');
    logger.info('✅ MongoDB连接成功 (lily-chat数据库)');
  } catch (error) {
    logger.error('❌ MongoDB连接失败:', error);
    process.exit(1);
  }
};

connectDB();

// 路由
const { authenticate } = require('./routes/auth');
const messagesRouter = require('./routes/messages');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/messages', messagesRouter);
app.get('/api/v1/contacts', authenticate, messagesRouter.getContacts);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/feedback', require('./routes/feedback'));

// Socket.IO 连接处理
io.on('connection', (socket) => {
  logger.info('Socket.IO 用户连接:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    logger.debug(`用户加入房间: ${roomId}`);
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
      logger.error('Socket.IO 发送消息错误:', error);
    }
  });

  socket.on('disconnect', () => {
    logger.info('Socket.IO 用户断开连接:', socket.id);
  });
});

// 定时任务：24小时后自动放款（已禁用，改为用户自行支付）
// cron.schedule('*/10 * * * *', async () => {
//   try {
//     const Question = require('./models/Question');
//     const User = require('./models/User');
//     
//     const now = new Date();
//     const questions = await Question.find({
//       status: 'accepted',
//       acceptedAt: { $exists: true },
//       paidAt: { $exists: false }
//     });

//     for (const question of questions) {
//       const acceptedTime = new Date(question.acceptedAt);
//       const hoursDiff = (now - acceptedTime) / (1000 * 60 * 60);
//       
//       if (hoursDiff >= 24) {
//         // 自动放款给被提问者
//         const answerer = await User.findById(question.answererId);
//         if (answerer) {
//           answerer.balance = (answerer.balance || 0) + question.price;
//           await answerer.save();
//           
//           question.status = 'completed';
//           question.paidAt = now;
//           await question.save();
//           
//           // 通知被提问者
//           io.emit('question-paid', {
//             questionId: question._id,
//             amount: question.price
//           });
//           
//           console.log(`自动放款: 问题 ${question._id} 已支付 ${question.price} 元给用户 ${answerer.username}`);
//         }
//       }
//     }
//   } catch (error) {
//     console.error('自动放款任务错误:', error);
//   }
// });

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
  logger.info(`🚀 Lily Chat 服务器运行在端口 ${PORT}`);
  logger.info(`📝 环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 安全警告
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'lily-chat-secret-key-change-in-production') {
    logger.warn('⚠️  警告: JWT_SECRET 未设置或使用默认值！');
  }
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('⚠️  警告: ENCRYPTION_KEY 未设置，将使用临时密钥（重启后会变化）！');
  }
});




