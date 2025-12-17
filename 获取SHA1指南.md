# 📱 获取高德地图 API 所需的 SHA1 和包名

## ✅ 你的包名（PackageName）

**包名**: `com.mobileapp.app`

这个包名已经配置在 `app.json` 文件中，可以直接使用。

---

## 🔑 Keystore 是什么？

**Keystore** 是 Android 应用的签名文件，用于：
- 验证应用的身份
- 确保应用更新时的一致性
- 高德地图需要 SHA1 来验证应用身份

有两种 keystore：
1. **调试版（Debug）**：开发测试时使用
2. **发布版（Release）**：正式发布时使用

---

## 📋 需要的信息

高德地图平台需要：
1. ✅ **包名（PackageName）**: `com.mobileapp.app` （已配置）
2. ⏳ **调试版 SHA1**: 需要获取
3. ⏳ **发布版 SHA1**: 需要创建 keystore 后获取

---

## 🔧 获取 SHA1 的步骤

### 前提条件

需要安装 **Java JDK**（用于 keytool 工具）

如果还没安装：
1. 下载：https://adoptium.net/
2. 选择 JDK 17 LTS
3. 安装后配置环境变量

### 方法一：获取调试版 SHA1（最简单）

调试版使用默认的 debug.keystore，通常位置在：
```
C:\Users\你的用户名\.android\debug.keystore
```

**获取命令**：
```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android -keypass android
```

在输出中找到 `SHA1:` 那一行，复制 SHA1 值。

### 方法二：创建发布版 Keystore 并获取 SHA1

#### 步骤 1: 创建发布版 Keystore

```powershell
cd F:\A\mobile-app
keytool -genkeypair -v -keystore release.keystore -alias release-key -keyalg RSA -keysize 2048 -validity 10000
```

会提示输入：
- **密钥库密码**: 自己设置（记住这个密码！）
- **名字与姓氏**: 可以填公司名或应用名
- **组织单位**: 可选
- **组织**: 可选
- **城市**: 可选
- **省/市/自治区**: 可选
- **国家代码**: CN
- **确认信息**: 输入 yes

#### 步骤 2: 获取发布版 SHA1

```powershell
keytool -list -v -keystore release.keystore -alias release-key
```

输入创建时设置的密码，在输出中找到 `SHA1:` 值。

---

## 🚀 快速操作脚本

我已经创建了一个脚本帮你获取 SHA1，运行：

```powershell
cd F:\A\mobile-app
.\获取SHA1.ps1
```

---

## 📝 填写高德地图平台

在高德开放平台的应用管理页面填写：

1. **发布版安全码 SHA1**: 发布版 keystore 的 SHA1
2. **调试版安全码 SHA1**: debug.keystore 的 SHA1
3. **PackageName**: `com.mobileapp.app`

---

## ⚠️ 注意事项

1. **保存好 keystore 文件**：`release.keystore` 和密码很重要，丢失后无法更新应用
2. **不要提交到 Git**：将 `*.keystore` 添加到 `.gitignore`
3. **SHA1 是十六进制字符串**：类似 `A1:B2:C3:D4:...` 的格式

---

需要我帮你创建获取 SHA1 的脚本吗？

