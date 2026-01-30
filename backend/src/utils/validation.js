/**
 * 输入验证工具模块
 * 提供邮箱前缀验证和清理功能
 */

import config from '../config.js';

/**
 * 验证邮箱前缀格式（含黑名单）
 * @param {string|null} prefix - 邮箱前缀
 * @param {string[]} [blacklist] - 可选，前缀黑名单（小写）；不传则使用 config.emailPrefixBlacklist
 * @returns {{ valid: boolean, error?: string }} 验证结果
 */
export function validateEmailPrefix(prefix, blacklist = config.emailPrefixBlacklist) {
    // 如果 prefix 为 null 或 undefined，视为有效（将使用随机生成）
    if (prefix === null || prefix === undefined) {
        return { valid: true };
    }

    // 必须是字符串类型
    if (typeof prefix !== 'string') {
        return { valid: false, error: 'Email prefix must be a string' };
    }

    const trimmed = prefix.trim();

    // 长度检查：1-32 字符
    if (trimmed.length === 0) {
        return { valid: false, error: 'Email prefix cannot be empty' };
    }

    if (trimmed.length > 32) {
        return { valid: false, error: 'Email prefix must be 32 characters or less' };
    }

    // 黑名单：不允许使用保留/管理员标识前缀
    const lower = trimmed.toLowerCase();
    if (blacklist && blacklist.includes(lower)) {
        return { valid: false, error: '该前缀为保留前缀，不可使用' };
    }

    // 字符验证：仅允许字母、数字、连字符、下划线
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(trimmed)) {
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
