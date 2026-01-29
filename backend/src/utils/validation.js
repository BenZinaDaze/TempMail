/**
 * 输入验证工具模块
 * 提供邮箱前缀验证和清理功能
 */

/**
 * 验证邮箱前缀格式
 * @param {string|null} prefix - 邮箱前缀
 * @returns {{ valid: boolean, error?: string }} 验证结果
 */
export function validateEmailPrefix(prefix) {
    // 如果 prefix 为 null 或 undefined，视为有效（将使用随机生成）
    if (prefix === null || prefix === undefined) {
        return { valid: true };
    }

    // 必须是字符串类型
    if (typeof prefix !== 'string') {
        return { valid: false, error: 'Email prefix must be a string' };
    }

    // 长度检查：1-32 字符
    if (prefix.length === 0) {
        return { valid: false, error: 'Email prefix cannot be empty' };
    }

    if (prefix.length > 32) {
        return { valid: false, error: 'Email prefix must be 32 characters or less' };
    }

    // 字符验证：仅允许字母、数字、连字符、下划线
    // 正则表达式：^[a-zA-Z0-9_-]+$
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(prefix)) {
        return { 
            valid: false, 
            error: 'Email prefix can only contain letters, numbers, hyphens, and underscores' 
        };
    }

    return { valid: true };
}

/**
 * 清理和规范化邮箱前缀
 * @param {string} prefix - 原始前缀
 * @returns {string} 清理后的前缀
 */
export function sanitizeEmailPrefix(prefix) {
    if (typeof prefix !== 'string') {
        return '';
    }

    // 移除首尾空格
    let sanitized = prefix.trim();

    // 移除不允许的字符，只保留字母、数字、连字符、下划线
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');

    // 限制长度
    if (sanitized.length > 32) {
        sanitized = sanitized.substring(0, 32);
    }

    return sanitized;
}
