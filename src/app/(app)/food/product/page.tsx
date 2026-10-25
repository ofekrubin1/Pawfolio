"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { FormPage } from "@/components/FormPage";
import { Button, Chips, ErrorText, Field, FormActions, Input, PageTitle, Toggle } from "@/components/ui";
import { FOOD_KINDS } from "@/lib/constants";
import { num, str } from "@/lib/format";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import type { FoodKind } from "@/lib/types";

export default function ProductPage() {
  return <FormPage Form={ProductForm} />;
}

function ProductForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const then = params.get("then"); // "purchase" when we came from adding a purchase with no products yet
  const { pet, data, refresh } = useApp();
  const existing = id ? data.products.find((p) => p.id === id) : null;
  const f = useForm({
    brand: s(existing?.brand),
    kind: existing?.kind ?? "dry",
    bag_kg: s(existing?.bag_kg),
    daily_grams: s(existing?.daily_grams),
    store: s(existing?.store),
  });
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (id && !existing) return <p className="text-muted">המוצר לא נמצא</p>;

  const save = async () => {
    if (!f.values.brand.trim()) return setError("צריך שם / מותג");
    setBusy(true);
    try {
      const newId = await saveRow("food_products", id, {
        pet_id: pet!.id,
        brand: f.values.brand.trim(),
        kind: f.values.kind,
        bag_kg: num(f.values.bag_kg),
        daily_grams: num(f.values.daily_grams),
        store: str(f.values.store),
        active,
      });
      await refresh();
      if (then === "purchase") router.replace(`/food/purchase?product=${newId}`);
      else router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm("למחוק את המוצר וכל הרכישות שלו? (כדי לשמור היסטוריה, עדיף לסמן 'לא בשימוש')")) return;
    await deleteRow("food_products", id);
    await refresh();
    router.replace("/food");
  };

  return (
    <div>
      <PageTitle>{existing ? "עריכת מוצר" : "מוצר חדש"}</PageTitle>
      <div className="space-y-4">
        <Field label="מותג / שם" required>
          <Input {...f.bind("brand")} placeholder="למשל: Royal Canin Medium Adult" autoFocus={!existing} />
        </Field>
        <Field label="סוג" group>
          <Chips<FoodKind>
            value={f.values.kind as FoodKind}
            onChange={(v) => f.set("kind", v)}
            options={(Object.keys(FOOD_KINDS) as FoodKind[]).map((k) => ({ value: k, label: FOOD_KINDS[k] }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label='משקל שק (ק"ג)'>
            <Input type="number" {...f.bind("bag_kg")} placeholder="12" />
          </Field>
          <Field label="מנה יומית (גרם)">
            <Input type="number" {...f.bind("daily_grams")} placeholder="250" />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">שני השדות האלה מאפשרים לחשב מתי האוכל ייגמר ולשלוח תזכורת 5 ימים לפני.</p>
        <Field label="איפה קונים">
          <Input {...f.bind("store")} />
        </Field>
        {existing && <Toggle checked={active} onChange={setActive} label="בשימוש כרגע" />}
        <ErrorText>{error}</ErrorText>
      </div>
      <FormActions>
        <Button onClick={save} disabled={busy} className="flex-1">
          שמירה
        </Button>
        {existing && (
          <Button variant="danger" onClick={remove}>
            מחיקה
          </Button>
        )}
      </FormActions>
    </div>
  );
}
