import type { ClaimStatus, CostCategory, ExpenseCategory, FoodKind } from "./types";

/** Preset vaccine / preventive treatment types and the default days until the next one. */
export const VACCINE_TYPES: { name: string; days: number }[] = [
  { name: "כלבת", days: 365 },
  { name: "משושה", days: 365 },
  { name: "שעלת מכלאות", days: 365 },
  { name: "תילוע", days: 90 },
  { name: "פרעושים וקרציות", days: 30 },
];
export const DEFAULT_VACCINE_DAYS = 365;

export function defaultIntervalDays(type: string) {
  return VACCINE_TYPES.find((t) => t.name === type)?.days ?? DEFAULT_VACCINE_DAYS;
}

export const FOOD_KINDS: Record<FoodKind, string> = { dry: "יבש", wet: "רטוב", treats: "חטיפים" };

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  grooming: "מספרה",
  equipment: "ציוד",
  toys: "צעצועים",
  boarding: "פנסיון",
  training: "אילוף",
  license: "רישיון",
  other: "אחר",
};

export const COST_CATEGORIES: Record<CostCategory, string> = {
  food: "אוכל",
  vet: "וטרינר",
  insurance: "ביטוח",
  vaccinations: "חיסונים",
  other: "אחר",
};

export const COST_COLORS: Record<CostCategory, string> = {
  food: "#d97706",
  vet: "#0f766e",
  insurance: "#4f46e5",
  vaccinations: "#db2777",
  other: "#64748b",
};

export const CLAIM_STATUSES: Record<ClaimStatus, string> = {
  draft: "טיוטה",
  submitted: "הוגשה",
  in_review: "בטיפול",
  approved: "אושרה",
  partial: "אושרה חלקית",
  rejected: "נדחתה",
  paid: "שולמה",
};

export const OPEN_CLAIM_STATUSES: ClaimStatus[] = ["draft", "submitted", "in_review", "approved", "partial"];

/** Reminder windows (days before). */
export const REMIND = {
  vaccineSoon: 7,
  foodSoon: 5,
  policyRenewal: 30,
  licenseRenewal: 30,
  claimStuck: 30,
  statusSoon: 30, // vaccine shown as "מתקרב"
};
