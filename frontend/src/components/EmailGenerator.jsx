import { useState } from "react";

export default function EmailGenerator({
  onGenerate,
  apiUrl,
  onError,
  isLoading,
}) {
  const [prefix, setPrefix] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  // 实际的 loading 状态是：本地请求中 OR 等待 WebSocket 连接中
  const isGlobalLoading = localLoading || isLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/email/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix: prefix || null }),
      });

      const data = await response.json();
      onGenerate(data);
    } catch (error) {
      console.error("Failed to generate email:", error);
      if (onError) {
        onError("生成邮箱失败，请检查后端服务是否启动");
      } else {
        alert("生成邮箱失败，请检查后端服务是否启动");
      }
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="email-generator">
      <h2>生成临时邮箱</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="prefix">自定义前缀（可选）</label>
          <input
            id="prefix"
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="留空则随机生成"
            pattern="[a-zA-Z0-9\-]*"
            title="只能包含字母、数字和连字符"
            disabled={isGlobalLoading}
          />
        </div>
        <button type="submit" disabled={isGlobalLoading}>
          {isGlobalLoading ? "生成中..." : "生成邮箱"}
        </button>
      </form>
    </div>
  );
}
