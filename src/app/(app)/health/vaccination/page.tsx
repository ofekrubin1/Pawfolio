"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { useAttachments } from "@/components/Attachments";
import { FormPage } from "@/components/FormPage";
import Link from "next/link";
import { Button, Card, Chips, ErrorText, Field, FormActions, Input, PageTitle, SectionTitle, Textarea } from "@/components/ui";
import { VACCINE_TYPES, defaultIntervalDays } from "@/lib/constants";
import { addDays, fmtDate, fmtMoney, num, str, todayISO } from "@/lib/format";
import { deleteRow, s, saveRow, useForm } from "@/lib/db";
import { deleteAttachmentsOf } from "@/lib/storage";

const OTHER = "__other";

export default function VaccinationPage() {
  return <FormPage Form={VaccinationForm} />;
}

function VaccinationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const presetType = params.get("type");
  const { pet, data, refresh } = useApp();
  const existing = id ? data.vaccinations.find((v) => v.id === id) : null;

  const initialType = existing?.type ?? presetType ?? VACCINE_TYPES[0].name;
  const isPreset = VACCINE_TYPES.some((t) => t.name === initialType);
  const f = useForm({
    choice: isPreset ? initialType : OTHER,
    custom: isPreset ? "" : initialType,
    given_on: existing?.given_on ?? todayISO(),
    next_due: existing?.next_due ?? addDays(todayISO(), defaultIntervalDays(initialType)),
    given_by: s(existing?.given_by ?? data.vaccinations.find((v) => v.type === initialType)?.given_by ?? pet?.vet_name),
    cost: s(existing?.cost),
    notes: s(existing?.notes),
  });
  const type = f.values.choice === OTHER ? f.values.custom.trim() : f.values.choice;
  const nextTouched = useRef(!!existing);
  const att = useAttachments("vaccination", id, "צילום מדבקה מהפנקס");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Next due date follows the type's default interval until the user edits it.
  const { set } = f;
  useEffect(() => {
    if (nextTouched.current || !f.values.given_on) return;
    set("next_due", addDays(f.values.given_on, defaultIntervalDays(type)));
  }, [type, f.values.given_on, set]);

  if (id && !existing) return <p className="text-muted">הרשומה לא נמצאה</p>;

  const save = async () => {
    if (!type) return setError("בחרו סוג");
    if (!f.values.given_on) return setError("צריך תאריך");
    setBusy(true);
    setError("");
    try {
      const newId = await saveRow("vaccinations", id, {
        pet_id: pet!.id,
        type,
        given_on: f.values.given_on,
        next_due: f.values.next_due || null,
        given_by: str(f.values.given_by),
        cost: num(f.values.cost),
        notes: str(f.values.notes),
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
    if (!id || !confirm("למחוק את הרשומה?")) return;
    await deleteAttachmentsOf("vaccination", id);
    await deleteRow("vaccinations", id);
    await refresh();
    router.replace("/health");
  };

  const history = data.vaccinations.filter((v) => v.type === type && v.id !== id);

  return (
    <div>
      <PageTitle>{existing ? "עריכת חיסון / טיפול" : "חיסון / טיפול חדש"}</PageTitle>
      <div className="space-y-4">
        <Field label="סוג" required group>
          <Chips
            value={f.values.choice}
            onChange={(v) => f.set("choice", v)}
            options={[...VACCINE_TYPES.map((t) => ({ value: t.name, label: t.name })), { value: OTHER, label: "אחר" }]}
          />
        </Field>
        {f.values.choice === OTHER && (
          <Field label="שם הטיפול" required>
            <Input {...f.bind("custom")} autoFocus placeholder="למשל: לישמניה" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך" required>
            <Input type="date" {...f.bind("given_on")} />
          </Field>
          <Field label="מחיר (₪)">
            <Input type="number" {...f.bind("cost")} placeholder="0" />
          </Field>
        </div>
        <Field label="המועד הבא" hint={`ברירת מחדל: ${defaultIntervalDays(type)} ימים`}>
          <Input
            type="date"
            value={f.values.next_due}
            onChange={(e) => {
              nextTouched.current = true;
              f.set("next_due", e.target.value);
            }}
          />
        </Field>
        <Field label="מי נתן">
          <Input {...f.bind("given_by")} placeholder="וטרינר / בבית" />
        </Field>
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

      {history.length > 0 && (
        <>
          <SectionTitle>היסטוריה – {type}</SectionTitle>
          <Card className="!p-2">
            {history.map((v) => (
              <Link key={v.id} href={`/health/vaccination?id=${v.id}`} className="flex justify-between rounded-lg px-2 py-2 text-sm active:bg-black/5">
                <span>{fmtDate(v.given_on)}</span>
                <span className="text-muted">{[v.given_by, v.cost ? fmtMoney(v.cost) : ""].filter(Boolean).join(" · ")}</span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
