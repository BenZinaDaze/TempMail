import { useMemo, memo } from "react";

// 提取 formatTime 函数到组件外部，避免每次渲染重新创建
const formatTime = (isoString) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function EmailList({ messages, onMessageClick }) {
  if (messages.length === 0) {
    return (
      <div className="email-list">
        <h3>收件箱</h3>
        <div className="empty-state">
          <div className="icon">✉</div>
          <p>还没有收到邮件</p>
          <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            向上方地址发送邮件即可实时接收
          </p>
        </div>
      </div>
    );
  }

  // 使用 useMemo 缓存排序后的消息列表，避免每次渲染都重新排序
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)
    );
  }, [messages]);

  return (
    <div className="email-list">
      <h3>收件箱 ({messages.length})</h3>
      {sortedMessages.map((message) => (
        <div
          key={message.id}
          className="message-item"
          onClick={() => onMessageClick(message)}
        >
          <div className="message-header">
            <span className="from">{message.from}</span>
            <span className="time">{formatTime(message.receivedAt)}</span>
          </div>
          <div className="subject">{message.subject}</div>
          <div className="preview">{message.text || "(无内容)"}</div>
        </div>
      ))}
    </div>
  );
}

// 使用 React.memo 包装组件，如果 props 未变化则不重新渲染
export default memo(EmailList);
