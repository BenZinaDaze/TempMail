/**
 * 速率限制中间件
 * 基于 IP 地址的请求频率限制
 */

import config from '../config.js';

/**
 * 创建速率限制中间件
 * @param {number} windowMs - 时间窗口（毫秒），默认使用配置值
 * @param {number} maxRequests - 最大请求数，默认使用配置值
 * @returns {Function} Express 中间件函数
 */
export function createRateLimiter(
    windowMs = config.rateLimit.default.windowMs,
    maxRequests = config.rateLimit.default.max
) {
    // 存储每个 IP 的请求记录: Map<ip, { count: number, resetAt: number }>
    const requestMap = new Map();

    // 定期清理过期的记录（每 5 分钟清理一次）
    setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of requestMap.entries()) {
            if (now > record.resetAt) {
                requestMap.delete(ip);
            }
        }
    }, 5 * 60 * 1000); // 5 分钟

    return (req, res, next) => {
        // 获取客户端 IP 地址
        const ip = req.ip || 
                   req.connection?.remoteAddress || 
                   req.socket?.remoteAddress ||
                   (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
                   'unknown';

        const now = Date.now();
        const record = requestMap.get(ip);

        if (!record) {
            // 首次请求，创建新记录
            requestMap.set(ip, {
                count: 1,
                resetAt: now + windowMs
            });
            return next();
        }

        // 检查时间窗口是否已过期
        if (now > record.resetAt) {
            // 重置计数
            record.count = 1;
            record.resetAt = now + windowMs;
            return next();
        }

        // 检查是否超过限制
        if (record.count >= maxRequests) {
            return res.status(429).json({
                error: 'Too many requests, please try again later',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((record.resetAt - now) / 1000) // 秒
            });
        }

        // 增加计数
        record.count++;
        next();
    };
}
