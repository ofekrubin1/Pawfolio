"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { LineChart } from "@/components/LineChart";
import { Button, Card, Empty, ErrorText, Field, Input, PageTitle, SectionTitle, Spinner } from "@/components/ui";
import { fmtDate, num, todayISO } from "@/lib/format";
import { deleteRow, saveRow } from "@/lib/db";

export default function WeightPage() {
  const { bfcacheId } = useRouter();
  return <WeightPageInner key={bfcacheId} />;
}

function WeightPageInner() {
  const { pet, data, dataLoading, refresh } = useApp();
  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (dataLoading) return <Spinner />;
  const weights = data.weights;

  const add = async () => {
    const v = num(kg);
    if (!v || v <= 0) return setError('הזינו משקל בק"ג');
    setBusy(true);
    setError("");
    try {
      await saveRow("weights", null, { pet_id: pet!.id, date, kg: v });
      setKg("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div>
      <PageTitle>משקל</PageTitle>
      <Card>
        {weights.length ? (
          <LineChart points={weights.map((w) => ({ date: w.date, value: Number(w.kg) }))} unit='ק"ג' />
        ) : (
          <p className="py-6 text-center text-muted">הגרף יופיע אחרי השקילה הראשונה</p>
        )}
      </Card>

      <SectionTitle>שקילה חדשה</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label='משקל (ק"ג)'>
            <Input type="number" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="12.5" />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button onClick={add} disabled={busy} className="w-full">
          הוספה
        </Button>
      </Card>

      <SectionTitle>היסטוריה</SectionTitle>
      {weights.length === 0 ? (
        <Empty>אין שקילות עדיין</Empty>
      ) : (
        <Card className="!p-2">
          {[...weights].reverse().map((w) => (
            <div key={w.id} className="flex items-center justify-between px-2 py-2">
              <span>{fmtDate(w.date)}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold">{w.kg} ק&quot;ג</span>
                {w.vet_visit_id ? (
                  <span className="text-xs text-muted">מביקור</span>
                ) : (
                  <button
                    aria-label="מחיקה"
                    className="text-muted"
                    onClick={async () => {
                      if (!confirm("למחוק את השקילה?")) return;
                      await deleteRow("weights", w.id);
                      refresh();
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
