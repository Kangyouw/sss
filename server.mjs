import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 获取当前文件路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 应用配置
const config = {
  port: process.env.PORT || 8080,
  password: process.env.PASSWORD || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2', 10),
  cacheMaxAge: process.env.CACHE_MAX_AGE || '1d',
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  debug: process.env.DEBUG === 'true'
};

// 调试日志函数
const log = (...args) => {
  if (config.debug) {
    console.log('[DEBUG]', ...args);
  }
};

// 错误日志函数
const errorLog = (...args) => {
  console.error('[ERROR]', ...args);
};

const app = express();

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 生成SHA256哈希
const sha256Hash = (input) => {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(input);
      resolve(hash.digest('hex'));
    } catch (error) {
      errorLog('生成哈希失败:', error);
      resolve('');
    }
  });
};

// 渲染页面并注入密码哈希
const renderPage = async (filePath, password) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (password !== '') {
      const sha256 = await sha256Hash(password);
      return content.replace('{{PASSWORD}}', sha256);
    }
    return content.replace('{{PASSWORD}}', '');
  } catch (error) {
    errorLog(`读取文件失败 ${filePath}:`, error);
    throw error;
  }
};

// 处理主要页面请求
app.get(['/', '/index.html', '/player.html'], async (req, res) => {
  try {
    const filePath = req.path === '/player.html' 
      ? join(__dirname, 'player.html') 
      : join(__dirname, 'index.html');
    
    const content = await renderPage(filePath, config.password);
    res.send(content);
  } catch (error) {
    errorLog('页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

app.get('/s=:keyword', async (req, res) => {
  try {
    const filePath = join(__dirname, 'index.html');
    const content = await renderPage(filePath, config.password);
    res.send(content);
  } catch (error) {
    console.error('搜索页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

// 验证URL安全性
const isValidUrl = (urlString) => {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ['http:', 'https:'];
    
    // 从环境变量获取阻止的主机名列表
    const blockedHostnames = (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(',');
    
    // 从环境变量获取阻止的 IP 前缀
    const blockedPrefixes = (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(',');
    
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (blockedHostnames.includes(parsed.hostname)) return false;
    
    for (const prefix of blockedPrefixes) {
      if (parsed.hostname.startsWith(prefix)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

// 验证代理请求的鉴权
const validateProxyAuth = (req) => {
  const authHash = req.query.auth;
  const timestamp = req.query.t;
  
  // 获取服务器端密码
  const serverPassword = config.password;
  if (!serverPassword) {
    errorLog('服务器未设置 PASSWORD 环境变量，代理访问被拒绝');
    return false;
  }
  
  try {
    // 计算密码哈希
    const serverPasswordHash = crypto.createHash('sha256')
      .update(serverPassword)
      .digest('hex');
    
    if (!authHash || authHash !== serverPasswordHash) {
      log('代理请求鉴权失败：密码哈希不匹配');
      return false;
    }
    
    // 验证时间戳（10分钟有效期）
    if (timestamp) {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10分钟
      if (now - parseInt(timestamp, 10) > maxAge) {
        log('代理请求鉴权失败：时间戳过期');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    errorLog('验证代理请求时出错:', error);
    return false;
  }
};

// 代理请求处理
app.get('/proxy/:encodedUrl', async (req, res) => {
  try {
    // 验证鉴权
    if (!validateProxyAuth(req)) {
      return res.status(401).json({
        success: false,
        error: '代理访问未授权：请检查密码配置或鉴权参数'
      });
    }

    const encodedUrl = req.params.encodedUrl;
    const targetUrl = decodeURIComponent(encodedUrl);

    // 安全验证
    if (!isValidUrl(targetUrl)) {
      return res.status(400).send('无效的 URL');
    }

    log(`代理请求: ${targetUrl}`);

    // 创建带超时和重试的HTTP客户端
    const axiosClient = axios.create({
      timeout: config.timeout,
      headers: {
        'User-Agent': config.userAgent
      }
    });

    // 带重试的请求函数
    const makeRequestWithRetry = async (retriesLeft = config.maxRetries) => {
      try {
        return await axiosClient({
          method: 'get',
          url: targetUrl,
          responseType: 'stream'
        });
      } catch (error) {
        if (retriesLeft > 0) {
          const retryCount = config.maxRetries - retriesLeft + 1;
          log(`重试请求 (${retryCount}/${config.maxRetries}): ${targetUrl}`);
          // 添加指数退避
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return makeRequestWithRetry(retriesLeft - 1);
        }
        throw error;
      }
    };

    const response = await makeRequestWithRetry();

    // 转发响应头（过滤敏感头）
    const headers = { ...response.headers };
    const sensitiveHeaders = (
      process.env.FILTERED_HEADERS || 
      'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin'
    ).split(',');
    
    sensitiveHeaders.forEach(header => delete headers[header.toLowerCase()]);
    res.set(headers);

    // 管道传输响应流并处理错误
    response.data.pipe(res);
    
    // 处理流错误
    response.data.on('error', (err) => {
      errorLog('代理流错误:', err);
      res.end();
    });
    
    // 处理客户端断开连接
    res.on('close', () => {
      response.data.destroy();
    });
  } catch (error) {
    errorLog('代理请求错误:', error.message);
    
    if (!res.headersSent) {
      if (error.response) {
        res.status(error.response.status || 500);
        if (error.response.data) {
          error.response.data.pipe(res);
        } else {
          res.send(`请求失败: ${error.message}`);
        }
      } else {
        res.status(500).send(`请求失败: ${error.message}`);
      }
    }
  }
});

// 静态文件服务
app.use(express.static(__dirname, {
  maxAge: config.cacheMaxAge,
  etag: true,
  lastModified: true
}));

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).send('服务器内部错误');
});

app.use((req, res) => {
  res.status(404).send('页面未找到');
});

// 启动服务器
const server = app.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
  if (config.password !== '') {
    console.log('用户登录密码已设置');
  } else {
    console.log('警告: 未设置 PASSWORD 环境变量，用户将被要求设置密码');
  }
  if (config.debug) {
    console.log('调试模式已启用');
    console.log('配置:', { ...config, password: config.password ? '******' : '' });
  }
});

// 优雅关闭处理
const handleShutdown = () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
};

// 监听终止信号
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// 防止未捕获异常导致进程崩溃
process.on('uncaughtException', (error) => {
  errorLog('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  errorLog('未处理的Promise拒绝:', reason);
});
