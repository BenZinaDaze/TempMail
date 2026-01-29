import { useState } from "react";
import EmailGenerator from "./components/EmailGenerator";
import EmailList from "./components/EmailList";
import EmailViewer from "./components/EmailViewer";
import Timer from "./components/Timer";
import Toast from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import useWebSocket from "./hooks/useWebSocket";
import "./index.css";

// 自动判断 API 地址：
// 1. 如果配置了 VITE_API_URL，使用配置值 (开发环境)
// 2. 否则默认为空字符串，即使用相对路径 (生产环境/Docker)
const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [currentEmail, setCurrentEmail] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [toast, setToast] = useState(null);
  const { messages, status } = useWebSocket(currentEmail);

  const handleEmailGenerate = ({ email, expiresAt }) => {
    setCurrentEmail(email);
    setExpiresAt(expiresAt);
  };

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

  const handleCloseViewer = () => {
    setSelectedMessage(null);
  };

  const handleCopyEmail = async () => {
    try {
      // 优先尝试使用现代 Clipboard API (仅限 localhost 或 HTTPS)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentEmail);
        setToast({ message: "邮箱地址已复制", type: "success" });
      } else {
        // Fallback: 使用传统的 document.execCommand (支持 HTTP 非安全上下文)
        const textarea = document.createElement("textarea");
        textarea.value = currentEmail;
        textarea.style.position = "fixed"; // 避免滚动到底部
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (successful) {
          setToast({ message: "邮箱地址已复制", type: "success" });
        } else {
          throw new Error("Copy failed");
        }
      }
    } catch (err) {
      console.error("Copy failed:", err);
      setToast({ message: "复制失败，请手动复制", type: "error" });
    }
  };

  // 核心逻辑：只有已连接或曾经连接过（现在断开）才显示收件箱
  // 如果还在初始连接中，保持在 Generator 页面
  const showInbox = currentEmail && status !== "connecting";

  return (
    <ErrorBoundary>
      <div className="app">
      <header>
        <h1>临时邮箱</h1>
        <p>60 分钟有效期 · 实时接收邮件</p>
      </header>

      {!showInbox ? (
        <EmailGenerator
          onGenerate={handleEmailGenerate}
          apiUrl={API_URL}
          onError={(msg) => setToast({ message: msg, type: "error" })}
          isLoading={currentEmail && status === "connecting"}
        />
      ) : (
        <div className="email-view">
          <div className="email-info">
            <div className="address-container">
              <div className="address">{currentEmail}</div>
              <button
                className="copy-btn"
                onClick={handleCopyEmail}
                title="复制邮箱地址"
              >
                复制
              </button>
            </div>
            <div className="meta">
              <Timer expiresAt={expiresAt} connected={status === "connected"} />
              <span
                className={`status ${status === "connected" ? "connected" : "disconnected"}`}
              >
                {status === "connected" ? "● 已连接" : "○ 已断开"}
              </span>
            </div>
          </div>

          {/* 断线警告横幅 - 仅在真正断开时显示 */}
          {status === "disconnected" && (
            <div className="connection-warning">
              <span className="warning-icon">⚠️</span>
              <div className="warning-content">
                <strong>连接已断开</strong>
                <p>无法接收新邮件，已接收的邮件仍可查看</p>
              </div>
            </div>
          )}

          <EmailList messages={messages} onMessageClick={handleMessageClick} />
        </div>
      )}

      {selectedMessage && (
        <EmailViewer message={selectedMessage} onClose={handleCloseViewer} />
      )}

      <footer className="app-footer">
        <span>© 2026 TempMail</span>
        <span>·</span>
        <a
          href="https://github.com/BenZinaDaze/TempMail"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </footer>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}
