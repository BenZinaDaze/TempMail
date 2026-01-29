import { WebSocketServer } from 'ws';
import logger from './utils/logger.js';
import config from './config.js';

/**
 * 启动 WebSocket 服务
 * @param {http.Server} server - HTTP 服务器实例
 * @param {MemoryStore} store - 内存存储实例
 * @returns {object} 包含 notify 方法的对象
 */
function startWebSocketServer(server, store) {
    // 心跳检测间隔，从配置读取
    const HEARTBEAT_INTERVAL = config.heartbeatInterval;
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, 'ws://base');
        const email = url.searchParams.get('email');

        if (!email || !store.sessions.has(email)) {
            logger.warn({ email }, 'WebSocket connection rejected: invalid email %s', email);
            ws.close(4000, 'Invalid email');
            return;
        }

        logger.info({ email }, 'WebSocket connected: %s', email);

        // 初始化心跳状态
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // 绑定连接（单连接模式）
        store.connections.set(email, ws);

        // 发送欢迎消息
        ws.send(JSON.stringify({
            type: 'connected',
            email: email,
            expiresAt: store.sessions.get(email)?.expiresAt
        }));

        ws.on('close', () => {
            logger.info({ email }, 'WebSocket disconnected: %s', email);
            store.connections.delete(email);
        });

        ws.on('error', (error) => {
            logger.error({ email, error }, 'WebSocket error for %s', email);
        });
    });

    // 全局心跳定时器
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                logger.info('Terminating inactive WebSocket client');
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, config.heartbeatInterval);

    wss.on('close', () => {
        clearInterval(interval);
    });

    wss.on('error', (error) => {
        logger.error({ error }, 'WebSocket Server error');
    });

    logger.info('WebSocket Server initialized');

    // 返回推送通知函数
    return {
        notify: (email, message) => {
            const ws = store.connections.get(email);
            if (ws && ws.readyState === 1) { // 1 = OPEN
                try {
                    ws.send(JSON.stringify({
                        type: 'new_message',
                        message
                    }));
                    logger.info({ email, subject: message.subject }, 'Pushed message to %s', email);
                } catch (error) {
                    logger.error({ email, error }, 'Failed to push message to %s', email);
                }
            }
        }
    };
}

export default startWebSocketServer;
