import { WebSocketServer } from 'ws';

/**
 * 启动 WebSocket 服务
 * @param {http.Server} server - HTTP 服务器实例
 * @param {MemoryStore} store - 内存存储实例
 * @returns {object} 包含 notify 方法的对象
 */
function startWebSocketServer(server, store) {
    // 心跳检测间隔 (30秒)
    const HEARTBEAT_INTERVAL = 30000;
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, 'ws://base');
        const email = url.searchParams.get('email');

        if (!email || !store.sessions.has(email)) {
            console.warn(`WebSocket connection rejected: invalid email ${email}`);
            ws.close(4000, 'Invalid email');
            return;
        }

        console.log(`WebSocket connected: ${email}`);

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
            console.log(`WebSocket disconnected: ${email}`);
            store.connections.delete(email);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for ${email}:`, error);
        });
    });

    // 全局心跳定时器
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                console.log('Terminating inactive WebSocket client');
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, HEARTBEAT_INTERVAL);

    wss.on('close', () => {
        clearInterval(interval);
    });

    wss.on('error', (error) => {
        console.error('WebSocket Server error:', error);
    });

    console.log('WebSocket Server initialized');

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
                    console.log(`Pushed message to ${email}`);
                } catch (error) {
                    console.error(`Failed to push message to ${email}:`, error);
                }
            }
        }
    };
}

export default startWebSocketServer;
