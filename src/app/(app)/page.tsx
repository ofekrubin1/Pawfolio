"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Syringe, Utensils, Shield, IdCard, FileClock, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Empty, SectionTitle, Spinner } from "@/components/ui";
import { InviteButtons } from "@/components/Invite";
import { supabase } from "@/lib/supabase/client";
import { upcomingItems, type UpcomingItem } from "@/lib/logic";
import { fmtDate, fmtDaysLeft, fmtMoney, fmtMonth, todayISO } from "@/lib/format";

const KIND_ICON: Record<UpcomingItem["kind"], typeof Syringe> = {
  vaccine: Syringe,
  food: Utensils,
  policy: Shield,
  license: IdCard,
  claim: FileClock,
};

function useYearCosts(petId: string | undefined) {
  const [state, setState] = useState<{ month: number; year: number; refundsYear: number } | null>(null);
  const { data } = useApp(); // re-fetch whenever the dog's records change
  useEffect(() => {
    if (!petId) return;
    const today = todayISO();
    const yearStart = today.slice(0, 4) + "-01-01";
    const monthStart = today.slice(0, 7) + "-01";
    (async () => {
      const db = supabase();
      const [{ data: costs }, { data: refunds }] = await Promise.all([
        db.from("costs").select("date, amount").eq("pet_id", petId).gte("date", yearStart).lte("date", today.slice(0, 4) + "-12-31"),
        db.from("insurance_refunds").select("date, amount").eq("pet_id", petId).gte("date", yearStart),
      ]);
      const rows = (costs ?? []) as { date: string; amount: number }[];
      setState({
        year: rows.reduce((s, r) => s + Number(r.amount), 0),
        month: rows.filter((r) => r.date >= monthStart && r.date.slice(0, 7) === monthStart.slice(0, 7)).reduce((s, r) => s + Number(r.amount), 0),
        refundsYear: ((refunds ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount), 0),
      });
    })();
  }, [petId, data]);
  return state;
}

export default function HomePage() {
  const { pet, data, dataLoading, members, household } = useApp();
  const items = useMemo(
    () => (pet ? upcomingItems({ pet, vaccinations: data.vaccinations, products: data.products, policies: data.policies }) : []),
    [pet, data],
  );
  const costs = useYearCosts(pet?.id);
  const now = new Date();

  if (!pet) return <Spinner />;
  if (dataLoading) return <Spinner />;

  return (
    <div>
      {members.length === 1 && (
        <Card className="mb-4 bg-brand/5">
          <div className="mb-2 flex items-center gap-2 font-bold">
            <Users size={20} className="text-brand" />
            הזמינו את המשפחה
          </div>
          <p className="mb-3 text-sm text-muted">
            קוד הצטרפות: <span dir="ltr" className="font-mono text-base font-bold tracking-widest text-fg">{household.join_code}</span>
          </p>
          <InviteButtons />
        </Card>
      )}

      <SectionTitle>מה הבא</SectionTitle>
      {data.vaccinations.length === 0 ? (
        <Empty action={<Button href="/health/initial">הוספת חיסונים אחרונים</Button>}>
          כדי שהתזכורות יעבדו, הוסיפו את החיסון האחרון מכל סוג
        </Empty>
      ) : items.length === 0 ? (
        <Card className="text-center text-muted">אין שום דבר דחוף 🎉</Card>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((it) => {
            const Icon = KIND_ICON[it.kind];
            return (
              <Card key={it.key} href={it.href} className="flex items-center gap-3 !py-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{it.title}</span>
                  <span className="text-sm text-muted">
                    {it.detail}
                    {it.kind !== "claim" && ` · ${fmtDate(it.date)}`}
                  </span>
                </span>
                {it.kind !== "claim" ? <Badge tone={it.tone}>{fmtDaysLeft(it.days)}</Badge> : <Badge tone={it.tone}>פתוחה</Badge>}
                <ChevronLeft size={18} className="text-muted" />
              </Card>
            );
          })}
        </div>
      )}

      <SectionTitle>עלויות</SectionTitle>
      <Card href="/more/costs">
        {costs ? (
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-muted">{fmtMonth(now.getFullYear(), now.getMonth())}</div>
              <div className="text-3xl font-bold">{fmtMoney(costs.month)}</div>
            </div>
            <div className="text-left text-sm">
              <div className="text-muted">מתחילת השנה</div>
              <div className="font-semibold">{fmtMoney(costs.year)}</div>
              {costs.refundsYear > 0 && <div className="text-emerald-700">החזרים {fmtMoney(costs.refundsYear)}</div>}
            </div>
          </div>
        ) : (
          <div className="h-14" />
        )}
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <QuickLink href="/more/emergency" label="כרטיס חירום" />
        <QuickLink href="/health/weight" label="משקל" />
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 font-medium ring-1 ring-line">
      {label}
      <ChevronLeft size={18} className="text-muted" />
    </Link>
  );
}
