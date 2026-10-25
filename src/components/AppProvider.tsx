"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Household, Member, Pet, PetData } from "@/lib/types";
import { Spinner } from "./ui";

type Ctx = {
  user: User;
  me: Member;
  household: Household;
  members: Member[];
  pets: Pet[];
  pet: Pet | null;
  selectPet: (id: string) => void;
  data: PetData;
  dataLoading: boolean;
  /** Reload the selected dog's records after a change. */
  refresh: () => Promise<void>;
  /** Reload family, members and dogs. */
  refreshFamily: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

const EMPTY: PetData = { vaccinations: [], visits: [], weights: [], products: [], policies: [], expenses: [] };
const PET_KEY = "pawfolio.pet";

function readStoredPet() {
  try {
    return localStorage.getItem(PET_KEY);
  } catch {
    return null;
  }
}

export async function loadPetData(petId: string): Promise<PetData> {
  const db = supabase();
  const [vaccinations, visits, weights, products, policies, expenses] = await Promise.all([
    db.from("vaccinations").select("*").eq("pet_id", petId).order("given_on", { ascending: false }),
    db.from("vet_visits").select("*").eq("pet_id", petId).order("date", { ascending: false }),
    db.from("weights").select("*").eq("pet_id", petId).order("date"),
    db.from("food_products").select("*, food_purchases(*)").eq("pet_id", petId).order("created_at"),
    db.from("insurance_policies").select("*, insurance_claims(*)").eq("pet_id", petId).order("start_date", { ascending: false }),
    db.from("expenses").select("*").eq("pet_id", petId).order("date", { ascending: false }),
  ]);
  return {
    vaccinations: vaccinations.data ?? [],
    visits: visits.data ?? [],
    weights: weights.data ?? [],
    products: products.data ?? [],
    policies: policies.data ?? [],
    expenses: expenses.data ?? [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<{ user: User; me: Member; household: Household; members: Member[]; pets: Pet[] } | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [data, setData] = useState<PetData>(EMPTY);
  const [dataLoading, setDataLoading] = useState(true);

  const loadFamily = useCallback(async () => {
    const db = supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    const { data: me } = await db.from("household_members").select("*").eq("user_id", user.id).maybeSingle();
    if (!me) {
      router.replace("/onboarding");
      return;
    }
    const [{ data: household }, { data: members }, { data: pets }] = await Promise.all([
      db.from("households").select("*").eq("id", me.household_id).single(),
      db.from("household_members").select("*").eq("household_id", me.household_id).order("joined_at"),
      db.from("pets").select("*").eq("household_id", me.household_id).order("created_at"),
    ]);
    if (!household) return;
    setState({ user, me, household, members: members ?? [], pets: pets ?? [] });
    setPetId((cur) => {
      const list = pets ?? [];
      const wanted = cur ?? readStoredPet();
      return list.find((p: Pet) => p.id === wanted)?.id ?? list[0]?.id ?? null;
    });
  }, [router]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const refresh = useCallback(async () => {
    if (!petId) {
      setData(EMPTY);
      setDataLoading(false);
      return;
    }
    setData(await loadPetData(petId));
    setDataLoading(false);
  }, [petId]);

  useEffect(() => {
    setDataLoading(true);
    refresh();
  }, [refresh]);

  // A family with no dog yet goes straight to adding one.
  useEffect(() => {
    if (state && state.pets.length === 0 && path !== "/more/pet") router.replace("/more/pet?new=1&first=1");
  }, [state, path, router]);

  const selectPet = useCallback((id: string) => {
    setPetId(id);
    try {
      localStorage.setItem(PET_KEY, id);
    } catch {}
  }, []);

  const value = useMemo<Ctx | null>(
    () =>
      state && {
        ...state,
        pet: state.pets.find((p) => p.id === petId) ?? null,
        selectPet,
        data,
        dataLoading,
        refresh,
        refreshFamily: loadFamily,
      },
    [state, petId, selectPet, data, dataLoading, refresh, loadFamily],
  );

  if (!value) return <Spinner />;
  return <AppContext value={value}>{children}</AppContext>;
}
