import type React from "react";

export function formatKeyCombo(e: React.KeyboardEvent): string | null {
  const ignore = new Set(["Control", "Shift", "Alt", "Meta"]);
  if (ignore.has(e.key)) return null;

  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (mods.length === 0) return null;

  let keyToken = "";
  if (e.code.startsWith("Key")) {
    keyToken = e.code.slice(3).toUpperCase();
  } else if (e.code.startsWith("Digit")) {
    keyToken = e.code.slice(5);
  } else if (e.code === "Space" || e.key === " ") {
    keyToken = "Space";
  } else if (/^F([1-9]|1[0-2])$/i.test(e.key)) {
    keyToken = e.key.toUpperCase();
  } else if (e.code === "Backquote") {
    keyToken = "Backquote";
  } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
    keyToken = e.key.toUpperCase();
  }

  if (!keyToken) return null;
  return [...mods, keyToken].join("+");
}
