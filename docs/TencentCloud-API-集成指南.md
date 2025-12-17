# 腾讯云身份信息验证API集成指南

## 1. 准备工作

### 1.1 开通腾讯云服务
1. 访问 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 开通 **人脸核身(Face ID)** 服务
3. 获取 **SecretId** 和 **SecretKey**

### 1.2 创建API密钥
1. 进入 [API密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 创建新密钥，保存 SecretId 和 SecretKey

## 2. 后端集成

### 2.1 安装腾讯云SDK

```bash
npm install tencentcloud-sdk-nodejs
```

### 2.2 后端API实现示例

```javascript
// routes/users.js
const tencentcloud = require("tencentcloud-sdk-nodejs");
const FaceidClient = tencentcloud.faceid.v20180301.Client;

// 配置腾讯云
const clientConfig = {
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region: "ap-beijing", // 根据实际情况选择区域
};

const faceidClient = new FaceidClient(clientConfig);

// 实名认证接口
router.post('/verify', authenticate, upload.fields([
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 },
  { name: 'unitProof', maxCount: 1 }
]), async (req, res) => {
  try {
    const { realName, idCard, currentUnit } = req.body;
    const userId = req.user._id;

    // 1. 调用腾讯云API验证身份证信息
    const verifyParams = {
      IdCard: idCard, // 身份证号
      Name: realName,  // 姓名
    };

    const verifyResult = await faceidClient.IdCardVerification(verifyParams);

    // 2. 检查验证结果
    if (verifyResult.Result !== '0') {
      return res.status(400).json({
        message: '身份证信息验证失败',
        error: verifyResult.Description
      });
    }

    // 3. 保存认证信息到数据库
    const verificationData = {
      userId,
      realName,
      idCard: idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1****$2'), // 脱敏处理
      currentUnit,
      idCardFront: req.files.idCardFront[0].path,
      idCardBack: req.files.idCardBack[0].path,
      unitProof: req.files.unitProof[0].path,
      tencentResult: verifyResult, // 保存腾讯云返回结果
      status: 'pending', // pending: 待审核, approved: 已通过, rejected: 已拒绝
      submittedAt: new Date(),
    };

    // 保存到数据库
    await Verification.create(verificationData);

    // 更新用户状态
    await User.findByIdAndUpdate(userId, {
      verificationStatus: 'pending',
      realName: realName,
    });

    res.json({
      message: '认证申请已提交，等待人工审核',
      user: {
        ...req.user.toObject(),
        verificationStatus: 'pending',
        realName: realName,
      }
    });

  } catch (error) {
    console.error('认证错误:', error);
    res.status(500).json({ message: '认证失败，请重试' });
  }
});

// 管理员审核接口
router.post('/verify/approve/:verificationId', adminAuth, async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { approved, reason } = req.body;

    const verification = await Verification.findById(verificationId);
    if (!verification) {
      return res.status(404).json({ message: '认证记录不存在' });
    }

    verification.status = approved ? 'approved' : 'rejected';
    verification.reviewedAt = new Date();
    verification.reviewedBy = req.user._id;
    if (reason) verification.reviewReason = reason;
    await verification.save();

    // 更新用户状态
    await User.findByIdAndUpdate(verification.userId, {
      verificationStatus: approved ? 'verified' : 'rejected',
      isVerified: approved,
    });

    // 如果通过，自动创建"现在单位"标签（2级已认证）
    if (approved) {
      await Tag.create({
        userId: verification.userId,
        name: verification.currentUnit,
        type: 'required',
        level: 2,
        verified: true,
        verifiedAt: new Date(),
      });
    }

    res.json({ message: approved ? '认证已通过' : '认证已拒绝' });
  } catch (error) {
    console.error('审核错误:', error);
    res.status(500).json({ message: '审核失败' });
  }
});
```

### 2.3 环境变量配置

在 `.env` 文件中添加：

```env
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
TENCENT_REGION=ap-beijing
```

## 3. 数据库模型

### 3.1 认证记录模型

```javascript
// models/Verification.js
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  realName: {
    type: String,
    required: true,
  },
  idCard: {
    type: String,
    required: true,
  },
  currentUnit: {
    type: String,
    required: true,
  },
  idCardFront: String,
  idCardBack: String,
  unitProof: String,
  tencentResult: Object, // 腾讯云返回的完整结果
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewReason: String,
});

module.exports = mongoose.model('Verification', verificationSchema);
```

## 4. API调用说明

### 4.1 IdCardVerification API

**接口地址**: `https://faceid.tencentcloudapi.com`

**请求参数**:
- `IdCard` (string, 必填): 身份证号
- `Name` (string, 必填): 姓名

**返回结果**:
```json
{
  "Result": "0",  // 0: 验证通过, 非0: 验证失败
  "Description": "认证通过",
  "Sim": "100"    // 相似度分数
}
```

### 4.2 费用说明

- 按调用次数计费
- 建议查看腾讯云官方定价页面获取最新价格
- 可以申请免费额度进行测试

## 5. 安全建议

1. **敏感信息处理**:
   - 身份证号存储时进行脱敏处理
   - 身份证照片加密存储
   - 定期清理过期的认证材料

2. **API密钥安全**:
   - 不要在前端代码中暴露 SecretId 和 SecretKey
   - 使用环境变量存储密钥
   - 定期轮换密钥

3. **数据保护**:
   - 遵守《个人信息保护法》
   - 明确告知用户数据使用目的
   - 提供数据删除功能

## 6. 测试

### 6.1 测试账号

腾讯云提供测试接口，可以使用测试数据进行验证。

### 6.2 错误处理

```javascript
try {
  const result = await faceidClient.IdCardVerification(params);
  // 处理成功结果
} catch (error) {
  if (error.code === 'InvalidParameter') {
    // 参数错误
  } else if (error.code === 'AuthFailure') {
    // 认证失败，检查密钥
  } else {
    // 其他错误
  }
}
```

## 7. 参考文档

- [腾讯云 Face ID 文档](https://cloud.tencent.com/document/product/1007)
- [IdCardVerification API 文档](https://cloud.tencent.com/document/api/1007/33188)
- [Node.js SDK 文档](https://cloud.tencent.com/document/sdk/Node.js)

