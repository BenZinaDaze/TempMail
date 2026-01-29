import { useEffect, useState } from 'react';

// 自动推断 WebSocket 地址
const getWebSocketUrl = () => {
    // 1. 如果配置了 VITE_WS_URL，优先使用
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL;
    }
    // 2. 否则根据当前页面协议自动推断 (支持 Docker 部署)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
};

const WS_URL = getWebSocketUrl();

export default function useWebSocket(email) {
    const [messages, setMessages] = useState([]);
    //状态: 'connecting' | 'connected' | 'disconnected'
    const [status, setStatus] = useState('connecting');

    useEffect(() => {
        if (!email) return;

        // 每次 email 变化（重新生成）时，先重置为连接中
        setStatus('connecting');
        setMessages([]); // 清空旧消息

        const ws = new WebSocket(`${WS_URL}?email=${encodeURIComponent(email)}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'init') {
                    // 初始化消息
                    setMessages(data.messages || []);
                } else if (data.type === 'new_message') {
                    // 新邮件推送
                    setMessages((prev) => [...prev, data.message]);

                    // 显示通知
                    if (Notification.permission === 'granted') {
                        new Notification('新邮件', {
                            body: `来自: ${data.message.from}\n主题: ${data.message.subject}`,
                            icon: '/email-icon.png',
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            // 注意：onerror 之后通常紧接着 onclose，所以主要状态更新在 onclose 处理
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setStatus('disconnected');
        };

        // 请求通知权限
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            ws.close();
        };
    }, [email]);

    return { messages, status };
}
