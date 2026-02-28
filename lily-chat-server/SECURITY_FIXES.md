# 安全修复总结

## 已完成的修复（2024）

### ✅ 高优先级修复

#### 1. JWT Token 安全
- ✅ 使用环境变量 `JWT_SECRET`（不再使用硬编码默认值）
- ✅ 添加 Token 过期机制（默认 7 天）
- ✅ 添加刷新 Token 机制（30 天有效期）
- ✅ 支持向后兼容的旧格式 token
- ✅ 添加 `/api/auth/refresh` 接口用于刷新 Token

#### 2. 身份证号加密存储
- ✅ 使用 AES-256-CBC 加密算法
- ✅ 身份证号在保存时自动加密
- ✅ 添加 `findByEncryptedIdCard` 静态方法用于登录验证
- ✅ 兼容旧数据（未加密的身份证号仍可正常使用）

#### 3. API 速率限制
- ✅ 全局 API 限制：每分钟 100 次请求
- ✅ 登录/注册限制：15 分钟内最多 5 次尝试
- ✅ 消息发送限制：每分钟最多 30 条消息
- ✅ 提问创建限制：每分钟最多 10 个提问

#### 4. XSS 攻击防护
- ✅ 使用 DOMPurify 过滤所有用户输入
- ✅ 消息内容、提问内容、回答内容均经过 XSS 过滤
- ✅ 用户名、真实姓名等字段也进行过滤

#### 5. 结构化日志系统
- ✅ 使用 Winston 日志库
- ✅ 日志文件自动轮转（5MB，保留 5 个文件）
- ✅ 错误日志单独记录到 `error.log`
- ✅ 所有日志记录到 `combined.log`
- ✅ 开发环境同时输出到控制台

### 📝 环境变量配置

新增必需的环境变量：

```bash
# JWT 配置
JWT_SECRET=your-strong-random-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
TOKEN_REFRESH_EXPIRES_IN=30d

# 数据加密密钥
ENCRYPTION_KEY=your-encryption-key-min-32-chars

# 日志级别
LOG_LEVEL=info
```

### 🔧 生成密钥的方法

```bash
# 生成 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 生成 ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 📦 新增依赖

```json
{
  "express-rate-limit": "^7.1.5",
  "winston": "^3.11.0",
  "dompurify": "^3.0.6",
  "jsdom": "^23.0.1"
}
```

### 🚀 部署前检查清单

- [ ] 设置 `JWT_SECRET` 环境变量（强随机密钥）
- [ ] 设置 `ENCRYPTION_KEY` 环境变量（强随机密钥）
- [ ] 确保 `.env` 文件不在版本控制中（已在 `.gitignore`）
- [ ] 检查日志目录权限（`logs/` 目录需要写入权限）
- [ ] 测试 Token 刷新功能
- [ ] 测试速率限制是否正常工作
- [ ] 验证身份证号加密/解密功能

### ⚠️ 重要提示

1. **密钥安全**：生产环境必须设置强随机密钥，不要使用默认值
2. **数据迁移**：现有用户的身份证号会在下次保存时自动加密
3. **向后兼容**：系统仍支持旧的 `token-{userId}` 格式，但建议迁移到 JWT
4. **日志文件**：定期清理日志文件，避免占用过多磁盘空间

### 📚 相关文件

- `utils/encryption.js` - 加密工具
- `utils/logger.js` - 日志系统
- `utils/xssFilter.js` - XSS 过滤工具
- `middleware/rateLimiter.js` - 速率限制中间件
- `routes/auth.js` - 认证路由（已更新）
- `models/User.js` - 用户模型（已添加加密支持）

### 🔄 后续建议

1. **数据备份**：设置定期数据库备份
2. **HTTPS**：生产环境必须使用 HTTPS
3. **监控告警**：添加系统监控和异常告警
4. **管理员后台**：实现管理员统计和监控接口
5. **审计日志**：记录敏感操作（登录、支付等）

