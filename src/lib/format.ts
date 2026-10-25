/** Dates are stored as 'YYYY-MM-DD' strings and handled in local time. */

export function todayISO() {
  return toISO(new Date());
}

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + Math.round(days));
  return toISO(d);
}

export function addYears(iso: string, years: number) {
  const d = parseISO(iso);
  d.setFullYear(d.getFullYear() + years);
  return toISO(d);
}

/** Whole days from today until iso (negative = in the past). */
export function daysUntil(iso: string, from = todayISO()) {
  return Math.round((parseISO(iso).getTime() - parseISO(from).getTime()) / 86_400_000);
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return parseISO(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
}

export function fmtMonth(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export function fmtMoney(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return "₪" + v.toLocaleString("he-IL", { maximumFractionDigits: v % 1 === 0 ? 0 : 2 });
}

export function fmtDaysLeft(days: number) {
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  if (days === -1) return "אתמול";
  if (days < 0) return `לפני ${-days} ימים`;
  return `בעוד ${days} ימים`;
}

export function ageText(birth: string | null) {
  if (!birth) return "";
  const b = parseISO(birth);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return m === 1 ? "חודש" : `${m} חודשים`;
  const years = y === 1 ? "שנה" : y === 2 ? "שנתיים" : `${y} שנים`;
  return m ? `${years} ו-${m === 1 ? "חודש" : `${m} חודשים`}` : years;
}

export function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function str(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Random UUID v4. crypto.randomUUID only exists on https pages, so fall back to getRandomValues. */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
