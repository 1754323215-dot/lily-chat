import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8086;
const HOST = process.env.HOST || '0.0.0.0';
const API_BACKEND = process.env.API_BACKEND || 'http://127.0.0.1:8083';

const distPath = path.join(__dirname, 'dist');

// Proxy /api to backend (8083) so login and messages work (stream body, no parse)
app.use('/api', (req, res, next) => {
  const url = new URL(req.originalUrl || req.url, `http://${req.headers.host || 'localhost'}`);
  const targetPath = url.pathname.startsWith('/api') ? url.pathname : '/api' + url.pathname;
  const backend = new URL(API_BACKEND);
  const opts = {
    hostname: backend.hostname,
    port: backend.port || (backend.protocol === 'https:' ? 443 : 80),
    path: targetPath + (url.search || ''),
    method: req.method,
    headers: { ...req.headers, host: backend.host },
  };
  delete opts.headers['host'];
  opts.headers['Host'] = backend.host;
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('API proxy error:', err.message);
    res.status(502).json({ message: '后端服务暂时不可用' });
  });
  req.pipe(proxyReq, { end: true });
});

app.use(express.static(distPath));

// SPA fallback: serve index.html for any non-file GET (Express 5 compatible)
app.get(/^\/(?!.*\.).*$/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const networks = os.networkInterfaces();
  console.log('Lily Chat 网页端已启动');
  console.log(`本地访问:  http://localhost:${PORT}`);
  console.log(`外部访问: http://139.129.194.84:${PORT}`);
  console.log('服务器网络接口:', Object.keys(networks));
});

server.on('error', (err) => {
  console.error('服务器启动失败:', err);
});

