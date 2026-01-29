import { useState, useEffect, useMemo } from "react";

export default function Timer({ expiresAt, connected }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isWarning, setIsWarning] = useState(false);

  // 使用 useMemo 计算更新间隔，优化更新频率
  // 剩余时间 > 1 分钟：每 10 秒更新一次
  // 剩余时间 <= 1 分钟：每秒更新一次
  const updateInterval = useMemo(() => {
    const now = Date.now();
    const diff = expiresAt - now;
    return diff > 60000 ? 10000 : 1000; // 10 秒或 1 秒
  }, [expiresAt]);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeLeft("已过期");
        setIsWarning(true);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${minutes} : ${seconds.toString().padStart(2, "0")}`);
      setIsWarning(minutes < 5);
    };

    updateTimer();
    const interval = setInterval(updateTimer, updateInterval);

    return () => clearInterval(interval);
  }, [expiresAt, updateInterval]);

  if (connected === false) {
    return null;
  }

  return (
    <div className={`timer ${isWarning ? "warning" : ""}`}>
      ⏱️ 剩余时间 {timeLeft}
    </div>
  );
}
