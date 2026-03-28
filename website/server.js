const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8084;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，支持远程访问

// 提供静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 路由：首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  console.log(`Lily官网服务器运行在 http://${HOST}:${PORT}`);
  console.log(`实际绑定地址: ${address.address}:${address.port}`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`外部访问: http://139.129.194.84:${PORT}`);
  console.log('按 Ctrl+C 停止服务器');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
