"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Empty, PageTitle, Row, SectionTitle, Spinner } from "@/components/ui";
import { CLAIM_STATUSES, OPEN_CLAIM_STATUSES } from "@/lib/constants";
import { daysUntil, fmtDate, fmtDaysLeft, fmtMoney, todayISO } from "@/lib/format";
import { activePolicy, claimStuckDays } from "@/lib/logic";
import type { ClaimStatus } from "@/lib/types";

const STATUS_TONE: Record<ClaimStatus, "gray" | "blue" | "amber" | "green" | "red"> = {
  draft: "gray",
  submitted: "blue",
  in_review: "amber",
  approved: "green",
  partial: "green",
  rejected: "red",
  paid: "green",
};

export default function InsurancePage() {
  const { data, dataLoading } = useApp();
  const policy = activePolicy(data.policies);
  const year = todayISO().slice(0, 4);

  const claims = useMemo(
    () =>
      data.policies
        .flatMap((p) => p.insurance_claims.map((c) => ({ ...c, company: p.company })))
        .sort((a, b) => (b.submitted_on ?? b.status_changed_at).localeCompare(a.submitted_on ?? a.status_changed_at)),
    [data.policies],
  );
  const visits = useMemo(() => new Map(data.visits.map((v) => [v.id, v])), [data.visits]);

  if (dataLoading) return <Spinner />;

  const premiums = data.policies.filter((p) => p.start_date.startsWith(year)).reduce((s, p) => s + Number(p.yearly_premium), 0);
  const refunds = claims.filter((c) => c.paid_on?.startsWith(year)).reduce((s, c) => s + Number(c.amount_paid ?? 0), 0);
  const open = claims.filter((c) => OPEN_CLAIM_STATUSES.includes(c.status));
  const closed = claims.filter((c) => !OPEN_CLAIM_STATUSES.includes(c.status));
  const renewDays = policy?.renewal_date ? daysUntil(policy.renewal_date) : null;

  const ClaimRow = ({ c }: { c: (typeof claims)[number] }) => {
    const visit = c.vet_visit_id ? visits.get(c.vet_visit_id) : null;
    const stuck = claimStuckDays(c);
    return (
      <Link href={`/insurance/claim?id=${c.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 active:bg-black/5">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{visit?.reason || c.notes || "תביעה"}</span>
          <span className="text-xs text-muted">
            {c.submitted_on ? `הוגשה ${fmtDate(c.submitted_on)}` : "לא הוגשה"}
            {stuck > 30 && ` · ${stuck} ימים בטיפול`}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold">
            {c.amount_paid ? <span className="text-emerald-700">{fmtMoney(c.amount_paid)}</span> : fmtMoney(c.amount_claimed)}
          </span>
          <Badge tone={stuck > 30 ? "red" : STATUS_TONE[c.status]}>{CLAIM_STATUSES[c.status]}</Badge>
        </span>
      </Link>
    );
  };

  return (
    <div>
      <PageTitle action={policy && <Button variant="secondary" href="/insurance/claim"><Plus size={18} />תביעה</Button>}>ביטוח</PageTitle>

      {!policy ? (
        <Empty action={<Button href="/insurance/policy">הוספת פוליסה</Button>}>עוד לא הוזנה פוליסת ביטוח</Empty>
      ) : (
        <Card href={`/insurance/policy?id=${policy.id}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-lg font-bold">{policy.company}</span>
            {renewDays !== null && (
              <Badge tone={renewDays < 0 ? "red" : renewDays <= 30 ? "amber" : "green"}>
                {renewDays < 0 ? "פגה" : `חידוש ${fmtDaysLeft(renewDays)}`}
              </Badge>
            )}
          </div>
          <Row label="כיסוי" value={policy.coverage_type} />
          <Row label="פרמיה שנתית" value={fmtMoney(policy.yearly_premium)} />
          <Row label="השתתפות עצמית" value={policy.deductible !== null ? fmtMoney(policy.deductible) : null} />
          <Row label="תקרת כיסוי" value={policy.coverage_cap !== null ? fmtMoney(policy.coverage_cap) : null} />
          <Row label="תאריך חידוש" value={fmtDate(policy.renewal_date)} />
        </Card>
      )}

      {policy && (
        <>
          <SectionTitle>האם הביטוח משתלם? ({year})</SectionTitle>
          <Card>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-sm text-muted">שילמנו פרמיות</div>
                <div className="text-xl font-bold">{fmtMoney(premiums)}</div>
              </div>
              <div>
                <div className="text-sm text-muted">קיבלנו בחזרה</div>
                <div className="text-xl font-bold text-emerald-700">{fmtMoney(refunds)}</div>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-bg py-2 text-center font-semibold">
              {premiums === 0 && refunds === 0
                ? "אין עדיין נתונים לשנה הזו"
                : refunds >= premiums
                  ? `משתלם ✓ (+${fmtMoney(refunds - premiums)})`
                  : `עדיין לא משתלם (${fmtMoney(premiums - refunds)} חסר)`}
            </p>
          </Card>

          <SectionTitle>תביעות פתוחות</SectionTitle>
          {open.length === 0 ? (
            <Empty>אין תביעות פתוחות</Empty>
          ) : (
            <Card className="!p-2">
              {open.map((c) => (
                <ClaimRow key={c.id} c={c} />
              ))}
            </Card>
          )}

          {closed.length > 0 && (
            <>
              <SectionTitle>תביעות סגורות</SectionTitle>
              <Card className="!p-2">
                {closed.map((c) => (
                  <ClaimRow key={c.id} c={c} />
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {data.policies.length > 0 && (
        <>
          <SectionTitle
            action={
              policy && (
                <Button variant="ghost" href={`/insurance/policy?renew=${policy.id}`} className="!p-0 text-sm">
                  <RefreshCw size={14} />
                  חידוש פוליסה
                </Button>
              )
            }
          >
            כל הפוליסות
          </SectionTitle>
          <Card className="!p-2">
            {data.policies.map((p) => (
              <Link key={p.id} href={`/insurance/policy?id=${p.id}`} className="flex justify-between rounded-lg px-2 py-2 text-sm active:bg-black/5">
                <span>
                  {p.company} · {fmtDate(p.start_date)}–{fmtDate(p.renewal_date)}
                </span>
                <span className="text-muted">{fmtMoney(p.yearly_premium)}</span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
