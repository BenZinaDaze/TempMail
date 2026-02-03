import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import logger from './utils/logger.js';
import config from './config.js';

/**
 * 启动 SMTP 邮件接收服务（优化版）
 * @param {MemoryStore} store - 内存存储实例
 * @param {Function} wsNotify - WebSocket 通知函数
 */
function startSMTPServer(store, wsNotify) {
    const port = config.smtpPort;
    const domain = config.mailDomain;

    const server = new SMTPServer({
        authOptional: true,
        disabledCommands: ['AUTH'],
        banner: `Welcome to ${domain} Temporary Mail Server`,

        // 禁用 TLS：纯明文 SMTP，不提供 STARTTLS
        // 解决外部服务器尝试使用不兼容 TLS 版本时的握手失败问题
        hideSTARTTLS: true,

        // 增强的 SMTP 能力声明
        onConnect(session, callback) {
            logger.info({ remoteAddress: session.remoteAddress }, '[SMTP] Connection from %s', session.remoteAddress);
            callback();
        },

        onMailFrom(address, session, callback) {
            logger.info({ address: address.address }, '[SMTP] MAIL FROM: %s', address.address);
            callback();
        },

        onRcptTo(address, session, callback) {
            logger.info({ address: address.address }, '[SMTP] RCPT TO: %s', address.address);

            // 验证收件人域名
            if (!address.address.endsWith(`@${domain}`)) {
                logger.warn({ address: address.address }, '[SMTP] Rejected: invalid domain for %s', address.address);
                return callback(new Error(`550 5.1.1 We do not serve this domain`));
            }

            // 验证邮箱是否存在且未过期
            if (!store.hasEmail(address.address)) {
                logger.warn({ address: address.address }, '[SMTP] Rejected: email not found or expired - %s', address.address);
                return callback(new Error(`550 5.1.1 Mailbox does not exist or has expired`));
            }

            callback();
        },

        onData(stream, session, callback) {
            simpleParser(stream, (err, mail) => {
                if (err) {
                    logger.error({ error: err }, '[SMTP] Failed to parse email');
                    return callback(err);
                }

                // 从 session.envelope 获取收件人
                const recipients = session.envelope.rcptTo || [];

                logger.info({
                    from: mail.from?.text || 'unknown',
                    subject: mail.subject || '(no subject)',
                    recipientCount: recipients.length
                }, '[SMTP] Processing email: From: %s, Subject: %s, Recipients: %d',
                    mail.from?.text || 'unknown',
                    mail.subject || '(no subject)',
                    recipients.length);

                // 处理所有收件人
                recipients.forEach(recipient => {
                    const to = recipient.address;

                    // 构建邮件消息对象
                    const message = {
                        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                        from: mail.from?.text || 'unknown',
                        subject: mail.subject || '(无主题)',
                        text: mail.text || '',
                        html: mail.html || '',
                        attachments: (mail.attachments || [])
                            .filter(att => !att.contentDisposition || att.contentDisposition !== 'inline')
                            .map(att => ({
                                filename: att.filename || 'unnamed',
                                contentType: att.contentType || 'application/octet-stream',
                                size: att.size || 0,
                                content: att.content ? att.content.toString('base64') : null
                            })),
                        receivedAt: new Date().toISOString()
                    };

                    // 纯推送模式：验证邮箱有效后直接推送，不存储
                    if (store.receiveMessage(to)) {
                        logger.info({ email: to, subject: message.subject }, '[SMTP] → Pushing message to %s: "%s"', to, message.subject);
                        wsNotify(to, message);
                    } else {
                        logger.error({ email: to }, '[SMTP] ✗ Invalid email session: %s', to);
                    }
                });

                callback();
            });
        },

        onClose(session) {
            logger.info({ remoteAddress: session.remoteAddress }, '[SMTP] Connection closed from %s', session.remoteAddress);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        logger.info({ port, domain }, 'SMTP Server listening on 0.0.0.0:%d', port);
        logger.info({ domain }, '   Ready to receive emails for @%s', domain);
        logger.info('   Accepting connections from any IP address');
    });

    server.on('error', (err) => {
        // ETIMEDOUT：客户端连接后未在规定时间内发送数据（如端口扫描、对方 MTA 异常），属常见情况，降级为 warn
        if (err.code === 'ETIMEDOUT' && err.syscall === 'read') {
            logger.warn({ error: err }, '[SMTP] Connection timeout (client sent no data)');
            return;
        }
        logger.error({ error: err }, '[SMTP] Server error');
    });

    return server;
}

export default startSMTPServer;
