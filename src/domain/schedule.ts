import type { Route } from "../types/types";

const ZONE = "Asia/Manila";

export function toMinutes(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return NaN;
  }
  return h * 60 + m;
}

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function cityClock(now: number) {
  return new Date(now).toLocaleTimeString("en-GB", {
    timeZone: ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function cityHour(now: number) {
  return Number(
    new Date(now).toLocaleTimeString("en-GB", {
      timeZone: ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }),
  );
}

export function greeting(now: number) {
  const hour = cityHour(now);
  if (hour >= 5 && hour < 12) {
    return "Maupay nga aga";
  }
  if (hour >= 12 && hour < 18) {
    return "Maupay nga kulop";
  }
  return "Maupay nga gab-i";
}

type Schedule = Pick<Route, "scheduled" | "interval" | "startsAt" | "endsAt">;

export function nextDeparture(route: Schedule, now: number) {
  if (route.scheduled === false || !route.interval || !route.startsAt || !route.endsAt) {
    return "No fixed schedule";
  }
  const start = toMinutes(route.startsAt);
  const end = toMinutes(route.endsAt);
  const current = toMinutes(cityClock(now));
  if ([start, end, current].some(Number.isNaN)) {
    return "No fixed schedule";
  }
  const step = Math.max(1, route.interval);
  const next = Math.max(start, start + Math.ceil((current - start) / step) * step);
  return next > end ? `Tomorrow ${route.startsAt}` : formatMinutes(next);
}

export function minutesUntil(route: Schedule, now: number): number | null {
  const label = nextDeparture(route, now);
  if (!/^\d{2}:\d{2}$/.test(label)) {
    return null;
  }
  return toMinutes(label) - toMinutes(cityClock(now));
}

export function waitLabel(route: Schedule, now: number) {
  const minutes = minutesUntil(route, now);
  if (minutes === null) {
    return "Estimated";
  }
  if (minutes <= 0) {
    return "Boarding now";
  }
  if (minutes < 60) {
    return `In ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `In ${hours} h ${rest} min` : `In ${hours} h`;
}
