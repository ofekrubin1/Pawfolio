export type Household = { id: string; name: string; join_code: string; created_by: string | null };

export type Member = {
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
  email: string | null;
  notify_email: boolean;
  notify_push: boolean;
  joined_at: string;
};

export type Pet = {
  id: string;
  household_id: string;
  name: string;
  photo_path: string | null;
  breed: string | null;
  birth_date: string | null;
  sex: "female" | "male" | null;
  neutered: boolean | null;
  chip_number: string | null;
  license_number: string | null;
  license_renewal: string | null;
  allergies: string | null;
  conditions: string | null;
  medications: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  emergency_token: string | null;
};

export type Vaccination = {
  id: string;
  pet_id: string;
  type: string;
  given_on: string;
  next_due: string | null;
  given_by: string | null;
  cost: number | null;
  notes: string | null;
};

export type VetVisit = {
  id: string;
  pet_id: string;
  date: string;
  clinic: string | null;
  reason: string;
  diagnosis: string | null;
  treatment: string | null;
  cost: number | null;
  weight_kg: number | null;
};

export type Weight = { id: string; pet_id: string; date: string; kg: number; vet_visit_id: string | null };

export type FoodKind = "dry" | "wet" | "treats";

export type FoodPurchase = {
  id: string;
  product_id: string;
  date: string;
  quantity: number;
  price: number;
  store: string | null;
};

export type FoodProduct = {
  id: string;
  pet_id: string;
  brand: string;
  kind: FoodKind;
  bag_kg: number | null;
  daily_grams: number | null;
  store: string | null;
  active: boolean;
  food_purchases: FoodPurchase[];
};

export type ClaimStatus = "draft" | "submitted" | "in_review" | "approved" | "partial" | "rejected" | "paid";

export type Claim = {
  id: string;
  policy_id: string;
  vet_visit_id: string | null;
  submitted_on: string | null;
  amount_claimed: number;
  status: ClaimStatus;
  status_changed_at: string;
  amount_paid: number | null;
  paid_on: string | null;
  rejection_reason: string | null;
  notes: string | null;
};

export type Policy = {
  id: string;
  pet_id: string;
  company: string;
  policy_no: string | null;
  coverage_type: string | null;
  yearly_premium: number;
  deductible: number | null;
  coverage_cap: number | null;
  start_date: string;
  renewal_date: string | null;
  insurance_claims: Claim[];
};

export type ExpenseCategory = "grooming" | "equipment" | "toys" | "boarding" | "training" | "license" | "other";

export type Expense = {
  id: string;
  pet_id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
};

export type Attachment = {
  id: string;
  household_id: string;
  entity_type: "vaccination" | "vet_visit" | "food_purchase" | "policy" | "claim" | "expense" | "pet";
  entity_id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
};

export type CostCategory = "food" | "vet" | "insurance" | "vaccinations" | "other";

export type CostRow = {
  pet_id: string;
  date: string;
  category: CostCategory;
  label: string;
  amount: number;
  source: string;
  source_id: string;
};

/** Everything loaded for the selected dog. */
export type PetData = {
  vaccinations: Vaccination[];
  visits: VetVisit[];
  weights: Weight[];
  products: FoodProduct[];
  policies: Policy[];
  expenses: Expense[];
};
