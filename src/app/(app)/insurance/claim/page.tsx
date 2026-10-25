"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { AttachmentList, useAttachments } from "@/components/Attachments";
import { FormPage } from "@/components/FormPage";
import { Button, Chips, ErrorText, Field, FormActions, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import { CLAIM_STATUSES } from "@/lib/constants";
import { fmtDate, fmtMoney, num, str, todayISO } from "@/lib/format";
import { activePolicy } from "@/lib/logic";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import { deleteAttachmentsOf } from "@/lib/storage";
import type { ClaimStatus } from "@/lib/types";

export default function ClaimPage() {
  return <FormPage Form={ClaimForm} />;
}

function ClaimForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { data, refresh } = useApp();
  const existing = id ? data.policies.flatMap((p) => p.insurance_claims).find((c) => c.id === id) : null;
  const visitParam = params.get("visit");
  const visit = data.visits.find((v) => v.id === (existing?.vet_visit_id ?? visitParam));
  const policy = activePolicy(data.policies);

  const f = useForm({
    policy_id: existing?.policy_id ?? policy?.id ?? "",
    vet_visit_id: existing?.vet_visit_id ?? visitParam ?? "",
    amount_claimed: s(existing?.amount_claimed ?? visit?.cost),
    submitted_on: s(existing?.submitted_on),
    status: existing?.status ?? "draft",
    amount_paid: s(existing?.amount_paid),
    paid_on: s(existing?.paid_on),
    rejection_reason: s(existing?.rejection_reason),
    notes: s(existing?.notes),
  });
  const att = useAttachments("claim", id, "מסמכים נוספים");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const noPolicy = data.policies.length === 0;
  useEffect(() => {
    if (noPolicy) router.replace("/insurance/policy");
  }, [noPolicy, router]);
  if (noPolicy) return <Spinner />;
  if (id && !existing) return <p className="text-muted">התביעה לא נמצאה</p>;

  const linkedVisit = data.visits.find((v) => v.id === f.values.vet_visit_id);
  const status = f.values.status as ClaimStatus;

  const setStatus = (st: ClaimStatus) => {
    f.set("status", st);
    if (st !== "draft" && !f.values.submitted_on) f.set("submitted_on", todayISO());
    if (st === "paid" && !f.values.paid_on) f.set("paid_on", todayISO());
    if (st === "paid" && !f.values.amount_paid) f.set("amount_paid", f.values.amount_claimed);
  };

  const save = async () => {
    if (!f.values.policy_id) return setError("בחרו פוליסה");
    setBusy(true);
    try {
      const newId = await saveRow("insurance_claims", id, {
        policy_id: f.values.policy_id,
        vet_visit_id: f.values.vet_visit_id || null,
        amount_claimed: num(f.values.amount_claimed) ?? 0,
        submitted_on: f.values.submitted_on || null,
        status,
        amount_paid: num(f.values.amount_paid),
        paid_on: f.values.paid_on || null,
        rejection_reason: str(f.values.rejection_reason),
        notes: str(f.values.notes),
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
    if (!id || !confirm("למחוק את התביעה?")) return;
    await deleteAttachmentsOf("claim", id);
    await deleteRow("insurance_claims", id);
    await refresh();
    router.replace("/insurance");
  };

  const showResult = ["approved", "partial", "paid", "rejected"].includes(status);

  return (
    <div>
      <PageTitle>{existing ? "תביעה" : "תביעה חדשה"}</PageTitle>
      <div className="space-y-4">
        <Field label="סטטוס" group>
          <Chips<ClaimStatus>
            value={status}
            onChange={setStatus}
            options={(Object.keys(CLAIM_STATUSES) as ClaimStatus[]).map((k) => ({ value: k, label: CLAIM_STATUSES[k] }))}
          />
        </Field>

        <Field label="ביקור וטרינר" hint="הסכום והקבלות של הביקור נמשכים לתביעה">
          <Select
            value={f.values.vet_visit_id}
            onChange={(e) => {
              f.set("vet_visit_id", e.target.value);
              const v = data.visits.find((x) => x.id === e.target.value);
              if (v?.cost && !f.values.amount_claimed) f.set("amount_claimed", String(v.cost));
            }}
          >
            <option value="">ללא</option>
            {data.visits.map((v) => (
              <option key={v.id} value={v.id}>
                {fmtDate(v.date)} · {v.reason || v.clinic || "ביקור"} {v.cost ? `· ${fmtMoney(v.cost)}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {linkedVisit && <AttachmentList entityType="vet_visit" entityId={linkedVisit.id} />}

        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום שנתבע (₪)" required>
            <Input type="number" {...f.bind("amount_claimed")} />
          </Field>
          <Field label="תאריך הגשה">
            <Input type="date" {...f.bind("submitted_on")} />
          </Field>
        </div>

        {showResult && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="סכום שהתקבל (₪)">
              <Input type="number" {...f.bind("amount_paid")} />
            </Field>
            <Field label="תאריך תשלום">
              <Input type="date" {...f.bind("paid_on")} />
            </Field>
          </div>
        )}
        {(status === "rejected" || status === "partial") && (
          <Field label={status === "rejected" ? "סיבת דחייה" : "מה לא אושר"}>
            <Textarea {...f.bind("rejection_reason")} />
          </Field>
        )}

        {data.policies.length > 1 && (
          <Field label="פוליסה">
            <Select {...f.bind("policy_id")}>
              {data.policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company} · {fmtDate(p.start_date)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="הערות">
          <Textarea {...f.bind("notes")} />
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
    </div>
  );
}
