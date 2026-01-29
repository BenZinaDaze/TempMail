import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import MemoryStore from './store.js';
import startSMTPServer from './smtp.js';
import startWebSocketServer from './websocket.js';
import { validateEmailPrefix } from './utils/validation.js';
import { createRateLimiter } from './middleware/rateLimiter.js';

const app = express();

// 中间件
// 注意：生产环境应设置 CORS_ORIGIN 为具体域名，避免使用 '*'
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// 配置速率限制器
// 邮箱生成接口：每分钟 10 次请求
const generateEmailRateLimiter = createRateLimiter(60000, 10);
// 其他接口：每分钟 60 次请求
const defaultRateLimiter = createRateLimiter(60000, 60);

// 从环境变量读取配置
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT) || 3000;
const MAIL_DOMAIN = process.env.MAIL_DOMAIN;

// 验证必需的环境变量
if (!MAIL_DOMAIN) {
    console.error('❌ Error: MAIL_DOMAIN environment variable is required');
    console.error('Please set MAIL_DOMAIN in your .env file, e.g., MAIL_DOMAIN=your-domain.com');
    process.exit(1);
}

// 初始化内存存储
const store = new MemoryStore(MAIL_DOMAIN);

console.log('TempMail Backend Server');
console.log(`Mail domain: ${MAIL_DOMAIN}`);
console.log('─'.repeat(50));

// ==================== REST API ====================

/**
 * 生成临时邮箱地址
 * POST /api/email/generate
 * Body: { prefix?: string }
 */
app.post('/api/email/generate', generateEmailRateLimiter, (req, res) => {
    try {
        const { prefix } = req.body;

        // 验证邮箱前缀
        const validation = validateEmailPrefix(prefix);
        if (!validation.valid) {
            return res.status(400).json({
                error: validation.error || 'Invalid email prefix',
                code: 'VALIDATION_ERROR'
            });
        }

        const email = store.createEmail(prefix);
        const session = store.sessions.get(email);

        res.json({
            email,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        console.error('❌ Failed to generate email:', error);
        res.status(500).json({ error: 'Failed to generate email' });
    }
});

/**
 * 获取邮件列表
 * GET /api/email/:address/messages
 */
app.get('/api/email/:address/messages', (req, res) => {
    try {
        const session = store.getSession(req.params.address);

        if (!session) {
            return res.status(404).json({ error: 'Email not found or expired' });
        }

        res.json({
            messages: session.messages,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        console.error('❌ Failed to get messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

/**
 * 获取单个邮件详情
 * GET /api/email/:address/messages/:messageId
 */
app.get('/api/email/:address/messages/:messageId', (req, res) => {
    try {
        const session = store.getSession(req.params.address);

        if (!session) {
            return res.status(404).json({ error: 'Email not found or expired' });
        }

        const message = session.messages.find(m => m.id === req.params.messageId);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json(message);
    } catch (error) {
        console.error('❌ Failed to get message:', error);
        res.status(500).json({ error: 'Failed to get message' });
    }
});

/**
 * 获取系统统计信息
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
    try {
        res.json(store.getStats());
    } catch (error) {
        console.error('❌ Failed to get stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/**
 * 健康检查
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        domain: MAIL_DOMAIN,
        uptime: process.uptime()
    });
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

const server = app.listen(PORT, () => {
    console.log(`HTTP Server listening on port ${PORT}`);
});

// 启动 WebSocket 服务
const { notify: wsNotify } = startWebSocketServer(server, store);

// 启动 SMTP 服务
startSMTPServer(store, wsNotify);

// 优雅关闭处理
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

    // 1. 停止接受新连接
    server.close(() => {
        console.log('✅ HTTP server closed');
    });

    // 2. 关闭所有 WebSocket 连接
    const connections = store.connections;
    console.log(`📡 Closing ${connections.size} WebSocket connection(s)...`);

    connections.forEach((ws, email) => {
        ws.close(1000, 'Server shutting down');
    });

    // 3. 设置超时强制退出（避免卡住）
    setTimeout(() => {
        console.error('⚠️  Forced shutdown due to timeout');
        process.exit(1);
    }, 5000); // 5秒超时

    // 4. 正常退出
    setTimeout(() => {
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    }, 1000); // 1秒后退出
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
