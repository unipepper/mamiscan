import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** pregnancy_start_date(YYYY-MM-DD)로부터 오늘 기준 임신 주차를 계산 */
export function calcPregnancyWeek(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  if (week < 1 || week > 42) return null;
  return week;
}

/** 임신 주차(1–42)를 역산하여 pregnancy_start_date(YYYY-MM-DD)를 반환 */
export function weeksToStartDate(weeks: number): string {
  const today = new Date();
  const diffDays = (weeks - 1) * 7;
  const start = new Date(today.getTime() - diffDays * 24 * 60 * 60 * 1000);
  return start.toISOString().split('T')[0];
}
