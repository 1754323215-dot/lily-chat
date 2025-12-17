# Lily Chat Server

Lily Chat 后端服务器 - 基于地图的社交聊天平台

## 项目结构

```
lily-chat-server/
├── models/           # 数据模型
│   ├── User.js      # 用户模型
│   ├── Tag.js       # 标签模型
│   ├── Question.js  # 付费提问模型
│   └── Message.js    # 消息模型
├── routes/          # 路由
│   ├── auth.js      # 认证路由
│   ├── users.js     # 用户路由
│   ├── tags.js      # 标签路由
│   ├── questions.js # 提问路由
│   └── messages.js   # 消息路由
├── uploads/         # 上传文件目录
├── server.js        # 服务器入口
├── package.json     # 项目配置
└── .env            # 环境变量（需创建）
```

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并修改配置：

```bash
cp env.example .env
```

### 3. 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API 文档

### 认证相关

- `POST /api/auth/register` - 用户注册（用户名+真实姓名+身份证号）
- `POST /api/auth/login` - 用户登录（用户名+身份证号）
- `GET /api/auth/me` - 获取当前用户信息

### 用户相关

- `POST /api/users/location` - 更新用户位置
- `POST /api/users/nearby` - 获取附近用户
- `GET /api/users/:userId` - 获取用户详情
- `PUT /api/users/profile` - 更新用户资料

### 标签相关

- `GET /api/tags/my` - 获取我的标签
- `POST /api/tags` - 添加标签（含证明材料）
- `DELETE /api/tags/:tagId` - 删除标签

### 提问相关

- `POST /api/questions` - 创建付费提问
- `POST /api/questions/:questionId/accept` - 接受提问
- `POST /api/questions/:questionId/reject` - 拒绝提问
- `POST /api/questions/:questionId/answer` - 回答提问
- `GET /api/questions/my-asked` - 获取我发起的提问
- `GET /api/questions/my-received` - 获取我收到的提问
- `POST /api/questions/:questionId/dispute` - 申诉提问

### 消息相关

- `GET /api/messages/conversations` - 获取会话列表
- `GET /api/messages/conversation/:conversationId` - 获取会话消息
- `POST /api/messages` - 发送消息
- `GET /api/messages/user/:userId` - 获取与特定用户的会话

## 功能特性

- ✅ 用户认证（用户名+身份证号）
- ✅ 位置更新和附近用户查询
- ✅ 标签管理和认证
- ✅ 付费提问系统
- ✅ 实时消息聊天（Socket.IO）
- ✅ 24小时自动放款机制
- ✅ 申诉系统

## 部署说明

服务器端口：8083（与campus trading的8081端口分离）

数据库：lily-chat（独立的MongoDB数据库）
