"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, RefreshCw, UserMinus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { InviteButtons } from "@/components/Invite";
import { Button, Card, Field, Input, PageTitle, SectionTitle } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function FamilyPage() {
  const router = useRouter();
  const { household, members, me, refreshFamily } = useApp();
  const isOwner = me.role === "owner";
  const [name, setName] = useState(household.name);
  const [busy, setBusy] = useState(false);

  const rename = async () => {
    if (!name.trim() || name === household.name) return;
    await supabase().from("households").update({ name: name.trim() }).eq("id", household.id);
    refreshFamily();
  };

  const regenerate = async () => {
    if (!confirm("ליצור קוד חדש? הקוד הישן יפסיק לעבוד.")) return;
    setBusy(true);
    await supabase().rpc("regenerate_join_code");
    await refreshFamily();
    setBusy(false);
  };

  const removeMember = async (userId: string, who: string) => {
    if (!confirm(`להסיר את ${who} מהמשפחה?`)) return;
    await supabase().rpc("remove_member", { p_user_id: userId });
    refreshFamily();
  };

  const leave = async () => {
    const last = members.length === 1;
    const msg = last
      ? "את/ה החבר/ה האחרון/ה. יציאה תמחק את המשפחה, הכלבים וכל המידע לצמיתות. להמשיך?"
      : "לצאת מהמשפחה? תחזרו למסך ההצטרפות.";
    if (!confirm(msg)) return;
    await supabase().rpc("leave_household");
    router.replace("/onboarding");
  };

  return (
    <div>
      <PageTitle>משפחה</PageTitle>

      {isOwner && (
        <Card className="mb-4">
          <Field label="שם המשפחה">
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              {name !== household.name && <Button onClick={rename}>שמירה</Button>}
            </div>
          </Field>
        </Card>
      )}

      <Card className="text-center">
        <div className="text-sm text-muted">קוד הצטרפות</div>
        <div dir="ltr" className="my-2 font-mono text-4xl font-bold tracking-[0.3em]">
          {household.join_code}
        </div>
        <p className="mb-3 text-xs text-muted">מי שמקבל את הקישור או הקוד נכנס ישר למשפחה ורואה את כל הכלבים</p>
        <InviteButtons />
        {isOwner && (
          <Button variant="ghost" onClick={regenerate} disabled={busy} className="mt-2 text-sm">
            <RefreshCw size={14} />
            יצירת קוד חדש
          </Button>
        )}
      </Card>

      <SectionTitle>בני המשפחה ({members.length})</SectionTitle>
      <Card className="!p-2">
        {members.map((m) => {
          const who = m.display_name || m.email || "בן משפחה";
          return (
            <div key={m.user_id} className="flex items-center justify-between gap-2 px-2 py-2.5">
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-medium">
                  {who}
                  {m.user_id === me.user_id && <span className="text-xs text-muted">(אני)</span>}
                  {m.role === "owner" && <Crown size={14} className="text-accent" aria-label="מנהל" />}
                </span>
                {m.email && m.display_name && (
                  <span dir="ltr" className="block truncate text-xs text-muted">
                    {m.email}
                  </span>
                )}
              </span>
              {isOwner && m.user_id !== me.user_id && (
                <button onClick={() => removeMember(m.user_id, who)} className="p-2 text-danger" aria-label={`הסרת ${who}`}>
                  <UserMinus size={18} />
                </button>
              )}
            </div>
          );
        })}
      </Card>

      <div className="mt-8 text-center">
        <Button variant="danger" onClick={leave}>
          יציאה מהמשפחה
        </Button>
      </div>
    </div>
  );
}
