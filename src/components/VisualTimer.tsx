export type TimerStyle = "digital" | "pie" | "candle";

export interface VisualTimerProps {
  style: TimerStyle;
  clockText: string;
  remainingRatio: number;
  accentColor: string;
  isRunning: boolean;
  isBreakAlarm: boolean;
  title: string;
  onClick: () => void;
}

export function VisualTimer({
  style,
  clockText,
  remainingRatio,
  accentColor,
  isRunning,
  isBreakAlarm,
  title,
  onClick,
}: VisualTimerProps) {
  const ratio = isBreakAlarm ? 0 : Math.max(0, Math.min(1, remainingRatio));

  if (style === "pie") {
    const r = 24;
    const cx = 32;
    const cy = 32;
    const circ = 2 * Math.PI * r;
    const dash = circ * ratio;
    const ringColor = isBreakAlarm ? "#ef4444" : accentColor;

    return (
      <div
        className={`visual-timer-wrap pie clickable-timer ${isBreakAlarm ? "alarm-timer" : ""}`}
        onClick={onClick}
        title={title}
      >
        <svg
          width="66"
          height="66"
          viewBox="0 0 64 64"
          className="visual-pie-svg"
          aria-hidden="true"
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(161, 161, 170, 0.22)"
            strokeWidth="12"
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.35s linear" }}
          />
          <circle
            cx={cx}
            cy={cy}
            r="14"
            fill="rgba(0, 0, 0, 0.22)"
          />
        </svg>
        <div
          className={`timer-display visual-clock ${isBreakAlarm ? "alarm-timer" : ""}`}
        >
          {clockText}
        </div>
      </div>
    );
  }

  if (style === "candle") {
    const maxWaxH = 44;
    const minWaxH = 6;
    const waxH = minWaxH + (maxWaxH - minWaxH) * ratio;
    const holderY = 66;
    const waxY = holderY - waxH;
    const wickTopY = waxY - 7;
    const waxColor = isBreakAlarm ? "#ef4444" : accentColor;

    return (
      <div
        className={`visual-timer-wrap candle clickable-timer ${isBreakAlarm ? "alarm-timer" : ""}`}
        onClick={onClick}
        title={title}
      >
        <svg
          width="54"
          height="74"
          viewBox="0 0 54 74"
          className="visual-candle-svg"
          aria-hidden="true"
        >
          {/* Mum altlığı */}
          <rect
            x="9"
            y={holderY}
            width="36"
            height="5"
            rx="2.5"
            fill="rgba(161, 161, 170, 0.45)"
          />
          {/* Mum gövdesi */}
          <rect
            x="17"
            y={waxY}
            width="20"
            height={waxH}
            rx="3.5"
            fill={waxColor}
            fillOpacity="0.88"
            style={{ transition: "y 0.35s linear, height 0.35s linear" }}
          />
          {/* Işık yansıması */}
          <rect
            x="20"
            y={waxY + 2}
            width="4"
            height={Math.max(2, waxH - 4)}
            rx="2"
            fill="rgba(255, 255, 255, 0.28)"
            style={{ transition: "y 0.35s linear, height 0.35s linear" }}
          />
          {/* Fitil */}
          <line
            x1="27"
            y1={waxY}
            x2="27"
            y2={wickTopY}
            stroke="#d4d4d8"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Alev (çalışırken canlı titrer, dururken söner/soluklaşır) */}
          {!isBreakAlarm && (
            <g className={isRunning ? "candle-flame-live" : "candle-flame-paused"}>
              <path
                d={`M27 ${wickTopY - 14} C32 ${wickTopY - 8}, 33 ${wickTopY - 2}, 27 ${wickTopY} C21 ${wickTopY - 2}, 22 ${wickTopY - 8}, 27 ${wickTopY - 14} Z`}
                fill={isRunning ? "#fb923c" : "#a1a1aa"}
                fillOpacity={isRunning ? 0.95 : 0.45}
              />
              {isRunning && (
                <path
                  d={`M27 ${wickTopY - 10} C29.6 ${wickTopY - 6}, 30 ${wickTopY - 2}, 27 ${wickTopY - 1} C24 ${wickTopY - 2}, 24.4 ${wickTopY - 6}, 27 ${wickTopY - 10} Z`}
                  fill="#fef08a"
                />
              )}
            </g>
          )}
        </svg>
        <div
          className={`timer-display visual-clock ${isBreakAlarm ? "alarm-timer" : ""}`}
        >
          {clockText}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`timer-display clickable-timer ${isBreakAlarm ? "alarm-timer" : ""}`}
      onClick={onClick}
      title={title}
    >
      {clockText}
    </div>
  );
}
