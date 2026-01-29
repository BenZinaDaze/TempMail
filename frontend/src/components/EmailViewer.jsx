import { useEffect, useRef } from "react";

export default function EmailViewer({ message, onClose }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    // 当有 HTML 内容时，注入到 iframe
    if (message.html && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(message.html);
      doc.close();
    }
  }, [message.html]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // 下载附件（优化版：使用更高效的 Base64 解码方式）
  const downloadAttachment = (attachment) => {
    if (!attachment.content) return;

    try {
      // Base64 解码 - 优化：使用 Uint8Array.from 和 map 替代循环
      const byteCharacters = atob(attachment.content);
      const byteArray = Uint8Array.from(
        byteCharacters,
        (char) => char.charCodeAt(0)
      );
      const blob = new Blob([byteArray], { type: attachment.contentType });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("下载附件失败:", error);
      alert("下载附件失败，请重试");
    }
  };

  return (
    <div className="email-viewer" onClick={handleBackdropClick}>
      <div className="viewer-content">
        <div className="viewer-header">
          <div>
            <h2>{message.subject}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="viewer-body">
          <div className="email-meta">
            <div className="meta-row">
              <span className="meta-label">发件人：</span>
              <span className="meta-value">{message.from}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">时间：</span>
              <span className="meta-value">
                {new Date(message.receivedAt).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>

          <div className="email-content">
            {message.html ? (
              <iframe
                ref={iframeRef}
                title="邮件内容"
                sandbox="allow-same-origin"
              />
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {message.text || "(无内容)"}
              </pre>
            )}
          </div>

          {/* 附件列表 */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="email-attachments">
              <div className="attachments-header">
                附件 ({message.attachments.length})
              </div>
              <div className="attachments-list">
                {message.attachments.map((att, index) => {
                  // 获取文件扩展名
                  const ext =
                    att.filename.split(".").pop()?.toUpperCase() || "FILE";
                  const fileType = att.contentType.split("/")[0]; // image, application, text等

                  return (
                    <div key={index} className="attachment-item">
                      <div className="attachment-info">
                        <span className={`attachment-icon file-${fileType}`}>
                          {ext.length <= 4 ? ext : "FILE"}
                        </span>
                        <div className="attachment-details">
                          <span className="attachment-name">
                            {att.filename}
                          </span>
                          <span className="attachment-size">
                            {formatFileSize(att.size)}
                          </span>
                        </div>
                      </div>
                      <button
                        className="attachment-download"
                        onClick={() => downloadAttachment(att)}
                      >
                        下载
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
