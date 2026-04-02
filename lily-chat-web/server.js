import express from 'express';
import fs from 'fs';
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

/** 缓存 dist/index.html 原文；运行时若设置 AMAP_SECURITY_CODE 则注入到 window.__AMAP_SECURITY_CODE__ */
let indexHtmlTemplate = null;
function readIndexHtmlTemplate() {
  if (!indexHtmlTemplate) {
    indexHtmlTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
  }
  return indexHtmlTemplate;
}

function sendIndexHtml(res) {
  let html = readIndexHtmlTemplate();
  const code = process.env.AMAP_SECURITY_CODE || '';
  if (code) {
    html = html.replace(
      /window\.__AMAP_SECURITY_CODE__\s*=\s*['"][^'"]*['"]/,
      `window.__AMAP_SECURITY_CODE__ = ${JSON.stringify(code)}`,
    );
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

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

// 后端在 8083 上托管 /uploads（收款码等静态文件）；前端站点需把 /uploads 转到后端，否则 <img src="/uploads/..."> 会 404
app.use('/uploads', (req, res) => {
  const url = new URL(req.originalUrl || req.url, `http://${req.headers.host || 'localhost'}`);
  const backend = new URL(API_BACKEND);
  const opts = {
    hostname: backend.hostname,
    port: backend.port || (backend.protocol === 'https:' ? 443 : 80),
    path: url.pathname + (url.search || ''),
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
    console.error('Uploads proxy error:', err.message);
    res.status(502).json({ message: '后端服务暂时不可用' });
  });
  req.pipe(proxyReq, { end: true });
});

// 必须在 express.static 之前：否则 GET / 会直接返回 dist/index.html，无法注入高德安全密钥
app.get(/^\/(?!.*\.).*$/, (_req, res) => {
  sendIndexHtml(res);
});

app.use(express.static(distPath));

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const networks = os.networkInterfaces();
  console.log('Lily Chat 网页端已启动');
  console.log(`本地访问:  http://localhost:${PORT}`);
  console.log(`外部访问: http://139.129.194.84:${PORT}`);
  console.log('服务器网络接口:', Object.keys(networks));
  console.log(
    `AMAP_SECURITY_CODE: ${process.env.AMAP_SECURITY_CODE ? '已设置(注入 index.html)' : '未设置(若 Key 需安全校验则底图可能白屏)'}`,
  );
});

server.on('error', (err) => {
  console.error('服务器启动失败:', err);
});

