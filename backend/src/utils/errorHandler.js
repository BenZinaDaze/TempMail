/**
 * 统一错误处理工具模块
 * 提供标准化的错误响应格式和异步错误处理包装器
 */

/**
 * 错误代码常量
 */
export const ErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

/**
 * 创建标准错误响应对象
 * @param {Error|string} error - 错误对象或错误消息
 * @param {number} statusCode - HTTP 状态码，默认 500
 * @param {string} code - 错误代码，默认 INTERNAL_ERROR
 * @returns {object} 标准错误响应格式：{ error: string, code?: string }
 */
export function createErrorResponse(error, statusCode = 500, code = null) {
    // 确定错误消息
    let errorMessage = 'Internal server error';
    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
    }

    // 确定错误代码
    let errorCode = code;
    if (!errorCode) {
        // 根据状态码自动推断错误代码
        if (statusCode === 400) {
            errorCode = ErrorCodes.VALIDATION_ERROR;
        } else if (statusCode === 404) {
            errorCode = ErrorCodes.NOT_FOUND;
        } else if (statusCode === 429) {
            errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED;
        } else {
            errorCode = ErrorCodes.INTERNAL_ERROR;
        }
    }

    return {
        error: errorMessage,
        code: errorCode
    };
}

/**
 * Express 异步错误处理包装器
 * 包装异步路由处理器，自动捕获错误并传递给错误处理中间件
 * @param {Function} fn - 异步路由处理器函数
 * @returns {Function} 包装后的 Express 路由处理器
 */
export function handleAsyncError(fn) {
    return (req, res, next) => {
        // 执行异步函数，捕获 Promise 错误
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
