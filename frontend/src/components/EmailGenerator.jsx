import { useState } from "react";
import { validateEmailPrefix } from "../utils/validation";

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

    // 前端校验（与后端规则一致）
    const trimmed = prefix.trim();
    const valueToSend = trimmed === "" ? null : trimmed;
    const validation = validateEmailPrefix(prefix);
    if (!validation.valid) {
      if (onError) {
        onError(validation.error);
      } else {
        alert(validation.error);
      }
      return;
    }

    setLocalLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/email/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix: valueToSend }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 展示后端返回的验证或错误信息
        const message =
          data.error || data.message || "生成邮箱失败，请稍后重试";
        if (onError) {
          onError(message);
        } else {
          alert(message);
        }
        return;
      }

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
            pattern="[a-zA-Z0-9_\-]*"
            title="只能包含字母、数字、连字符和下划线"
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
