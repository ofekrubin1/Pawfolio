"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { useAttachments } from "@/components/Attachments";
import { FormPage } from "@/components/FormPage";
import { Button, ErrorText, Field, FormActions, Input, PageTitle } from "@/components/ui";
import { addYears, num, str, todayISO } from "@/lib/format";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import { deleteAttachmentsOf } from "@/lib/storage";

export default function PolicyPage() {
  return <FormPage Form={PolicyForm} />;
}

function PolicyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const renewFrom = params.get("renew");
  const { pet, data, refresh } = useApp();
  const existing = id ? data.policies.find((p) => p.id === id) : null;
  const base = existing ?? (renewFrom ? data.policies.find((p) => p.id === renewFrom) : null);
  // Renewing copies the old policy, starting where it ended.
  const start = existing?.start_date ?? (renewFrom && base ? (base.renewal_date ?? addYears(base.start_date, 1)) : todayISO());

  const f = useForm({
    company: s(base?.company),
    policy_no: s(base?.policy_no),
    coverage_type: s(base?.coverage_type),
    yearly_premium: s(base?.yearly_premium),
    deductible: s(base?.deductible),
    coverage_cap: s(base?.coverage_cap),
    start_date: start,
    renewal_date: existing?.renewal_date ?? addYears(start, 1),
  });
  const att = useAttachments("policy", id, "צילום הפוליסה");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (id && !existing) return <p className="text-muted">הפוליסה לא נמצאה</p>;

  const save = async () => {
    if (!f.values.company.trim()) return setError("צריך שם חברה");
    if (!f.values.start_date) return setError("צריך תאריך התחלה");
    setBusy(true);
    try {
      const newId = await saveRow("insurance_policies", id, {
        pet_id: pet!.id,
        company: f.values.company.trim(),
        policy_no: str(f.values.policy_no),
        coverage_type: str(f.values.coverage_type),
        yearly_premium: num(f.values.yearly_premium) ?? 0,
        deductible: num(f.values.deductible),
        coverage_cap: num(f.values.coverage_cap),
        start_date: f.values.start_date,
        renewal_date: f.values.renewal_date || null,
      });
      await att.save(newId);
      await refresh();
      router.replace("/insurance");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm("למחוק את הפוליסה וכל התביעות שלה?")) return;
    await deleteAttachmentsOf("policy", id);
    await deleteRow("insurance_policies", id);
    await refresh();
    router.replace("/insurance");
  };

  return (
    <div>
      <PageTitle>{existing ? "פוליסה" : renewFrom ? "חידוש פוליסה" : "פוליסה חדשה"}</PageTitle>
      <div className="space-y-4">
        <Field label="חברת ביטוח" required>
          <Input {...f.bind("company")} autoFocus={!base} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מספר פוליסה">
            <Input {...f.bind("policy_no")} dir="ltr" />
          </Field>
          <Field label="פרמיה שנתית (₪)" required>
            <Input type="number" {...f.bind("yearly_premium")} />
          </Field>
        </div>
        <Field label="סוג כיסוי">
          <Input {...f.bind("coverage_type")} placeholder="למשל: מקיף, תאונות ומחלות" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="השתתפות עצמית (₪)">
            <Input type="number" {...f.bind("deductible")} />
          </Field>
          <Field label="תקרת כיסוי (₪)">
            <Input type="number" {...f.bind("coverage_cap")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך התחלה" required hint="הפרמיה נספרת בעלויות בתאריך הזה">
            <Input
              type="date"
              value={f.values.start_date}
              onChange={(e) => {
                f.set("start_date", e.target.value);
                if (e.target.value && !existing) f.set("renewal_date", addYears(e.target.value, 1));
              }}
            />
          </Field>
          <Field label="תאריך חידוש" hint="תזכורת 30 יום לפני">
            <Input type="date" {...f.bind("renewal_date")} />
          </Field>
        </div>
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
