"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, ErrorText, Field, Input, PageTitle, SectionTitle, Toggle } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { disablePush, enablePush, hasPushSubscription, isStandalone, pushSupported } from "@/lib/push";

export default function SettingsPage() {
  const router = useRouter();
  const { user, me, refreshFamily } = useApp();
  const [name, setName] = useState(me.display_name ?? "");
  const [deviceOn, setDeviceOn] = useState(false);
  const [env, setEnv] = useState({ supported: false, standalone: false, ios: false });
  const [error, setError] = useState("");

  useEffect(() => {
    hasPushSubscription().then(setDeviceOn);
    setEnv({ supported: pushSupported(), standalone: isStandalone(), ios: /iPhone|iPad/.test(navigator.userAgent) });
  }, []);

  const update = async (patch: Record<string, unknown>) => {
    await supabase().from("household_members").update(patch).eq("user_id", user.id);
    refreshFamily();
  };

  const toggleDevice = async (on: boolean) => {
    setError("");
    try {
      if (on) {
        await enablePush(user.id);
        if (!me.notify_push) await update({ notify_push: true });
      } else await disablePush();
      setDeviceOn(on);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const signOut = async () => {
    await disablePush().catch(() => {});
    await supabase().auth.signOut();
    router.replace("/login");
  };

  return (
    <div>
      <PageTitle>הגדרות</PageTitle>

      <Card>
        <Field label="השם שלי במשפחה">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            {name !== (me.display_name ?? "") && <Button onClick={() => update({ display_name: name.trim() || null })}>שמירה</Button>}
          </div>
        </Field>
        <p dir="ltr" className="mt-2 text-right text-xs text-muted">
          {user.email}
        </p>
      </Card>

      <SectionTitle>תזכורות</SectionTitle>
      <Card className="divide-y divide-line">
        <Toggle checked={me.notify_email} onChange={(v) => update({ notify_email: v })} label="תזכורות במייל" />
        <div className="py-1">
          <Toggle checked={deviceOn} onChange={toggleDevice} label="התראות בטלפון הזה" />
          {env.ios && !env.standalone && (
            <p className="pb-2 text-xs text-muted">באייפון: קודם מוסיפים למסך הבית (שיתוף ← הוספה למסך הבית), פותחים משם, ואז מפעילים.</p>
          )}
          {!env.supported && !env.ios && <p className="pb-2 text-xs text-muted">הדפדפן הזה לא תומך בהתראות</p>}
        </div>
        <p className="pt-3 text-xs text-muted">
          כל בוקר: חיסון שבוע לפני ובאותו יום, אוכל 5 ימים לפני שנגמר, ביטוח ורישיון 30 יום לפני חידוש, ותביעה שבטיפול יותר מ-30 יום.
        </p>
      </Card>
      <ErrorText>{error}</ErrorText>

      <div className="mt-8 text-center">
        <Button variant="secondary" onClick={signOut}>
          <LogOut size={18} />
          התנתקות
        </Button>
      </div>
    </div>
  );
}
