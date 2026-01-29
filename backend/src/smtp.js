import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';

/**
 * 启动 SMTP 邮件接收服务（优化版）
 * @param {MemoryStore} store - 内存存储实例
 * @param {Function} wsNotify - WebSocket 通知函数
 */
function startSMTPServer(store, wsNotify) {
    const port = parseInt(process.env.SMTP_PORT) || 2525;
    const domain = process.env.MAIL_DOMAIN;

    const server = new SMTPServer({
        authOptional: true,
        disabledCommands: ['AUTH'],
        banner: `Welcome to ${domain} Temporary Mail Server`,

        // 增强的 SMTP 能力声明
        onConnect(session, callback) {
            console.log(`[SMTP] Connection from ${session.remoteAddress}`);
            callback();
        },

        onMailFrom(address, session, callback) {
            console.log(`[SMTP] MAIL FROM: ${address.address}`);
            callback();
        },

        onRcptTo(address, session, callback) {
            console.log(`[SMTP] RCPT TO: ${address.address}`);

            // 验证收件人域名
            if (!address.address.endsWith(`@${domain}`)) {
                console.warn(`[SMTP] Rejected: invalid domain for ${address.address}`);
                return callback(new Error(`550 5.1.1 We do not serve this domain`));
            }

            // 验证邮箱是否存在且未过期
            if (!store.hasEmail(address.address)) {
                console.warn(`[SMTP] Rejected: email not found or expired - ${address.address}`);
                return callback(new Error(`550 5.1.1 Mailbox does not exist or has expired`));
            }

            callback();
        },

        onData(stream, session, callback) {
            simpleParser(stream, (err, mail) => {
                if (err) {
                    console.error('[SMTP] Failed to parse email:', err);
                    return callback(err);
                }

                // 从 session.envelope 获取收件人
                const recipients = session.envelope.rcptTo || [];

                console.log(`[SMTP] Processing email:
  From: ${mail.from?.text || 'unknown'}
  Subject: ${mail.subject || '(no subject)'}
  Recipients: ${recipients.length}`);

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
                        console.log(`[SMTP] → Pushing message to ${to}: "${message.subject}"`);
                        wsNotify(to, message);
                    } else {
                        console.error(`[SMTP] ✗ Invalid email session: ${to}`);
                    }
                });

                callback();
            });
        },

        onClose(session) {
            console.log(`[SMTP] Connection closed from ${session.remoteAddress}`);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`SMTP Server listening on 0.0.0.0:${port}`);
        console.log(`   Ready to receive emails for @${domain}`);
        console.log(`   Accepting connections from any IP address`);
    });

    server.on('error', (err) => {
        console.error('[SMTP] Server error:', err);
    });

    return server;
}

export default startSMTPServer;
