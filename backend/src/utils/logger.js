import pino from 'pino';

/**
 * 创建日志实例
 * 根据 NODE_ENV 配置日志格式和级别
 * @returns {pino.Logger} Pino 日志实例
 */
function createLogger() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = process.env.LOG_LEVEL || 'info';

    // 开发环境：使用 pino-pretty 格式化输出（更易读）
    // 生产环境：使用 JSON 格式输出（便于日志聚合和分析）
    const options = {
        level: logLevel,
        ...(isDevelopment && {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname'
                }
            }
        })
    };

    return pino(options);
}

// 导出默认日志实例
const logger = createLogger();
export default logger;
