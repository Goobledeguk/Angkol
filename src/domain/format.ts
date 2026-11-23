const LABELS: Record<string, string> = {
  open: "Open",
  "in review": "In review",
  in_review: "In review",
  resolved: "Resolved",
  closed: "Closed",
  dismissed: "Dismissed",
};

export function statusLabel(status: string) {
  const key = status.trim().toLowerCase();
  if (LABELS[key]) {
    return LABELS[key];
  }
  const text = key.replace(/[_-]+/g, " ");
  return text ? text[0].toUpperCase() + text.slice(1) : "Open";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function normalizePhMobile(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (/^\+639\d{9}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }
  if (/^639\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function isPhMobile(value: string) {
  return /^09\d{9}$/.test(normalizePhMobile(value));
}
