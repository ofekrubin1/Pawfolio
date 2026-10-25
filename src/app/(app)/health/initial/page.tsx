"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Button, Card, ErrorText, FormActions, Input, PageTitle } from "@/components/ui";
import { VACCINE_TYPES } from "@/lib/constants";
import { addDays } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

/** First-time setup: the last date of each vaccine type, so reminders work from day one. */
export default function InitialVaccinesPage() {
  const { bfcacheId } = useRouter();
  return <InitialVaccinesPageInner key={bfcacheId} />;
}

function InitialVaccinesPageInner() {
  const router = useRouter();
  const { pet, refresh } = useApp();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const rows = VACCINE_TYPES.filter((t) => dates[t.name]).map((t) => ({
      pet_id: pet!.id,
      type: t.name,
      given_on: dates[t.name],
      next_due: addDays(dates[t.name], t.days),
    }));
    if (rows.length) {
      setBusy(true);
      const { error } = await supabase().from("vaccinations").insert(rows);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      await refresh();
    }
    router.replace("/");
  };

  return (
    <div>
      <PageTitle>מתי {pet?.name} קיבל/ה לאחרונה?</PageTitle>
      <p className="mb-4 text-sm text-muted">
        מלאו את מה שידוע (אפשר להעתיק מהפנקס). המועד הבא יחושב אוטומטית ותקבלו תזכורת. אפשר לדלג ולהוסיף אחר כך.
      </p>
      <Card className="space-y-3">
        {VACCINE_TYPES.map((t) => (
          <div key={t.name} className="flex items-center justify-between gap-3">
            <span className="font-medium">{t.name}</span>
            <Input
              type="date"
              value={dates[t.name] ?? ""}
              onChange={(e) => setDates((d) => ({ ...d, [t.name]: e.target.value }))}
              className="!w-44"
            />
          </div>
        ))}
      </Card>
      <ErrorText>{error}</ErrorText>
      <FormActions>
        <Button onClick={save} disabled={busy} className="flex-1">
          שמירה
        </Button>
        <Button variant="ghost" onClick={() => router.replace("/")}>
          דילוג
        </Button>
      </FormActions>
    </div>
  );
}
