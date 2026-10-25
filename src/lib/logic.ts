import { OPEN_CLAIM_STATUSES, REMIND, CLAIM_STATUSES } from "./constants";
import { addDays, daysUntil, todayISO } from "./format";
import type { Claim, FoodProduct, Pet, Policy, Vaccination } from "./types";

// Pure functions only: used by the app and by the daily reminders job.

/** The most recent record of each vaccine type. */
export function latestPerType(vaccinations: Vaccination[]) {
  const map = new Map<string, Vaccination>();
  for (const v of vaccinations) {
    const cur = map.get(v.type);
    if (!cur || v.given_on > cur.given_on) map.set(v.type, v);
  }
  return [...map.values()].sort((a, b) => (a.next_due ?? "9999").localeCompare(b.next_due ?? "9999"));
}

export type VaxStatus = "ok" | "soon" | "overdue" | "none";

export function vaxStatus(nextDue: string | null, today = todayISO()): VaxStatus {
  if (!nextDue) return "none";
  const d = daysUntil(nextDue, today);
  if (d < 0) return "overdue";
  if (d <= REMIND.statusSoon) return "soon";
  return "ok";
}

export const VAX_STATUS_LABEL: Record<VaxStatus, string> = {
  ok: "בתוקף",
  soon: "מתקרב",
  overdue: "עבר",
  none: "ללא מועד",
};

/** Grams in one purchase. */
export function purchaseGrams(p: FoodProduct, quantity: number) {
  return (p.bag_kg ?? 0) * 1000 * quantity;
}

/**
 * Estimated date the food runs out: purchases stack — a new bag bought before the
 * previous ran out extends the end date. Null when daily grams or bag size are missing.
 */
export function foodRunOut(p: FoodProduct): string | null {
  if (!p.daily_grams || !p.bag_kg || p.food_purchases.length === 0) return null;
  const purchases = [...p.food_purchases].sort((a, b) => a.date.localeCompare(b.date));
  let end: string | null = null;
  for (const pu of purchases) {
    const start: string = end && end > pu.date ? end : pu.date;
    end = addDays(start, purchaseGrams(p, pu.quantity) / p.daily_grams);
  }
  return end;
}

/** Average price per kg for each purchase (for spotting price rises). */
export function pricePerKg(p: FoodProduct) {
  if (!p.bag_kg) return [];
  return [...p.food_purchases]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((pu) => ({ date: pu.date, value: pu.price / (p.bag_kg! * pu.quantity) }));
}

/** The policy that covers today, else the newest one. */
export function activePolicy(policies: Policy[], today = todayISO()) {
  const sorted = [...policies].sort((a, b) => b.start_date.localeCompare(a.start_date));
  return (
    sorted.find((p) => p.start_date <= today && (!p.renewal_date || p.renewal_date >= today)) ?? sorted[0] ?? null
  );
}

export function claimStuckDays(c: Claim, today = todayISO()) {
  if (c.status !== "in_review") return 0;
  return -daysUntil(c.status_changed_at.slice(0, 10), today);
}

export type UpcomingItem = {
  key: string; // stable id, also used to avoid sending a reminder twice
  kind: "vaccine" | "food" | "policy" | "license" | "claim";
  petId: string;
  title: string;
  detail: string;
  date: string; // the relevant due date
  days: number;
  href: string;
  tone: "red" | "amber" | "green" | "blue";
};

type PetBundle = {
  pet: Pet;
  vaccinations: Vaccination[];
  products: FoodProduct[];
  policies: Policy[];
};

/** Everything coming up for one dog, most urgent first. */
export function upcomingItems({ pet, vaccinations, products, policies }: PetBundle, today = todayISO()) {
  const items: UpcomingItem[] = [];

  for (const v of latestPerType(vaccinations)) {
    if (!v.next_due) continue;
    const days = daysUntil(v.next_due, today);
    if (days > 60) continue;
    items.push({
      key: `vaccine:${v.id}:${v.next_due}`,
      kind: "vaccine",
      petId: pet.id,
      title: v.type,
      detail: days < 0 ? "המועד עבר" : "מועד הבא",
      date: v.next_due,
      days,
      href: `/health/vaccination?type=${encodeURIComponent(v.type)}`,
      tone: days < 0 ? "red" : days <= REMIND.vaccineSoon ? "amber" : "green",
    });
  }

  for (const p of products) {
    if (!p.active) continue;
    const end = foodRunOut(p);
    if (!end) continue;
    const days = daysUntil(end, today);
    if (days > 14) continue;
    items.push({
      key: `food:${p.id}:${end}`,
      kind: "food",
      petId: pet.id,
      title: `${p.brand} נגמר`,
      detail: days < 0 ? "כנראה כבר נגמר" : "לפי מנה יומית",
      date: end,
      days,
      href: "/food",
      tone: days <= 0 ? "red" : days <= REMIND.foodSoon ? "amber" : "green",
    });
  }

  const policy = activePolicy(policies, today);
  if (policy?.renewal_date) {
    const days = daysUntil(policy.renewal_date, today);
    if (days <= REMIND.policyRenewal) {
      items.push({
        key: `policy:${policy.id}:${policy.renewal_date}`,
        kind: "policy",
        petId: pet.id,
        title: `חידוש ביטוח ${policy.company}`,
        detail: days < 0 ? "הפוליסה פגה" : "תאריך חידוש",
        date: policy.renewal_date,
        days,
        href: `/insurance/policy?id=${policy.id}`,
        tone: days < 0 ? "red" : "amber",
      });
    }
  }

  for (const pol of policies) {
    for (const c of pol.insurance_claims) {
      if (!OPEN_CLAIM_STATUSES.includes(c.status)) continue;
      const stuck = claimStuckDays(c, today);
      items.push({
        key: `claim:${c.id}:${c.status}`,
        kind: "claim",
        petId: pet.id,
        title: `תביעה ${CLAIM_STATUSES[c.status]}`,
        detail: stuck > REMIND.claimStuck ? `בטיפול כבר ${stuck} ימים` : `${pol.company} · ₪${c.amount_claimed}`,
        date: c.submitted_on ?? c.status_changed_at.slice(0, 10),
        days: stuck > REMIND.claimStuck ? 0 : 999, // stuck claims go to the top, others after due dates
        href: `/insurance/claim?id=${c.id}`,
        tone: stuck > REMIND.claimStuck ? "red" : "blue",
      });
    }
  }

  if (pet.license_renewal) {
    const days = daysUntil(pet.license_renewal, today);
    if (days <= REMIND.licenseRenewal) {
      items.push({
        key: `license:${pet.id}:${pet.license_renewal}`,
        kind: "license",
        petId: pet.id,
        title: "חידוש רישיון עירוני",
        detail: days < 0 ? "הרישיון פג" : "תאריך חידוש",
        date: pet.license_renewal,
        days,
        href: "/more/pet",
        tone: days < 0 ? "red" : "amber",
      });
    }
  }

  return items.sort((a, b) => a.days - b.days);
}

/**
 * Which items deserve a notification today, per the spec:
 * vaccine a week before and on the day; food 5 days before; policy 30 days before;
 * license 30 days before; claim in review over 30 days.
 */
export function reminderDue(item: UpcomingItem, today = todayISO()): string | null {
  const d = daysUntil(item.date, today);
  switch (item.kind) {
    case "vaccine":
      if (d === REMIND.vaccineSoon) return `${item.key}:week`;
      if (d === 0) return `${item.key}:day`;
      return null;
    case "food":
      return d <= REMIND.foodSoon && d >= 0 ? `${item.key}:soon` : null;
    case "policy":
    case "license":
      return d <= REMIND.policyRenewal && d >= 0 ? `${item.key}:soon` : null;
    case "claim":
      return item.tone === "red" ? `${item.key}:stuck` : null;
  }
}
