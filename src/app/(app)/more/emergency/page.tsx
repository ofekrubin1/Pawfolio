"use client";

import { uuid } from "@/lib/format";
import { useState } from "react";
import { Link2, Link2Off, Share2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { EmergencyCard } from "@/components/EmergencyCard";
import { useOrigin } from "@/components/Invite";
import { PetAvatar } from "@/components/PetAvatar";
import { Button, Card, SectionTitle, Spinner } from "@/components/ui";
import { latestPerType } from "@/lib/logic";
import { supabase } from "@/lib/supabase/client";

export default function EmergencyPage() {
  const { pet, data, members, refreshFamily } = useApp();
  const origin = useOrigin();
  const [busy, setBusy] = useState(false);
  if (!pet) return <Spinner />;

  const link = pet.emergency_token ? `${origin}/e?t=${pet.emergency_token}` : null;

  const setToken = async (token: string | null) => {
    setBusy(true);
    await supabase().from("pets").update({ emergency_token: token }).eq("id", pet.id);
    await refreshFamily();
    setBusy(false);
  };

  const share = async () => {
    let url = link;
    if (!url) {
      const token = uuid();
      await setToken(token);
      url = `${origin}/e?t=${token}`;
    }
    const text = `כרטיס חירום של ${pet.name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("הקישור הועתק");
      } catch {
        prompt("העתיקו את הקישור:", url); // no clipboard on non-https pages
      }
    }
  };

  return (
    <div>
      <Card>
        <EmergencyCard
          d={{
            ...pet,
            owners: members.map((m) => ({ name: m.display_name })),
            vaccinations: latestPerType(data.vaccinations).map((v) => ({ type: v.type, given_on: v.given_on, next_due: v.next_due })),
          }}
          photo={<PetAvatar path={pet.photo_path} size={72} />}
        />
      </Card>

      <SectionTitle>שיתוף בקישור</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">לפנסיון, למטפל או לשכן. מי שיש לו את הקישור רואה רק את הכרטיס הזה, בלי להתחבר. אפשר לבטל בכל רגע.</p>
        <Button onClick={share} disabled={busy} className="w-full">
          <Share2 size={18} />
          שיתוף הכרטיס
        </Button>
        {link && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1 text-emerald-700">
              <Link2 size={16} />
              הקישור פעיל
            </span>
            <Button
              variant="ghost"
              disabled={busy}
              className="!py-1 text-danger"
              onClick={() => confirm("לבטל את הקישור? מי שקיבל אותו לא יוכל לפתוח יותר.") && setToken(null)}
            >
              <Link2Off size={16} />
              ביטול הקישור
            </Button>
          </div>
        )}
      </Card>
      <p className="mt-3 text-center text-xs text-muted">לעריכת הפרטים: עוד ← פרופיל הכלב</p>
    </div>
  );
}
