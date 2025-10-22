// proxy.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// 代理所有请求到 3000 端口的后端
app.use('/', createProxyMiddleware({
    target: 'http://134.134.64.196:3000',
    changeOrigin: true,
    ws: true, // 如果有 websocket 支持
    onProxyReq(proxyReq, req, res) {
        console.log(`[Proxy] ${req.method} ${req.originalUrl} -> 3000`);
    }
}));

app.listen(8888, () => {
    console.log('🚀 Proxy server running at http://localhost:8888');
});
