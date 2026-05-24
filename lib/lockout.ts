"use client";

export const PROGRESSIVE_DURATIONS = [60, 300, 900] as const; // 1min, 5min, 15min

export function getStrikeKey(form: "login" | "signup") {
  return `${form}-lockout-strikes`;
}

export function getStrikeCount(form: "login" | "signup"): number {
  if (typeof window === "undefined") return 0;
  const key = getStrikeKey(form);
  const stored = localStorage.getItem(key);
  if (!stored) return 0;
  const parsed = parseInt(stored, 10);
  return isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, PROGRESSIVE_DURATIONS.length));
}

export function incrementStrike(form: "login" | "signup"): number {
  const current = getStrikeCount(form);
  const next = Math.min(current + 1, PROGRESSIVE_DURATIONS.length);
  localStorage.setItem(getStrikeKey(form), String(next));
  return next;
}

export function resetStrikes(form: "login" | "signup") {
  localStorage.removeItem(getStrikeKey(form));
}

export function getLockoutLabel(strikes: number): string {
  if (strikes <= 0) return "";
  if (strikes === 1) return "1st lockout";
  if (strikes === 2) return "2nd lockout";
  if (strikes === 3) return "3rd lockout";
  return `${strikes}th lockout`;
}

export function getLockoutDuration(form: "login" | "signup"): number {
  const strikes = getStrikeCount(form);
  // strikes is 1-indexed, array is 0-indexed
  const level = Math.min(strikes - 1, PROGRESSIVE_DURATIONS.length - 1);
  return PROGRESSIVE_DURATIONS[Math.max(0, level)];
}
