"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { useAttachments } from "@/components/Attachments";
import { FormPage } from "@/components/FormPage";
import { Button, Card, Chips, ErrorText, Field, FormActions, Input, PageTitle, SectionTitle, Textarea } from "@/components/ui";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { fmtDate, fmtMoney, num, str, todayISO } from "@/lib/format";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import { deleteAttachmentsOf } from "@/lib/storage";
import type { ExpenseCategory } from "@/lib/types";

export default function ExpensePage() {
  return <FormPage Form={ExpenseForm} />;
}

function ExpenseForm() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { pet, data, refresh } = useApp();
  const existing = id ? data.expenses.find((e) => e.id === id) : null;
  const f = useForm({
    category: existing?.category ?? "grooming",
    amount: s(existing?.amount),
    date: existing?.date ?? todayISO(),
    note: s(existing?.note),
  });
  const att = useAttachments("expense", id, "קבלה");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (id && !existing) return <p className="text-muted">ההוצאה לא נמצאה</p>;

  const save = async () => {
    const amount = num(f.values.amount);
    if (amount === null) return setError("צריך סכום");
    setBusy(true);
    try {
      const newId = await saveRow("expenses", id, {
        pet_id: pet!.id,
        category: f.values.category,
        amount,
        date: f.values.date || todayISO(),
        note: str(f.values.note),
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
    if (!id || !confirm("למחוק את ההוצאה?")) return;
    await deleteAttachmentsOf("expense", id);
    await deleteRow("expenses", id);
    await refresh();
    router.back();
  };

  return (
    <div>
      <PageTitle>{existing ? "עריכת הוצאה" : "הוצאה חדשה"}</PageTitle>
      <div className="space-y-4">
        <Field label="קטגוריה" group>
          <Chips<ExpenseCategory>
            value={f.values.category as ExpenseCategory}
            onChange={(v) => f.set("category", v)}
            options={(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((k) => ({ value: k, label: EXPENSE_CATEGORIES[k] }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום (₪)" required>
            <Input type="number" {...f.bind("amount")} autoFocus={!existing} />
          </Field>
          <Field label="תאריך" required>
            <Input type="date" {...f.bind("date")} />
          </Field>
        </div>
        <Field label="הערה">
          <Textarea {...f.bind("note")} />
        </Field>
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

      {!existing && data.expenses.length > 0 && (
        <>
          <SectionTitle>הוצאות אחרונות</SectionTitle>
          <Card className="!p-2">
            {data.expenses.slice(0, 8).map((e) => (
              <Link key={e.id} href={`/expense?id=${e.id}`} className="flex justify-between rounded-lg px-2 py-2 text-sm active:bg-black/5">
                <span>
                  {EXPENSE_CATEGORIES[e.category]}
                  {e.note && <span className="text-muted"> · {e.note}</span>}
                  <span className="text-muted"> · {fmtDate(e.date)}</span>
                </span>
                <span className="font-medium">{fmtMoney(e.amount)}</span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
