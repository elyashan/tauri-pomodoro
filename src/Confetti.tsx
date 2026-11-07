import { useEffect, useRef } from "react";

interface ConfettiProps {
  durationMs?: number;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  vRot: number;
  opacity: number;
  shape: "rect" | "circle";
}

const COLORS = [
  "#fbbf24", // gold
  "#38bdf8", // sky blue
  "#34d399", // emerald
  "#f43f5e", // rose
  "#a855f7", // purple
  "#f97316", // orange
  "#ec4899", // pink
];

export function ConfettiCanvas({ durationMs = 3800, onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth || 240);
    const height = (canvas.height = canvas.offsetHeight || 124);

    const particles: Particle[] = [];
    const count = 48;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * 40,
        y: height / 2 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 5.5,
        vy: -Math.random() * 4.5 - 1.5,
        w: Math.random() * 5 + 3,
        h: Math.random() * 4 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
        shape: Math.random() > 0.35 ? "rect" : "circle",
      });
    }

    const startTime = Date.now();
    let animId: number;

    const render = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / durationMs;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // Gravity
        p.vx *= 0.99; // Air friction
        p.rotation += p.vRot;

        if (progress > 0.65) {
          p.opacity = Math.max(0, 1 - (progress - 0.65) / 0.35);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      });

      if (progress < 1) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="confetti-canvas"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
