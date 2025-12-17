// 应用配置常量

// 高德地图 API Key（WebView 内使用）
// 来自高德开放平台 lily chat 应用的 Key
// Key 名称：lily chat
// 绑定服务：Web端
export const AMAP_KEY = '944bd085212b846ede2315d3d240a199';

// 后端 API 地址
// 说明：
// - 8083: lilychat-server（登录/注册/二要素、附近用户）
// - 8082: lily（旧点评后端，JWT/密码登录，含消息查询等）
// 当前移动端优先接入 8083，若需切换 8082 请调整 API_BASE_URL
export const API_BASE_URL = 'http://139.129.194.84:8083/api';
// export const API_BASE_URL = 'http://192.168.1.10:8083/api';  // 本地开发

// Token 工具函数
// 后端期望 token 格式：token-{userId}
// 确保 token 格式正确
export const formatToken = (token) => {
  if (!token) return null;
  // 如果 token 已经以 token- 开头，直接返回
  if (token.startsWith('token-')) {
    return token;
  }
  // 否则添加 token- 前缀
  return `token-${token}`;
};
