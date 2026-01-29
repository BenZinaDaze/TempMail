import crypto from 'crypto';
import logger from './utils/logger.js';

/**
 * 内存存储管理器（轻量级）
 * 只管理邮箱会话和 WebSocket 连接，不存储消息
 * 消息通过 WebSocket 直接推送到前端
 */
class MemoryStore {
    // 邮箱过期时间（毫秒），从环境变量读取，默认 60 分钟
    static EMAIL_EXPIRY_MS = (parseInt(process.env.EMAIL_EXPIRY_MINUTES) || 60) * 60 * 1000;

    constructor(domain) {
        if (!domain) {
            throw new Error('MAIL_DOMAIN is required. Please set it in environment variables.');
        }
        this.domain = domain;

        // 邮箱会话: email -> { createdAt, expiresAt }
        this.sessions = new Map();

        // WebSocket 连接: email -> ws连接
        this.connections = new Map();

        // 统计信息
        this.stats = {
            totalEmailsCreated: 0,
            totalMessagesReceived: 0
        };

        // 清理定时器引用（用于内存泄漏修复）
        this.cleanupInterval = null;

        // 启动自动清理
        this.startCleanup();
    }

    /**
     * 生成邮箱地址
     * @param {string|null} prefix - 可选的自定义前缀
     * @returns {string} 生成的邮箱地址
     */
    createEmail(prefix = null) {
        // 验证前缀（如果提供）
        if (prefix !== null && prefix !== undefined) {
            // 类型检查
            if (typeof prefix !== 'string') {
                throw new Error('Email prefix must be a string');
            }

            // 长度检查：最大 32 字符
            if (prefix.length > 32) {
                throw new Error('Email prefix must be 32 characters or less');
            }

            // 字符验证：仅允许字母、数字、连字符、下划线
            const validPattern = /^[a-zA-Z0-9_-]+$/;
            if (!validPattern.test(prefix)) {
                throw new Error('Email prefix can only contain letters, numbers, hyphens, and underscores');
            }
        }

        const username = prefix || this.randomStr(12);
        const address = `${username}@${this.domain}`;

        // 如果邮箱已存在，会直接覆盖
        this.sessions.set(address, {
            createdAt: Date.now(),
            expiresAt: Date.now() + MemoryStore.EMAIL_EXPIRY_MS
        });

        this.stats.totalEmailsCreated++;
        logger.info({ email: address }, 'Created email: %s', address);
        return address;
    }

    /**
     * 检查会话是否有效（存在且未过期）
     * @private
     * @param {object|null} session - 会话对象
     * @returns {boolean} 会话是否有效
     */
    _isSessionValid(session) {
        return session !== null && session !== undefined && Date.now() < session.expiresAt;
    }

    /**
     * 验证并记录邮件接收（不存储）
     * @param {string} address - 邮箱地址
     * @returns {boolean} 邮箱是否有效
     */
    receiveMessage(address) {
        const session = this.sessions.get(address);
        if (this._isSessionValid(session)) {
            this.stats.totalMessagesReceived++;
            return true;
        }
        return false;
    }

    /**
     * 获取邮箱会话（仅用于验证）
     * @param {string} address - 邮箱地址
     * @returns {object|null} 会话对象或 null
     */
    getSession(address) {
        const session = this.sessions.get(address);
        if (this._isSessionValid(session)) {
            return session;
        }
        return null;
    }

    /**
     * 检查邮箱是否存在且未过期
     * @param {string} address - 邮箱地址
     * @returns {boolean} 是否存在且有效
     */
    hasEmail(address) {
        const session = this.sessions.get(address);
        return this._isSessionValid(session);
    }

    /**
     * 生成随机字符串
     * @param {number} length - 长度
     * @returns {string} 随机字符串
     */
    randomStr(length) {
        return crypto.randomBytes(Math.ceil(length / 2))
            .toString('hex')
            .slice(0, length);
    }

    /**
     * 自动清理过期邮箱
     */
    startCleanup() {
        // 保存定时器引用，避免内存泄漏
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            let cleaned = 0;

            for (const [email, session] of this.sessions) {
                if (now > session.expiresAt) {
                    this.sessions.delete(email);
                    this.connections.delete(email);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                logger.info({ cleaned }, 'Cleaned %d expired email(s)', cleaned);
            }
        }, 60000); // 每分钟检查
    }

    /**
     * 停止清理定时器
     */
    stopCleanup() {
        if (this.cleanupInterval !== null) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * 销毁存储实例，清理所有资源
     */
    destroy() {
        this.stopCleanup();
    }

    /**
     * 获取统计信息
     * @returns {object} 统计数据
     */
    getStats() {
        return {
            ...this.stats,
            activeEmails: this.sessions.size,
            activeConnections: this.connections.size
        };
    }
}

export default MemoryStore;
