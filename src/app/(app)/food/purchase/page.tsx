"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { useAttachments } from "@/components/Attachments";
import { FormPage } from "@/components/FormPage";
import { Button, ErrorText, Field, FormActions, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { num, str, todayISO } from "@/lib/format";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import { deleteAttachmentsOf } from "@/lib/storage";

export default function PurchasePage() {
  return <FormPage Form={PurchaseForm} />;
}

function PurchaseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { data, refresh } = useApp();
  const all = data.products.flatMap((p) => p.food_purchases);
  const existing = id ? all.find((p) => p.id === id) : null;
  const products = data.products.filter((p) => p.active || p.id === existing?.product_id);
  const productId = existing?.product_id ?? params.get("product") ?? products[0]?.id ?? "";
  const product = data.products.find((p) => p.id === productId);
  const lastOfProduct = product?.food_purchases.slice().sort((a, b) => b.date.localeCompare(a.date))[0];

  const f = useForm({
    product_id: productId,
    date: existing?.date ?? todayISO(),
    quantity: s(existing?.quantity ?? 1),
    price: s(existing?.price ?? lastOfProduct?.price),
    store: s(existing ? existing.store : (lastOfProduct?.store ?? product?.store)),
  });
  const att = useAttachments("food_purchase", id, "קבלה");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // No products yet: create one first, then come back here.
  const noProducts = data.products.length === 0;
  useEffect(() => {
    if (noProducts) router.replace("/food/product?then=purchase");
  }, [noProducts, router]);
  if (noProducts) return <Spinner />;
  if (id && !existing) return <p className="text-muted">הרכישה לא נמצאה</p>;

  const save = async () => {
    const price = num(f.values.price);
    if (!f.values.product_id) return setError("בחרו מוצר");
    if (price === null) return setError("צריך סכום");
    setBusy(true);
    try {
      const newId = await saveRow("food_purchases", id, {
        product_id: f.values.product_id,
        date: f.values.date || todayISO(),
        quantity: num(f.values.quantity) || 1,
        price,
        store: str(f.values.store),
      });
      await att.save(newId);
      await refresh();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm("למחוק את הרכישה?")) return;
    await deleteAttachmentsOf("food_purchase", id);
    await deleteRow("food_purchases", id);
    await refresh();
    router.replace("/food");
  };

  return (
    <div>
      <PageTitle>{existing ? "עריכת רכישה" : "קניית אוכל"}</PageTitle>
      <div className="space-y-4">
        <Field label="מוצר" required>
          <Select {...f.bind("product_id")}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום (₪)" required>
            <Input type="number" {...f.bind("price")} autoFocus={!existing} />
          </Field>
          <Field label="כמות (שקים / יח׳)">
            <Input type="number" {...f.bind("quantity")} />
          </Field>
        </div>
        <Field label="תאריך" required>
          <Input type="date" {...f.bind("date")} />
        </Field>
        <Field label="חנות">
          <Input {...f.bind("store")} />
        </Field>
        <Button variant="ghost" href={`/food/product?then=purchase`} className="!px-0 text-sm">
          + מוצר חדש
        </Button>
        {att.ui}
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
