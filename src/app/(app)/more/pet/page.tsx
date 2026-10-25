"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Phone } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { PetAvatar } from "@/components/PetAvatar";
import { Button, Card, Chips, ErrorText, Field, FormActions, Input, PageTitle, SectionTitle, Spinner, Textarea } from "@/components/ui";
import { ageText, str } from "@/lib/format";
import { s, useForm } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { BUCKET, uploadFile } from "@/lib/storage";

export default function PetPage() {
  const params = useSearchParams();
  const { bfcacheId } = useRouter();
  const { pet } = useApp();
  const isNew = params.get("new") === "1";
  if (!isNew && !pet) return <Spinner />;
  return <PetForm key={`${bfcacheId}:${isNew ? "new" : pet!.id}`} isNew={isNew} first={params.get("first") === "1"} />;
}

function PetForm({ isNew, first }: { isNew: boolean; first: boolean }) {
  const router = useRouter();
  const { pet: current, household, pets, selectPet, refreshFamily } = useApp();
  const pet = isNew ? null : current;
  const f = useForm({
    name: s(pet?.name),
    breed: s(pet?.breed),
    birth_date: s(pet?.birth_date),
    sex: s(pet?.sex),
    neutered: pet?.neutered === null || pet?.neutered === undefined ? "" : pet.neutered ? "yes" : "no",
    chip_number: s(pet?.chip_number),
    license_number: s(pet?.license_number),
    license_renewal: s(pet?.license_renewal),
    allergies: s(pet?.allergies),
    conditions: s(pet?.conditions),
    medications: s(pet?.medications),
    vet_name: s(pet?.vet_name),
    vet_phone: s(pet?.vet_phone),
    vet_address: s(pet?.vet_address),
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return;
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const save = async () => {
    if (!f.values.name.trim()) return setError("צריך שם");
    setBusy(true);
    setError("");
    const v = f.values;
    const payload: Record<string, unknown> = {
      household_id: household.id,
      name: v.name.trim(),
      breed: str(v.breed),
      birth_date: v.birth_date || null,
      sex: v.sex || null,
      neutered: v.neutered === "" ? null : v.neutered === "yes",
      chip_number: str(v.chip_number),
      license_number: str(v.license_number),
      license_renewal: v.license_renewal || null,
      allergies: str(v.allergies),
      conditions: str(v.conditions),
      medications: str(v.medications),
      vet_name: str(v.vet_name),
      vet_phone: str(v.vet_phone),
      vet_address: str(v.vet_address),
    };
    try {
      if (photo) {
        const { path } = await uploadFile(household.id, photo, "pets");
        payload.photo_path = path;
        if (pet?.photo_path) await supabase().storage.from(BUCKET).remove([pet.photo_path]);
      }
      const db = supabase();
      const res = pet
        ? await db.from("pets").update(payload).eq("id", pet.id).select("id").single()
        : await db.from("pets").insert(payload).select("id").single();
      if (res.error) throw new Error(res.error.message);
      await refreshFamily();
      if (!pet) {
        selectPet(res.data.id);
        router.replace("/health/initial");
      } else router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pet || prompt(`כדי למחוק את ${pet.name} ואת כל המידע שלו, הקלידו את השם:`) !== pet.name) return;
    await supabase().from("pets").delete().eq("id", pet.id);
    const next = pets.find((p) => p.id !== pet.id);
    if (next) selectPet(next.id);
    await refreshFamily();
    router.replace("/");
  };

  return (
    <div>
      <PageTitle>{first ? "בואו נכיר את הכלב" : isNew ? "כלב חדש" : "פרופיל הכלב"}</PageTitle>

      <div className="mb-5 flex flex-col items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-28 w-28 rounded-full object-cover" />
          ) : (
            <PetAvatar path={pet?.photo_path} size={112} />
          )}
          <span className="absolute bottom-0 left-0 rounded-full bg-brand p-2 text-white shadow">
            <Camera size={16} />
          </span>
        </button>
        {f.values.birth_date && <span className="text-sm text-muted">גיל: {ageText(f.values.birth_date)}</span>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </div>

      <div className="space-y-4">
        <Field label="שם" required>
          <Input {...f.bind("name")} autoFocus={isNew} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="גזע">
            <Input {...f.bind("breed")} />
          </Field>
          <Field label="תאריך לידה">
            <Input type="date" {...f.bind("birth_date")} />
          </Field>
        </div>
        <Field label="מין" group>
          <Chips value={f.values.sex} onChange={(v) => f.set("sex", v)} options={[{ value: "female", label: "נקבה" }, { value: "male", label: "זכר" }]} />
        </Field>
        <Field label="מעוקר/ת" group>
          <Chips value={f.values.neutered} onChange={(v) => f.set("neutered", v)} options={[{ value: "yes", label: "כן" }, { value: "no", label: "לא" }]} />
        </Field>

        <SectionTitle>רישום</SectionTitle>
        <Field label="מספר שבב">
          <Input {...f.bind("chip_number")} dir="ltr" inputMode="numeric" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מספר רישיון עירוני">
            <Input {...f.bind("license_number")} dir="ltr" />
          </Field>
          <Field label="חידוש רישיון">
            <Input type="date" {...f.bind("license_renewal")} />
          </Field>
        </div>

        <SectionTitle>בריאות</SectionTitle>
        <Field label="אלרגיות">
          <Textarea {...f.bind("allergies")} />
        </Field>
        <Field label="מחלות כרוניות">
          <Textarea {...f.bind("conditions")} />
        </Field>
        <Field label="תרופות קבועות">
          <Textarea {...f.bind("medications")} />
        </Field>

        <SectionTitle>וטרינר קבוע</SectionTitle>
        <Field label="שם">
          <Input {...f.bind("vet_name")} />
        </Field>
        <Field label="טלפון">
          <div className="flex gap-2">
            <Input type="tel" {...f.bind("vet_phone")} />
            {f.values.vet_phone && (
              <Button href={`tel:${f.values.vet_phone}`} variant="secondary" className="shrink-0">
                <Phone size={18} />
              </Button>
            )}
          </div>
        </Field>
        <Field label="כתובת">
          <Input {...f.bind("vet_address")} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>

      <FormActions>
        <Button onClick={save} disabled={busy} className="flex-1">
          {isNew ? "המשך" : "שמירה"}
        </Button>
      </FormActions>

      {pet && (
        <Card className="mt-6 !bg-transparent !shadow-none !ring-0 text-center">
          <Button variant="danger" onClick={remove}>
            מחיקת הכלב
          </Button>
        </Card>
      )}
    </div>
  );
}
