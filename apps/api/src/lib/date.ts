/**
 * Parses a YYYY-MM-DD or ISO datetime string into a UTC Date.
 */
export function parseDateInput(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00.000Z`);
  }
  return new Date(raw);
}

/**
 * Returns [startOfMonthUTC, startOfNextMonthUTC] for a YYYY-MM string.
 */
export function getMonthBounds(monthStr?: string): {
  month: string;
  start: Date;
  end: Date;
} {
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const target = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : fallback;
  const [yStr, mStr] = target.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { month: target, start, end };
}

export function getLastNMonths(anchorMonth: string, count: number): string[] {
  const [yStr, mStr] = anchorMonth.split("-");
  const anchorYear = Number(yStr);
  const anchorMonthIndex = Number(mStr) - 1;
  const result: string[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anchorYear, anchorMonthIndex - i, 1));
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}
