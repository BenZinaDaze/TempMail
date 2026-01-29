import { useState, useEffect } from "react";

export default function Timer({ expiresAt, connected }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isWarning, setIsWarning] = useState(false);

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
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (connected === false) {
    return null;
  }

  return (
    <div className={`timer ${isWarning ? "warning" : ""}`}>
      ⏱️ 剩余时间 {timeLeft}
    </div>
  );
}
