"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, Chips, Empty, PageTitle, SectionTitle, Spinner, cx } from "@/components/ui";
import { COST_CATEGORIES, COST_COLORS, EXPENSE_CATEGORIES } from "@/lib/constants";
import { fmtDate, fmtMoney } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { CostCategory, CostRow, ExpenseCategory } from "@/lib/types";

type Refund = { pet_id: string; date: string; amount: number };
const CATS = Object.keys(COST_CATEGORIES) as CostCategory[];
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

function label(r: CostRow) {
  return r.source === "expense" ? (EXPENSE_CATEGORIES[r.label as ExpenseCategory] ?? r.label) : r.label;
}

/** Excel opens UTF-8 CSV with Hebrew correctly only with a BOM. */
function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CostsPage() {
  const { pet, pets, data } = useApp();
  const [year, setYear] = useState(new Date().getFullYear());
  const [scope, setScope] = useState<"pet" | "all">("pet");
  const [month, setMonth] = useState<number | null>(year === new Date().getFullYear() ? new Date().getMonth() : null);
  const [rows, setRows] = useState<CostRow[] | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);

  useEffect(() => {
    (async () => {
      setRows(null);
      const db = supabase();
      let c = db.from("costs").select("*").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).order("date", { ascending: false });
      let r = db.from("insurance_refunds").select("*").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
      if (scope === "pet" && pet) {
        c = c.eq("pet_id", pet.id);
        r = r.eq("pet_id", pet.id);
      }
      const [{ data: costs }, { data: ref }] = await Promise.all([c, r]);
      setRows(((costs ?? []) as CostRow[]).map((x) => ({ ...x, amount: Number(x.amount) })));
      setRefunds(((ref ?? []) as Refund[]).map((x) => ({ ...x, amount: Number(x.amount) })));
    })();
  }, [year, scope, pet, data]);

  const view = useMemo(() => {
    if (!rows) return null;
    const inMonth = (d: string) => month === null || Number(d.slice(5, 7)) - 1 === month;
    const sel = rows.filter((r) => inMonth(r.date));
    const byCat = CATS.map((c) => ({ c, sum: sel.filter((r) => r.category === c).reduce((s, r) => s + r.amount, 0) })).filter((x) => x.sum > 0);
    const total = sel.reduce((s, r) => s + r.amount, 0);
    const ref = refunds.filter((r) => inMonth(r.date)).reduce((s, r) => s + r.amount, 0);
    const monthly = MONTHS.map((_, i) => rows.filter((r) => Number(r.date.slice(5, 7)) - 1 === i).reduce((s, r) => s + r.amount, 0));
    return { sel, byCat, total, ref, monthly, yearTotal: rows.reduce((s, r) => s + r.amount, 0) };
  }, [rows, refunds, month]);

  const petName = (id: string) => pets.find((p) => p.id === id)?.name ?? "";

  const exportCsv = () => {
    if (!rows) return;
    downloadCsv(`pawfolio-costs-${year}.csv`, [
      ["תאריך", "כלב", "קטגוריה", "פירוט", "סכום"],
      ...rows.map((r) => [r.date, petName(r.pet_id), COST_CATEGORIES[r.category], label(r), r.amount]),
      ...refunds.map((r) => [r.date, petName(r.pet_id), "החזר ביטוח", "", -r.amount]),
    ]);
  };

  const maxMonth = view ? Math.max(1, ...view.monthly) : 1;

  return (
    <div>
      <PageTitle
        action={
          <Button variant="secondary" onClick={exportCsv} className="text-sm">
            <Download size={16} />
            ייצוא
          </Button>
        }
      >
        עלויות
      </PageTitle>

      <div className="mb-3 flex items-center justify-between">
        {pets.length > 1 ? (
          <Chips value={scope} onChange={setScope} options={[{ value: "pet", label: pet?.name ?? "" }, { value: "all", label: "כל הכלבים" }]} />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <button className="p-2" onClick={() => (setYear(year - 1), setMonth(null))} aria-label="שנה קודמת">
            <ChevronRight size={20} />
          </button>
          <span className="font-bold">{year}</span>
          <button className="p-2 disabled:opacity-30" disabled={year >= new Date().getFullYear()} onClick={() => (setYear(year + 1), setMonth(null))} aria-label="שנה הבאה">
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {!view ? (
        <Spinner />
      ) : (
        <>
          <Card>
            <div className="mb-1 flex items-end gap-1" dir="ltr" style={{ height: 96 }}>
              {view.monthly.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setMonth(month === i ? null : i)}
                  className="flex h-full flex-1 flex-col justify-end"
                  aria-label={`${MONTHS[i]}: ${fmtMoney(v)}`}
                >
                  <span
                    className={cx("block w-full rounded-t", month === i ? "bg-accent" : "bg-brand/70")}
                    style={{ height: `${Math.max(v ? 4 : 1, (v / maxMonth) * 100)}%`, opacity: v ? 1 : 0.25 }}
                  />
                </button>
              ))}
            </div>
            <div className="flex gap-1 text-center text-[10px] text-muted" dir="ltr">
              {MONTHS.map((m, i) => (
                <span key={i} className={cx("flex-1", month === i && "font-bold text-fg")}>
                  {m.slice(0, 3)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted">לחיצה על חודש מסננת · לחיצה נוספת מציגה את כל השנה</p>
          </Card>

          <SectionTitle>{month === null ? `כל ${year}` : `${MONTHS[month]} ${year}`}</SectionTitle>
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted">הוצאות</div>
                <div className="text-lg font-bold">{fmtMoney(view.total)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">החזרי ביטוח</div>
                <div className="text-lg font-bold text-emerald-700">{fmtMoney(view.ref)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">עלות נטו</div>
                <div className="text-lg font-bold">{fmtMoney(view.total - view.ref)}</div>
              </div>
            </div>
            {view.byCat.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex h-3 overflow-hidden rounded-full">
                  {view.byCat.map(({ c, sum }) => (
                    <span key={c} style={{ width: `${(sum / view.total) * 100}%`, background: COST_COLORS[c] }} />
                  ))}
                </div>
                {view.byCat.map(({ c, sum }) => (
                  <div key={c} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COST_COLORS[c] }} />
                      {COST_CATEGORIES[c]}
                    </span>
                    <span className="font-medium">
                      {fmtMoney(sum)} <span className="text-xs text-muted">({Math.round((sum / view.total) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <SectionTitle>פירוט</SectionTitle>
          {view.sel.length === 0 ? (
            <Empty>אין הוצאות בתקופה הזו</Empty>
          ) : (
            <Card className="!p-2">
              {view.sel.map((r) => (
                <div key={r.source + r.source_id} className="flex items-center justify-between px-2 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: COST_COLORS[r.category] }} />
                    <span>
                      {label(r)}
                      <span className="text-muted">
                        {" "}
                        · {fmtDate(r.date)}
                        {scope === "all" && ` · ${petName(r.pet_id)}`}
                      </span>
                    </span>
                  </span>
                  <span className="font-medium">{fmtMoney(r.amount)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
