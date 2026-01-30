/**
 * 前端输入验证（与后端 backend/src/utils/validation.js 规则一致）
 */

const PREFIX_MAX_LENGTH = 32;
const PREFIX_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** 邮箱前缀黑名单（与后端默认一致，保留/管理员标识不可使用） */
const PREFIX_BLACKLIST = [
  "admin",
  "administrator",
  "root",
  "postmaster",
  "webmaster",
  "hostmaster",
  "noreply",
  "no-reply",
  "support",
  "info",
  "abuse",
  "security",
];

/**
 * 验证邮箱前缀格式
 * @param {string} prefix - 用户输入的前缀（可为空）
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmailPrefix(prefix) {
  const trimmed = typeof prefix === "string" ? prefix.trim() : "";

  // 留空视为有效，将使用随机生成
  if (trimmed.length === 0) {
    return { valid: true };
  }

  if (trimmed.length > PREFIX_MAX_LENGTH) {
    return {
      valid: false,
      error: "前缀最多 32 个字符",
    };
  }

  if (PREFIX_BLACKLIST.includes(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: "该前缀为保留前缀，不可使用",
    };
  }

  if (!PREFIX_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: "前缀只能包含字母、数字、连字符和下划线",
    };
  }

  return { valid: true };
}
