"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RotateCcw, Pencil } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { LineChart } from "@/components/LineChart";
import { Badge, Button, Card, Empty, PageTitle, SectionTitle, Spinner } from "@/components/ui";
import { FOOD_KINDS, REMIND } from "@/lib/constants";
import { daysUntil, fmtDate, fmtDaysLeft, fmtMoney, todayISO } from "@/lib/format";
import { foodRunOut, pricePerKg } from "@/lib/logic";
import { saveRow } from "@/lib/db";
import type { FoodProduct } from "@/lib/types";

function ProductCard({ p }: { p: FoodProduct }) {
  const { refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const end = foodRunOut(p);
  const days = end ? daysUntil(end) : null;
  const last = [...p.food_purchases].sort((a, b) => b.date.localeCompare(a.date))[0];

  const buyAgain = async () => {
    if (!last) return;
    setBusy(true);
    await saveRow("food_purchases", null, {
      product_id: p.id,
      date: todayISO(),
      quantity: last.quantity,
      price: last.price,
      store: last.store,
    });
    await refresh();
    setBusy(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold">{p.brand}</div>
          <div className="text-sm text-muted">
            {[FOOD_KINDS[p.kind], p.bag_kg && `שק ${p.bag_kg} ק"ג`, p.daily_grams && `${p.daily_grams} ג׳ ליום`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <Link href={`/food/product?id=${p.id}`} className="p-1 text-muted" aria-label="עריכת מוצר">
          <Pencil size={18} />
        </Link>
      </div>

      <div className="my-3">
        {days === null ? (
          <p className="text-sm text-muted">
            {!p.daily_grams || !p.bag_kg ? "הוסיפו משקל שק ומנה יומית כדי לדעת מתי ייגמר" : "עוד אין רכישות"}
          </p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{days <= 0 ? "נגמר" : `ייגמר ${fmtDaysLeft(days)}`}</span>
            <Badge tone={days <= 0 ? "red" : days <= REMIND.foodSoon ? "amber" : "green"}>{fmtDate(end)}</Badge>
          </div>
        )}
        {last && (
          <p className="mt-1 text-sm text-muted">
            קנייה אחרונה: {fmtDate(last.date)} · {fmtMoney(last.price)}
            {last.store && ` · ${last.store}`}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {last && (
          <Button onClick={buyAgain} disabled={busy} className="flex-1">
            <RotateCcw size={18} />
            {done ? "נוסף ✓" : "קנה שוב"}
          </Button>
        )}
        <Button variant="secondary" href={`/food/purchase?product=${p.id}`} className="flex-1">
          <Plus size={18} />
          רכישה
        </Button>
      </div>
    </Card>
  );
}

export default function FoodPage() {
  const { data, dataLoading } = useApp();
  const active = data.products.filter((p) => p.active);
  const inactive = data.products.filter((p) => !p.active);

  const purchases = useMemo(
    () =>
      data.products
        .flatMap((p) => p.food_purchases.map((pu) => ({ ...pu, product: p })))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.products],
  );

  if (dataLoading) return <Spinner />;

  // Price trend for the main (first active) dry food.
  const main = active.find((p) => p.kind === "dry") ?? active[0];
  const trend = main ? pricePerKg(main) : [];

  return (
    <div>
      <PageTitle action={<Button variant="secondary" href="/food/product"><Plus size={18} />מוצר</Button>}>אוכל</PageTitle>

      {active.length === 0 ? (
        <Empty action={<Button href="/food/product">הוספת מוצר</Button>}>הוסיפו את האוכל שהכלב אוכל כדי לדעת מתי הוא נגמר</Empty>
      ) : (
        <div className="space-y-3">
          {active.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {trend.length > 1 && (
        <>
          <SectionTitle>מחיר לק&quot;ג – {main!.brand}</SectionTitle>
          <Card>
            <LineChart points={trend} unit="₪" color="var(--color-accent)" height={140} />
            <p className="mt-1 text-center text-xs text-muted">
              ממוצע: {fmtMoney(trend.reduce((s, t) => s + t.value, 0) / trend.length)} לק&quot;ג
            </p>
          </Card>
        </>
      )}

      <SectionTitle>היסטוריית רכישות</SectionTitle>
      {purchases.length === 0 ? (
        <Empty>אין רכישות עדיין</Empty>
      ) : (
        <Card className="!p-2">
          {purchases.map((pu) => (
            <Link key={pu.id} href={`/food/purchase?id=${pu.id}`} className="flex items-center justify-between rounded-lg px-2 py-2.5 active:bg-black/5">
              <span>
                <span className="block font-medium">{pu.product.brand}</span>
                <span className="text-xs text-muted">
                  {fmtDate(pu.date)}
                  {pu.quantity !== 1 && ` · ${pu.quantity} יח׳`}
                  {pu.store && ` · ${pu.store}`}
                </span>
              </span>
              <span className="font-semibold">{fmtMoney(pu.price)}</span>
            </Link>
          ))}
        </Card>
      )}

      {inactive.length > 0 && (
        <>
          <SectionTitle>מוצרים קודמים</SectionTitle>
          <Card className="!p-2">
            {inactive.map((p) => (
              <Link key={p.id} href={`/food/product?id=${p.id}`} className="block rounded-lg px-2 py-2 text-muted active:bg-black/5">
                {p.brand} · {FOOD_KINDS[p.kind]}
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
