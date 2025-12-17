# Lily Chat - 移动应用项目

## 🔗 GitHub 仓库

**仓库地址**: [https://github.com/1754323215-dot/lily-chat](https://github.com/1754323215-dot/lily-chat)

## 📱 项目信息

- **包名**: `com.mobileapp.app`
- **高德地图 Key**: `35087dc1b05164e65ec902e8523fc388`

## ✅ 已完成的配置

1. ✅ 项目初始化（Expo）
2. ✅ 包名配置：`com.mobileapp.app`
3. ✅ 高德地图 API Key 配置
4. ✅ 依赖安装：
   - react-native-amap3d
   - expo-location
   - axios
   - @react-native-async-storage/async-storage
   - react-native-webview
5. ✅ 基础地图页面创建

## 🚀 运行项目

### 开发模式

```bash
cd F:\A\mobile-app
npm start
```

### Android 设备

```bash
npm run android
```

### iOS 设备（需要 Mac）

```bash
npm run ios
```

### Web 浏览器

```bash
npm run web
```

## 📋 下一步开发

### 1. 测试地图功能

运行项目后，应该能看到：
- 地图正常显示
- 用户位置标记
- 定位功能正常

### 2. 添加功能

根据需求添加：
- 区域划分
- 标记点
- 搜索功能
- 其他业务功能

### 3. 配置后端 API

如果需要连接后端，编辑 `constants/config.js`：
```javascript
export const API_BASE_URL = 'http://你的后端地址/api';
```

## 📝 重要信息

### 高德地图配置

- **API Key**: `35087dc1b05164e65ec902e8523fc388`
- **包名**: `com.mobileapp.app`
- **SHA1**: `D0:62:D8:C2:E4:B5:49:97:42:2C:A9:60:2F:CA:C4:0D:90:AF:B2:68`

### 文件结构

```
mobile-app/
├── screens/          # 页面组件
│   └── MapScreen.js  # 地图页面
├── constants/        # 配置常量
│   └── config.js    # API Key 等配置
├── components/       # 可复用组件
├── services/         # API 服务
├── utils/           # 工具函数
└── App.js           # 应用入口
```

## 🔄 代码更新流程

### 本地开发 → GitHub → 服务器部署

1. **本地修改代码后提交到 GitHub**：
   ```bash
   git add .
   git commit -m "描述更改内容"
   git push
   ```

2. **服务器从 GitHub 拉取并部署**：
   ```bash
   # 在服务器上执行
   bash deploy.sh
   # 或手动执行
   git pull origin main
   ```

详细部署流程请参考：[部署流程.md](部署流程.md)

## ⚠️ 注意事项

1. **定位权限**: 首次运行会请求定位权限，必须授权
2. **高德地图 Key**: 确保在高德平台正确配置了包名和 SHA1
3. **网络连接**: 地图需要网络连接才能加载
4. **Git 工作流**: 代码更新先推送到 GitHub，再从 GitHub 部署到服务器

## 🔧 常见问题

### 地图不显示

- 检查网络连接
- 检查高德地图 Key 是否正确
- 检查高德平台中是否配置了正确的包名和 SHA1

### 定位失败

- 检查是否授予了定位权限
- 检查设备定位服务是否开启

