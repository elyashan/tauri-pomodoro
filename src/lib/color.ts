export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexRgb(hex: string): RgbColor {
  if (!hex || !hex.startsWith("#") || hex.length < 7) {
    return { r: 0, g: 0, b: 0 };
  }
  const n = parseInt(hex.slice(1, 7), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return false;
  const { r, g, b } = parseHexRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
