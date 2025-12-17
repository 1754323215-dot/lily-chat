const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8084;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，支持远程访问

// #region agent log
const LOG_PATH = path.join(__dirname, '..', '.cursor', 'debug.log');
const log = (data) => {
  try {
    const logEntry = JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      timestamp: Date.now(),
      ...data
    }) + '\n';
    fs.appendFileSync(LOG_PATH, logEntry, 'utf8');
  } catch (err) {
    console.error('Log write error:', err.message);
  }
};
log({ location: 'server.js:10', message: 'Server initialization', data: { PORT, HOST, envPORT: process.env.PORT, envHOST: process.env.HOST } });
// #endregion

// 提供静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// #region agent log
app.use((req, res, next) => {
  log({ location: 'server.js:18', message: 'Incoming request', data: { method: req.method, url: req.url, ip: req.ip, headers: { host: req.headers.host, 'user-agent': req.headers['user-agent'] } }, hypothesisId: 'D' });
  next();
});
// #endregion

// 路由：首页
app.get('/', (req, res) => {
  // #region agent log
  log({ location: 'server.js:25', message: 'Root route handler called', data: { ip: req.ip, url: req.url }, hypothesisId: 'E' });
  // #endregion
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// #region agent log
log({ location: 'server.js:46', message: 'Before listen', data: { HOST, PORT, processEnvHOST: process.env.HOST, processEnvPORT: process.env.PORT }, hypothesisId: 'B' });
const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const networkInterfaces = os.networkInterfaces();
  log({ location: 'server.js:48', message: 'Server started', data: { address, port: address.port, family: address.family, HOST, PORT, actualAddress: address.address, networkInterfaces, isLocalhost: address.address === '127.0.0.1' || address.address === '::1' }, hypothesisId: 'A' });
  console.log(`Lily官网服务器运行在 http://${HOST}:${PORT}`);
  console.log(`实际绑定地址: ${address.address}:${address.port}`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`外部访问: http://139.129.194.84:${PORT}`);
  console.log('按 Ctrl+C 停止服务器');
});

server.on('error', (err) => {
  log({ location: 'server.js:59', message: 'Server error', data: { error: err.message, code: err.code, HOST, PORT, errno: err.errno, syscall: err.syscall }, hypothesisId: 'A' });
  console.error('Server error:', err);
});

server.on('listening', () => {
  const address = server.address();
  log({ location: 'server.js:64', message: 'Server listening event', data: { address, actualBind: address.address, port: address.port, HOST, PORT }, hypothesisId: 'A' });
});
// #endregion

