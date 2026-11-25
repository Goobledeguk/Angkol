/** Two-letter initials for an avatar fallback, e.g. "Karen Davila" → "KD". */
export function initials(name?: string | null, fallback = "?"): string {
  const value = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return value || fallback;
}
