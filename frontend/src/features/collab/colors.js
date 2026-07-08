// Deterministic cursor color per user id/name (matches the app's accent palette).
const PALETTE = [
  "#6366f1", "#06b6d4", "#22c55e", "#f59e0b",
  "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6",
];

export function colorFor(seed) {
  const s = String(seed || "anon");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
