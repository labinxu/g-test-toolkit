import { Injectable } from '@nestjs/common'
import { createProxyMiddleware, Options } from 'http-proxy-middleware'

@Injectable()
export class ProxyService {
  createProxy(targetUrl: string) {
    const proxyOptions: Options = {
      target: targetUrl,
      changeOrigin: true,
      ws: true, // 启用 WebSocket 代理
      pathRewrite: {
        '^/proxy': '', // 移除 /proxy 前缀
      },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }, // 添加浏览器头
      followRedirects: true, // 跟随重定向
      timeout: 10000, // 超时10秒
      on: {
        proxyReq: (proxyReq, req, res) => {
          console.log('Proxy request sent to:', targetUrl, 'Path:', req.url)
        },
        proxyRes: (proxyRes, req, res) => {
          console.log('Proxy response status:', proxyRes.statusCode)
          console.log('Proxy response headers:', proxyRes.headers)
          // 添加 CORS 头
          proxyRes.headers['Access-Control-Allow-Origin'] = '*'
          proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE'
          proxyRes.headers['Access-Control-Allow-Credentials'] = 'true'
          // 移除 X-Frame-Options 以允许 iframe 嵌入
          delete proxyRes.headers['x-frame-options']
        },
        error: (err, req, res) => {
          console.error('Proxy middleware error:', err)
        },
      },
    }

    return createProxyMiddleware(proxyOptions)
  }
}
