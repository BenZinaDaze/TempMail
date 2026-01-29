import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import MemoryStore from './store.js';
import startSMTPServer from './smtp.js';
import startWebSocketServer from './websocket.js';
import { validateEmailPrefix } from './utils/validation.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { handleAsyncError, createErrorResponse, ErrorCodes } from './utils/errorHandler.js';
import logger from './utils/logger.js';
import config from './config.js';

const app = express();

// 中间件
// 注意：生产环境应设置 CORS_ORIGIN 为具体域名，避免使用 '*'
const corsOptions = {
    origin: config.corsOrigin,
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// 配置速率限制器
// 邮箱生成接口：每分钟 10 次请求
const generateEmailRateLimiter = createRateLimiter(
    config.rateLimit.generateEmail.windowMs,
    config.rateLimit.generateEmail.max
);
// 其他接口：每分钟 60 次请求
const defaultRateLimiter = createRateLimiter(
    config.rateLimit.default.windowMs,
    config.rateLimit.default.max
);

// 路径处理
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化内存存储
const store = new MemoryStore(config.mailDomain);

logger.info({ domain: config.mailDomain }, 'TempMail Backend Server');
logger.info({ domain: config.mailDomain }, 'Mail domain: %s', config.mailDomain);
logger.info('─'.repeat(50));

// ==================== REST API ====================

/**
 * 生成临时邮箱地址
 * POST /api/email/generate
 * Body: { prefix?: string }
 */
app.post('/api/email/generate', generateEmailRateLimiter, handleAsyncError(async (req, res) => {
    const { prefix } = req.body;

    // 验证邮箱前缀
    const validation = validateEmailPrefix(prefix);
    if (!validation.valid) {
        return res.status(400).json(
            createErrorResponse(validation.error || 'Invalid email prefix', 400, ErrorCodes.VALIDATION_ERROR)
        );
    }

    const email = store.createEmail(prefix);
    const session = store.sessions.get(email);

    res.json({
        email,
        expiresAt: session.expiresAt
    });
}));

/**
 * 获取邮件列表
 * GET /api/email/:address/messages
 */
app.get('/api/email/:address/messages', handleAsyncError(async (req, res) => {
    const session = store.getSession(req.params.address);

    if (!session) {
        return res.status(404).json(
            createErrorResponse('Email not found or expired', 404, ErrorCodes.NOT_FOUND)
        );
    }

    res.json({
        messages: session.messages,
        expiresAt: session.expiresAt
    });
}));

/**
 * 获取单个邮件详情
 * GET /api/email/:address/messages/:messageId
 */
app.get('/api/email/:address/messages/:messageId', handleAsyncError(async (req, res) => {
    const session = store.getSession(req.params.address);

    if (!session) {
        return res.status(404).json(
            createErrorResponse('Email not found or expired', 404, ErrorCodes.NOT_FOUND)
        );
    }

    const message = session.messages.find(m => m.id === req.params.messageId);

    if (!message) {
        return res.status(404).json(
            createErrorResponse('Message not found', 404, ErrorCodes.NOT_FOUND)
        );
    }

    res.json(message);
}));

/**
 * 获取系统统计信息
 * GET /api/stats
 */
app.get('/api/stats', handleAsyncError(async (req, res) => {
    res.json(store.getStats());
}));

/**
 * 健康检查
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        domain: config.mailDomain,
        uptime: process.uptime()
    });
});

// ==================== 全局错误处理中间件 ====================

// 必须在所有路由之后、静态文件服务之前
app.use((err, req, res, next) => {
    // 如果响应已发送，直接传递给 Express 默认错误处理
    if (res.headersSent) {
        return next(err);
    }

    // 根据错误类型确定状态码
    let statusCode = 500;
    let errorCode = ErrorCodes.INTERNAL_ERROR;

    // 如果错误对象有 statusCode 属性，使用它
    if (err.statusCode) {
        statusCode = err.statusCode;
    } else if (err.status) {
        statusCode = err.status;
    }

    // 记录错误日志
    logger.error({ err, statusCode }, '❌ Unhandled error');

    // 返回标准错误响应
    res.status(statusCode).json(createErrorResponse(err, statusCode, errorCode));
});

// ==================== 静态文件服务 (前端集成) ====================

// 在生产环境中，后端同时也提供前端静态文件服务
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// 所有未匹配的 API 请求都返回 index.html (支持前端路由)
app.get('*', (req, res, next) => {
    // 忽略 API 请求
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
        if (err) {
            // 如果找不到 index.html (例如在纯后端开发模式下)，则返回 404
            if (!res.headersSent) {
                res.status(404).send('Not Found');
            }
        }
    });
});

// ==================== 启动服务器 ====================

const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'HTTP Server listening on port %d', config.port);
});

// 启动 WebSocket 服务
const { notify: wsNotify } = startWebSocketServer(server, store);

// 启动 SMTP 服务
startSMTPServer(store, wsNotify);

// 优雅关闭处理
function gracefulShutdown(signal) {
    logger.info({ signal }, '🛑 Received %s, shutting down gracefully...', signal);

    // 1. 停止接受新连接
    server.close(() => {
        logger.info('✅ HTTP server closed');
    });

    // 2. 关闭所有 WebSocket 连接
    const connections = store.connections;
    logger.info({ connectionCount: connections.size }, '📡 Closing %d WebSocket connection(s)...', connections.size);

    connections.forEach((ws, email) => {
        ws.close(1000, 'Server shutting down');
    });

    // 3. 清理内存存储资源（停止清理定时器）
    store.destroy();

    // 4. 设置超时强制退出（避免卡住）
    setTimeout(() => {
        logger.error('⚠️  Forced shutdown due to timeout');
        process.exit(1);
    }, 5000); // 5秒超时

    // 5. 正常退出
    setTimeout(() => {
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
    }, 1000); // 1秒后退出
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
