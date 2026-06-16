/**
 * server.js - 本地 HTTP 服务器
 * 用于在手机上访问菜农记账 App
 * 使用: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3458;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(ROOT, url);

  // 安全检查：防止目录遍历
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 对于 SPA，返回 index.html（虽然这里不是真正 SPA）
        fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('404 Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
      return;
    }

    // PWA 需要的 Service Worker 缓存头
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    };

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('=== 菜农记账 App 已启动 ===');
  console.log('');
  console.log('  本机: http://localhost:' + PORT);
  console.log('  网络: http://' + localIP + ':' + PORT);
  console.log('');
  console.log('  确保手机和电脑连接同一个 WiFi');
  console.log('  在手机 Chrome 中打开上方地址后，');
  console.log('  选择"添加到主屏幕"即可安装');
  console.log('');
  console.log('  按 Ctrl+C 停止服务器');
});
/** Update File: E:\菜农记账\server.js */
