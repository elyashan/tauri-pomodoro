import { useEffect, useRef, useState } from "react";
import { IconClock } from "./Icons";

export interface TimeInput24Props {
  value: string;
  onChange: (hm: string) => void;
  onSubmit?: (normalizedValue?: string) => void;
  onCancel?: () => void;
  className?: string;
}

function clampPad(n: number, max: number): string {
  const clamped = Math.min(max, Math.max(0, Math.floor(n)));
  return clamped.toString().padStart(2, "0");
}

function parseHm(value: string): [string, string] {
  const m = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) {
    const d = new Date();
    return [clampPad(d.getHours(), 23), clampPad(d.getMinutes(), 59)];
  }
  return [clampPad(Number(m[1]), 23), clampPad(Number(m[2]), 59)];
}

/**
 * Compact 24-hour HH:MM input matching Linear styling without OS AM/PM chrome.
 */
export function TimeInput24({
  value,
  onChange,
  onSubmit,
  onCancel,
  className,
}: TimeInput24Props) {
  const [hourStr, setHourStr] = useState(() => parseHm(value)[0]);
  const [minStr, setMinStr] = useState(() => parseHm(value)[1]);
  const hourRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const [h, m] = parseHm(value);
    setHourStr(h);
    setMinStr(m);
  }, [value]);

  const emitNormalized = (rawH: string, rawM: string): [string, string] => {
    const h = clampPad(parseInt(rawH || "0", 10) || 0, 23);
    const m = clampPad(parseInt(rawM || "0", 10) || 0, 59);
    const next = `${h}:${m}`;
    if (next !== value) {
      onChange(next);
    }
    return [h, m];
  };

  const stepHour = (delta: number) => {
    const curH = parseInt(hourStr || "0", 10) || 0;
    const nextH = (curH + delta + 24) % 24;
    const padded = clampPad(nextH, 23);
    setHourStr(padded);
    emitNormalized(padded, minStr);
  };

  const stepMinute = (delta: number) => {
    const curH = parseInt(hourStr || "0", 10) || 0;
    const curM = parseInt(minStr || "0", 10) || 0;
    const total = (curH * 60 + curM + delta + 1440) % 1440;
    const nextH = clampPad(Math.floor(total / 60), 23);
    const nextM = clampPad(total % 60, 59);
    setHourStr(nextH);
    setMinStr(nextM);
    emitNormalized(nextH, nextM);
  };

  return (
    <div
      className={`time24-box ${className || ""}`}
      onClick={(e) => {
        if (e.target !== minRef.current && e.target !== hourRef.current) {
          hourRef.current?.focus();
          hourRef.current?.select();
        }
      }}
    >
      <IconClock size={11} className="time24-icon" />
      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        aria-label="Hour"
        className="time24-seg"
        maxLength={2}
        value={hourStr}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
          if (digits.length === 0) {
            setHourStr("");
            return;
          }
          if (digits.length === 1 && Number(digits) >= 3) {
            const padded = `0${digits}`;
            setHourStr(padded);
            emitNormalized(padded, minStr);
            minRef.current?.focus();
            minRef.current?.select();
            return;
          }
          if (digits.length === 2) {
            const padded = clampPad(Number(digits), 23);
            setHourStr(padded);
            emitNormalized(padded, minStr);
            minRef.current?.focus();
            minRef.current?.select();
            return;
          }
          setHourStr(digits);
        }}
        onBlur={() => {
          const [h] = emitNormalized(hourStr, minStr);
          setHourStr(h);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            stepHour(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            stepHour(-1);
          } else if (e.key === "ArrowRight" || e.key === ":") {
            e.preventDefault();
            minRef.current?.focus();
            minRef.current?.select();
          } else if (e.key === "Enter") {
            e.preventDefault();
            const [h, m] = emitNormalized(hourStr, minStr);
            setHourStr(h);
            setMinStr(m);
            onSubmit?.(`${h}:${m}`);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
        onWheel={(e) => {
          if (document.activeElement !== e.currentTarget) return;
          if (e.cancelable) e.preventDefault();
          stepHour(e.deltaY < 0 ? 1 : -1);
        }}
      />
      <span className="time24-sep">:</span>
      <input
        ref={minRef}
        type="text"
        inputMode="numeric"
        aria-label="Minute"
        className="time24-seg"
        maxLength={2}
        value={minStr}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
          if (digits.length === 0) {
            setMinStr("");
            return;
          }
          if (digits.length === 1 && Number(digits) >= 6) {
            const padded = `0${digits}`;
            setMinStr(padded);
            emitNormalized(hourStr, padded);
            return;
          }
          if (digits.length === 2) {
            const padded = clampPad(Number(digits), 59);
            setMinStr(padded);
            emitNormalized(hourStr, padded);
            return;
          }
          setMinStr(digits);
        }}
        onBlur={() => {
          const [, m] = emitNormalized(hourStr, minStr);
          setMinStr(m);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            stepMinute(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            stepMinute(-1);
          } else if (
            e.key === "ArrowLeft" ||
            (e.key === "Backspace" && minStr.length === 0)
          ) {
            e.preventDefault();
            hourRef.current?.focus();
            hourRef.current?.select();
          } else if (e.key === "Enter") {
            e.preventDefault();
            const [h, m] = emitNormalized(hourStr, minStr);
            setHourStr(h);
            setMinStr(m);
            onSubmit?.(`${h}:${m}`);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
        onWheel={(e) => {
          if (document.activeElement !== e.currentTarget) return;
          if (e.cancelable) e.preventDefault();
          stepMinute(e.deltaY < 0 ? 1 : -1);
        }}
      />
    </div>
  );
}
