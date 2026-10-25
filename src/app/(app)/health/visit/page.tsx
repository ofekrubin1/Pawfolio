"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { useAttachments } from "@/components/Attachments";
import { FormPage } from "@/components/FormPage";
import { Badge, Button, Card, ErrorText, Field, FormActions, Input, PageTitle, Sheet, Textarea } from "@/components/ui";
import { CLAIM_STATUSES } from "@/lib/constants";
import { num, str, todayISO, fmtMoney } from "@/lib/format";
import { activePolicy } from "@/lib/logic";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { deleteAttachmentsOf } from "@/lib/storage";

export default function VisitPage() {
  return <FormPage Form={VisitForm} />;
}

function VisitForm() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { pet, data, refresh } = useApp();
  const existing = id ? data.visits.find((v) => v.id === id) : null;
  const lastClinic = data.visits[0]?.clinic ?? pet?.vet_name ?? "";

  const f = useForm({
    date: existing?.date ?? todayISO(),
    clinic: s(existing ? existing.clinic : lastClinic),
    reason: s(existing?.reason),
    diagnosis: s(existing?.diagnosis),
    treatment: s(existing?.treatment),
    cost: s(existing?.cost),
    weight_kg: s(existing?.weight_kg),
  });
  const att = useAttachments("vet_visit", id, "קבלות ומסמכים");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [askClaim, setAskClaim] = useState<string | null>(null);

  const policy = activePolicy(data.policies);
  const claim = id ? data.policies.flatMap((p) => p.insurance_claims).find((c) => c.vet_visit_id === id) : null;

  if (id && !existing) return <p className="text-muted">הרשומה לא נמצאה</p>;

  const save = async () => {
    if (!f.values.date) return setError("צריך תאריך");
    setBusy(true);
    setError("");
    try {
      const weight = num(f.values.weight_kg);
      const newId = await saveRow("vet_visits", id, {
        pet_id: pet!.id,
        date: f.values.date,
        clinic: str(f.values.clinic),
        reason: f.values.reason.trim(),
        diagnosis: str(f.values.diagnosis),
        treatment: str(f.values.treatment),
        cost: num(f.values.cost),
        weight_kg: weight,
      });
      // A weight measured at the vet also goes into the weight history.
      if (weight) {
        await supabase()
          .from("weights")
          .upsert({ pet_id: pet!.id, date: f.values.date, kg: weight, vet_visit_id: newId }, { onConflict: "vet_visit_id" });
      } else {
        await supabase().from("weights").delete().eq("vet_visit_id", newId);
      }
      await att.save(newId);
      await refresh();
      if (!id && policy && (num(f.values.cost) ?? 0) > 0) {
        setAskClaim(newId);
        setBusy(false);
      } else router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm("למחוק את הביקור?")) return;
    await deleteAttachmentsOf("vet_visit", id);
    await deleteRow("vet_visits", id);
    await refresh();
    router.replace("/health");
  };

  return (
    <div>
      <PageTitle>{existing ? "ביקור וטרינר" : "ביקור וטרינר חדש"}</PageTitle>

      {existing && policy && (
        <Card className="mb-4 flex items-center justify-between gap-2 !py-3">
          {claim ? (
            <>
              <span className="flex items-center gap-2 text-sm">
                <FileText size={18} className="text-brand" />
                תביעה {fmtMoney(claim.amount_claimed)}
              </span>
              <Button variant="ghost" href={`/insurance/claim?id=${claim.id}`} className="!py-1">
                <Badge tone="blue">{CLAIM_STATUSES[claim.status]}</Badge>
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted">אין תביעה לביקור הזה</span>
              <Button variant="secondary" href={`/insurance/claim?visit=${id}`} className="!py-1.5 text-sm">
                צור תביעה מהביקור
              </Button>
            </>
          )}
        </Card>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך" required>
            <Input type="date" {...f.bind("date")} />
          </Field>
          <Field label="עלות (₪)">
            <Input type="number" {...f.bind("cost")} placeholder="0" />
          </Field>
        </div>
        <Field label="מרפאה">
          <Input {...f.bind("clinic")} />
        </Field>
        <Field label="סיבת הביקור">
          <Input {...f.bind("reason")} placeholder="למשל: צליעה, בדיקה שנתית" />
        </Field>
        <Field label="אבחנה">
          <Textarea {...f.bind("diagnosis")} />
        </Field>
        <Field label="טיפול / תרופות">
          <Textarea {...f.bind("treatment")} />
        </Field>
        <Field label='משקל (ק"ג)' hint="נשמר גם בגרף המשקל">
          <Input type="number" {...f.bind("weight_kg")} />
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

      <Sheet open={!!askClaim} onClose={() => router.back()} title="להגיש לביטוח?">
        <p className="mb-4 text-muted">
          תיפתח טיוטת תביעה ב{policy?.company} עם הסכום והקבלות של הביקור.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => router.replace(`/insurance/claim?visit=${askClaim}`)} className="flex-1">
            כן, פתח תביעה
          </Button>
          <Button variant="secondary" onClick={() => router.back()} className="flex-1">
            לא עכשיו
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
