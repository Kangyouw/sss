import http from 'http';
import https from 'https';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';

// 直接读取和解析.env文件
function loadEnvFile() {
    const envPath = path.join(dirname(fileURLToPath(import.meta.url)), '.env');
    if (fs.existsSync(envPath)) {
        try {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\n');
            
            for (const line of lines) {
                // 忽略空行和注释行
                if (line.trim() === '' || line.trim().startsWith('#')) continue;
                
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            }
            console.log('[服务器] 已加载.env文件');
        } catch (error) {
            console.error('[服务器] 读取.env文件失败:', error.message);
        }
    }
}

// 加载环境变量
loadEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8787;
const DEBUG = process.env.DEBUG === 'true';
// 使用ES模块方式定义公共目录路径
const PUBLIC_DIR = dirname(fileURLToPath(import.meta.url));

// 详细日志函数
function logDebug(message) {
    if (DEBUG) {
        console.log(`[服务器-DEBUG] ${message}`);
    }
}

function logError(message, error = null) {
    console.error(`[服务器-错误] ${message}`);
    if (error) {
        console.error(`[服务器-错误] 错误详情: ${error.message}`);
        if (DEBUG) {
            console.error(`[服务器-错误] 堆栈: ${error.stack}`);
        }
    }
}

// 支持的文件类型
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

// 创建服务器
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url}`);
  
  // 捕获响应完成事件以记录响应时间
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] ${res.statusCode} ${duration}ms`);
  });
  
  // 处理代理请求 - 增强版
  if (req.url.startsWith('/proxy/')) {
    let targetUrl = null;
    let proxyReq = null;
    
    try {
      const authParam = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('auth');
      const timestamp = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('t');
      
      logDebug(`[${requestId}] 验证参数 - auth: ${authParam ? '存在' : '不存在'}, timestamp: ${timestamp ? '存在' : '不存在'}`);
      
      // 生成密码的SHA-256哈希用于验证
      const passwordHash = process.env.PASSWORD ? createHash('sha256').update(process.env.PASSWORD).digest('hex') : '';
      
      // 验证时间戳（10分钟有效期）
      if (timestamp) {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000;
        if (now - parseInt(timestamp) > maxAge) {
          console.warn(`[${requestId}] 代理请求时间戳过期`);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '代理请求时间戳过期' }));
          return;
        }
      }
      
      // 验证auth参数
      if (authParam !== passwordHash) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '代理请求未授权' }));
        console.log(`[${requestId}] 代理请求未授权: ${req.url}`);
        return;
      }
      
      // 提取要代理的URL
      const proxyPath = req.url.replace(/^\/proxy\//, '');
      
      try {
        targetUrl = decodeURIComponent(proxyPath.split('?')[0]); // 移除查询参数部分
        // 记录目标URL的域名，不记录完整URL以保护隐私
        const urlObj = new URL(targetUrl);
        console.log(`[${requestId}] 代理到域名: ${urlObj.hostname}`);
        logDebug(`[${requestId}] 完整代理URL: ${targetUrl}`);
      } catch (err) {
        logError(`[${requestId}] URL解码失败`, err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '无效的URL编码' }));
        return;
      }
      
      // 验证URL格式
      if (!targetUrl.match(/^https?:\/\/.+/i)) {
        logError(`[${requestId}] 无效的目标URL: ${targetUrl}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '无效的目标URL' }));
        return;
      }
      
      // 解析URL以确定使用http还是https
      const url = new URL(targetUrl);
      const httpModule = url.protocol === 'https:' ? https : http;
      
      // 提取请求头
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        // 跳过主机头，使用目标URL的主机
        if (key.toLowerCase() !== 'host') {
          headers[key] = value;
        }
      }
      
      // 设置更全面的请求头
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept'] = '*/*';
      headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8';
      headers['Referer'] = url.origin + '/';
      
      // 创建代理请求选项
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: headers,
        timeout: 20000, // 增加超时时间到20秒
        // 添加连接保持选项
        keepAlive: true
      };
      
      // 发送代理请求
      proxyReq = httpModule.request(options, (proxyRes) => {
        logDebug(`[${requestId}] 收到代理响应，状态码: ${proxyRes.statusCode}`);
        
        // 构建响应头，过滤掉可能导致问题的头
        const responseHeaders = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (key.toLowerCase() !== 'connection' &&
              key.toLowerCase() !== 'access-control-allow-origin') {
            responseHeaders[key] = value;
          }
        }
        // 添加CORS支持
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        
        // 设置响应头和状态码
        res.writeHead(proxyRes.statusCode, responseHeaders);
        
        // 转发响应内容
        proxyRes.pipe(res);
        
        // 错误处理
        proxyRes.on('error', (err) => {
          logError(`[${requestId}] 代理响应错误`, err);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '代理响应错误' }));
          }
        });
      });
      
      // 处理代理请求错误 - 特别关注连接拒绝错误
      proxyReq.on('error', (error) => {
        logError(`[${requestId}] 代理请求错误`, error);
        
        if (!res.headersSent) {
          // 根据错误类型返回不同的错误信息
          const urlObj = new URL(targetUrl);
          const responseHeaders = { 'Content-Type': 'application/json' };
          
          if (error.code === 'ECONNREFUSED') {
            console.error(`[${requestId}] 连接被拒绝: 无法连接到 ${urlObj.hostname}`);
            res.writeHead(502, responseHeaders);
            res.end(JSON.stringify({
              success: false,
              error: `连接被拒绝: 无法连接到目标服务器 ${urlObj.hostname}，可能是服务器不可用或网络限制`,
              code: 'ECONNREFUSED',
              targetHost: urlObj.hostname
            }));
          } else if (error.code === 'ENOTFOUND') {
            res.writeHead(502, responseHeaders);
            res.end(JSON.stringify({
              success: false,
              error: `域名解析失败: 无法解析 ${urlObj.hostname}，可能是域名不存在或DNS问题`,
              code: 'ENOTFOUND',
              targetHost: urlObj.hostname
            }));
          } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
            res.writeHead(504, responseHeaders);
            res.end(JSON.stringify({
              success: false,
              error: `连接问题: ${error.code === 'ETIMEDOUT' ? '连接超时' : '连接重置'}，可能是网络延迟或服务器响应慢`,
              code: error.code,
              targetHost: urlObj.hostname
            }));
          } else {
            res.writeHead(502, responseHeaders);
            res.end(JSON.stringify({
              success: false,
              error: `代理请求错误: ${error.message}`,
              code: error.code || 'UNKNOWN',
              targetHost: urlObj.hostname
            }));
          }
        }
      });
      
      // 处理超时
      proxyReq.on('timeout', () => {
        logError(`[${requestId}] 代理请求超时`);
        proxyReq.destroy();
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: '代理请求超时',
            code: 'TIMEOUT'
          }));
        }
      });
      
      // 转发请求体
      req.pipe(proxyReq);
      
    } catch (err) {
      logError(`[${requestId}] 代理处理错误`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `代理处理错误: ${err.message}`,
          targetUrl: targetUrl
        }));
      }
    } finally {
      // 确保在连接关闭时销毁代理请求
      req.on('close', () => {
        if (proxyReq && !proxyReq.finished) {
          logDebug(`[${requestId}] 客户端断开连接，中止代理请求`);
          proxyReq.destroy();
        }
      });
    }
    
    return;
  }
  
  // 处理根路径请求
  let filePath = req.url;
  
  // 移除查询参数
  const queryIndex = filePath.indexOf('?');
  if (queryIndex !== -1) {
    filePath = filePath.substring(0, queryIndex);
  }
  
  // 如果是根路径，返回index.html
  if (filePath === '/' || filePath === '') {
    filePath = '/index.html';
  }
  
  // 构建完整文件路径
  const fullPath = path.resolve(PUBLIC_DIR, filePath.substring(1)); // 移除前导斜杠
  
  // 安全检查：防止路径遍历攻击
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    logError(`[${requestId}] 路径遍历攻击尝试: ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '访问被拒绝' }));
    return;
  }
  
  // 检查文件是否存在
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '资源未找到' }));
      return;
    }
    
    // 检查是否为文件
    if (!stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '资源未找到' }));
      return;
    }
    
    // 获取文件扩展名和MIME类型
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // 对于HTML文件，需要替换环境变量占位符
    if (contentType.includes('text/html')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 替换环境变量占位符，将密码转换为SHA-256哈希
        const passwordHash = process.env.PASSWORD ? createHash('sha256').update(process.env.PASSWORD).digest('hex') : '';
        const processedContent = content
          .replace(/\{\{PASSWORD\}\}?/g, passwordHash);
        
        // 只设置一次响应头
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600', // 缓存1小时
          'Access-Control-Allow-Origin': '*'
        });
        res.end(processedContent);
        
        console.log(`[${requestId}] 请求: ${req.url} - 200 OK (HTML)`);
        return;
      } catch (error) {
        logError(`[${requestId}] 读取或处理HTML文件失败`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '服务器内部错误' }));
        return;
      }
    } else {
      // 设置响应头
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
        'Access-Control-Allow-Origin': '*'
      });
      // 创建文件读取流并发送非HTML文件
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        logError(`[${requestId}] 文件读取错误`, error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '服务器内部错误' }));
        }
      });
    }
  });
});

// 健康检查端点 - 直接在服务器回调中处理
function setupHealthCheck(server) {
  // 监听request事件来处理特定的健康检查路径
  server.on('request', (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        version: process.env.VERSION || 'unknown',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
      return true; // 表示已处理
    }
    return false; // 未处理，继续到主回调
  });
}

// 设置健康检查
setupHealthCheck(server);

// 设置服务器超时和连接限制
server.timeout = 30000; // 30秒服务器超时

// 启动服务器
server.listen(PORT, () => {
  console.log(`[服务器] Cloudflare部署模拟服务器运行在 http://localhost:${PORT}`);
  console.log(`[服务器] 静态文件目录: ${PUBLIC_DIR}`);
  console.log(`[服务器] 调试模式: ${DEBUG ? '开启' : '关闭'}`);
  console.log(`[服务器] 健康检查: http://localhost:${PORT}/health`);
  console.log('[服务器] 按 Ctrl+C 停止服务器');
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('[服务器] 收到终止信号，正在关闭...');
  server.close(() => {
    console.log('[服务器] 服务器已关闭');
    process.exit(0);
  });
});

// 未捕获的异常处理
process.on('uncaughtException', (err) => {
  logError('[服务器] 未捕获的异常', err);
  // 记录错误后可以选择退出或继续运行
});

// 未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logError('[服务器] 未处理的Promise拒绝', reason);
});