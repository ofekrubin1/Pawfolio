"use client";

import { useCallback, useState } from "react";
import { supabase } from "./supabase/client";

/** Inserts when id is null, otherwise updates. Returns the row id. */
export async function saveRow(table: string, id: string | null, payload: Record<string, unknown>): Promise<string> {
  const db = supabase();
  const q = id ? db.from(table).update(payload).eq("id", id) : db.from(table).insert(payload);
  const { data, error } = await q.select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteRow(table: string, id: string) {
  const { error } = await supabase().from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Simple string-valued form state; inputs stay strings and are converted on save. */
export function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const bind = (key: keyof T) => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  const set = useCallback((key: keyof T, value: string) => setValues((v) => ({ ...v, [key]: value })), []);
  return { values, setValues, bind, set };
}

export function s(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}
