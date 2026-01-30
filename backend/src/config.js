/**
 * 配置管理模块
 * 集中管理所有环境变量配置，提供验证和默认值
 * 
 * 注意：此模块在 logger 之前加载，使用 console 输出错误信息
 */

/**
 * 解析环境变量为数字
 * @param {string} envVar - 环境变量名
 * @param {number} defaultValue - 默认值
 * @param {number} min - 最小值（可选）
 * @param {number} max - 最大值（可选）
 * @returns {number} 解析后的数字
 */
function parseNumber(envVar, defaultValue, min = null, max = null) {
    const value = process.env[envVar];
    if (!value) {
        return defaultValue;
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        // 使用 console.warn，因为 logger 可能还未初始化
        console.warn(`Invalid number for ${envVar}: ${value}, using default: ${defaultValue}`);
        return defaultValue;
    }
    
    if (min !== null && parsed < min) {
        console.warn(`Value for ${envVar} (${parsed}) is less than minimum (${min}), using minimum`);
        return min;
    }
    
    if (max !== null && parsed > max) {
        console.warn(`Value for ${envVar} (${parsed}) is greater than maximum (${max}), using maximum`);
        return max;
    }
    
    return parsed;
}

/**
 * 解析环境变量为字符串
 * @param {string} envVar - 环境变量名
 * @param {string} defaultValue - 默认值
 * @returns {string} 环境变量值或默认值
 */
function parseString(envVar, defaultValue) {
    return process.env[envVar] || defaultValue;
}

// 验证必需的环境变量
const mailDomain = process.env.MAIL_DOMAIN;
if (!mailDomain) {
    // 使用 console.error，因为 logger 可能还未初始化
    console.error('❌ Error: MAIL_DOMAIN environment variable is required');
    console.error('Please set MAIL_DOMAIN in your .env file, e.g., MAIL_DOMAIN=your-domain.com');
    process.exit(1);
}

// 配置对象
const config = {
    // Web 服务端口
    port: parseNumber('PORT', 3000, 1, 65535),
    
    // 邮箱域名（必需）
    mailDomain: mailDomain,
    
    // SMTP 服务端口
    smtpPort: parseNumber('SMTP_PORT', 2525, 1, 65535),
    
    // CORS 配置
    corsOrigin: parseString('CORS_ORIGIN', '*'),
    
    // 邮箱过期时间（分钟）
    emailExpiryMinutes: parseNumber('EMAIL_EXPIRY_MINUTES', 60, 1),
    
    // WebSocket 心跳间隔（毫秒）
    heartbeatInterval: parseNumber('HEARTBEAT_INTERVAL', 30000, 1000),
    
    // 清理间隔（毫秒）
    cleanupInterval: parseNumber('CLEANUP_INTERVAL', 60000, 1000),
    
    // 速率限制配置
    rateLimit: {
        generateEmail: {
            windowMs: 60000, // 1 分钟
            max: 10 // 每分钟 10 次
        },
        default: {
            windowMs: 60000, // 1 分钟
            max: 60 // 每分钟 60 次
        }
    },

    // 邮箱前缀黑名单（不允许游客使用的前缀，如管理员标识）
    // 从环境变量 EMAIL_PREFIX_BLACKLIST 读取，逗号分隔，默认包含常见保留前缀
    emailPrefixBlacklist: (() => {
        const defaultList = [
            'admin', 'administrator', 'root', 'postmaster', 'webmaster', 'hostmaster',
            'noreply', 'no-reply', 'support', 'info', 'abuse', 'security'
        ];
        const env = process.env.EMAIL_PREFIX_BLACKLIST;
        if (!env) return defaultList;
        const fromEnv = env.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return fromEnv.length > 0 ? fromEnv : defaultList;
    })()
};

export default config;
