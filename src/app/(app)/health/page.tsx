"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Scale, Stethoscope, Syringe } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Chips, Empty, PageTitle, SectionTitle, Spinner } from "@/components/ui";
import { latestPerType, vaxStatus, VAX_STATUS_LABEL } from "@/lib/logic";
import { fmtDate, fmtMoney } from "@/lib/format";
import { VACCINE_TYPES } from "@/lib/constants";

type Filter = "all" | "vaccines" | "visits" | "weight";

const STATUS_TONE = { ok: "green", soon: "amber", overdue: "red", none: "gray" } as const;

export default function HealthPage() {
  const { data, dataLoading } = useApp();
  const [filter, setFilter] = useState<Filter>("all");

  const latest = useMemo(() => latestPerType(data.vaccinations), [data.vaccinations]);
  const missing = VACCINE_TYPES.filter((t) => !latest.some((v) => v.type === t.name));

  const timeline = useMemo(() => {
    const rows: { key: string; date: string; kind: Filter; title: string; sub: string; href: string; amount?: number | null }[] = [];
    if (filter === "all" || filter === "vaccines")
      data.vaccinations.forEach((v) =>
        rows.push({ key: "v" + v.id, date: v.given_on, kind: "vaccines", title: v.type, sub: v.given_by ?? "", href: `/health/vaccination?id=${v.id}`, amount: v.cost }),
      );
    if (filter === "all" || filter === "visits")
      data.visits.forEach((v) =>
        rows.push({
          key: "b" + v.id,
          date: v.date,
          kind: "visits",
          title: v.reason || "ביקור וטרינר",
          sub: [v.clinic, v.diagnosis].filter(Boolean).join(" · "),
          href: `/health/visit?id=${v.id}`,
          amount: v.cost,
        }),
      );
    if (filter === "all" || filter === "weight")
      data.weights
        .filter((w) => filter === "weight" || !w.vet_visit_id) // in "all", visit weights already show on the visit
        .forEach((w) => rows.push({ key: "w" + w.id, date: w.date, kind: "weight", title: `${w.kg} ק"ג`, sub: "שקילה", href: "/health/weight" }));
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [data, filter]);

  if (dataLoading) return <Spinner />;

  const Icon = { vaccines: Syringe, visits: Stethoscope, weight: Scale, all: Syringe };

  return (
    <div>
      <PageTitle action={<Button variant="secondary" href="/health/visit"><Plus size={18} />ביקור</Button>}>בריאות</PageTitle>

      <SectionTitle action={<Button variant="ghost" href="/health/vaccination" className="!p-0 text-sm"><Plus size={16} />חיסון / טיפול</Button>}>
        חיסונים וטיפולים מונעים
      </SectionTitle>
      {latest.length === 0 ? (
        <Empty action={<Button href="/health/initial">הוספת החיסונים האחרונים</Button>}>עוד לא הוזנו חיסונים</Empty>
      ) : (
        <Card className="!p-2">
          {latest.map((v) => {
            const st = vaxStatus(v.next_due);
            return (
              <Link key={v.id} href={`/health/vaccination?type=${encodeURIComponent(v.type)}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 active:bg-black/5">
                <span>
                  <span className="block font-semibold">{v.type}</span>
                  <span className="text-xs text-muted">
                    ניתן {fmtDate(v.given_on)}
                    {v.next_due && ` · הבא ${fmtDate(v.next_due)}`}
                  </span>
                </span>
                <Badge tone={STATUS_TONE[st]}>{VAX_STATUS_LABEL[st]}</Badge>
              </Link>
            );
          })}
          {missing.length > 0 && (
            <p className="px-2 pb-1 pt-2 text-xs text-muted">
              חסר: {missing.map((m) => m.name).join(", ")}
            </p>
          )}
        </Card>
      )}

      <SectionTitle>ציר זמן</SectionTitle>
      <div className="mb-3">
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "הכל" },
            { value: "vaccines", label: "חיסונים" },
            { value: "visits", label: "ביקורים" },
            { value: "weight", label: "משקל" },
          ]}
        />
      </div>
      {timeline.length === 0 ? (
        <Empty>אין רשומות עדיין</Empty>
      ) : (
        <div className="space-y-2">
          {timeline.map((r) => {
            const I = Icon[r.kind];
            return (
              <Card key={r.key} href={r.href} className="flex items-center gap-3 !py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <I size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="block truncate text-sm text-muted">{[fmtDate(r.date), r.sub].filter(Boolean).join(" · ")}</span>
                </span>
                {r.amount ? <span className="text-sm font-medium">{fmtMoney(r.amount)}</span> : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
