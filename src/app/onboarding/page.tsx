"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, KeyRound, PawPrint } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button, Card, ErrorText, Field, Input, Spinner } from "@/components/ui";

const ERRORS: Record<string, string> = {
  invalid_code: "הקוד לא נמצא. בדקו שהקלדתם נכון או בקשו קוד חדש.",
  already_in_household: "אתם כבר חברים במשפחה.",
};

function errText(msg: string) {
  return Object.entries(ERRORS).find(([k]) => msg.includes(k))?.[1] ?? msg;
}

/** After signing in: create a new family or join one with a 6-character code. */
export default function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialCode = (params.get("code") ?? "").toUpperCase();
  const [mode, setMode] = useState<"choose" | "create" | "join">(initialCode ? "join" : "choose");
  const [checking, setChecking] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const db = supabase();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return router.replace("/login");
      const { data: me } = await db.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle();
      if (me) return router.replace("/");
      const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "";
      setDisplayName(name.split(" ")[0] ?? "");
      setChecking(false);
    })();
  }, [router]);

  const create = async () => {
    if (!familyName.trim()) return setError("צריך שם למשפחה");
    setBusy(true);
    setError("");
    const { error } = await supabase().rpc("create_household", { p_name: familyName, p_display_name: displayName || null });
    if (error) {
      setBusy(false);
      return setError(errText(error.message));
    }
    router.replace("/more/pet?new=1&first=1");
  };

  const join = async () => {
    if (code.trim().length !== 6) return setError("הקוד הוא 6 תווים");
    setBusy(true);
    setError("");
    const { error } = await supabase().rpc("join_household", { p_code: code, p_display_name: displayName || null });
    if (error) {
      setBusy(false);
      return setError(errText(error.message));
    }
    router.replace("/");
  };

  if (checking) return <Spinner />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-10">
      <div className="mb-4 text-center">
        <span className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white">
          <PawPrint size={34} />
        </span>
        <h1 className="text-2xl font-bold">ברוכים הבאים!</h1>
        <p className="mt-1 text-muted">כל בני המשפחה רואים ועורכים את אותו מידע</p>
      </div>

      {mode === "choose" && (
        <>
          <Card className="cursor-pointer" >
            <button onClick={() => setMode("create")} className="flex w-full items-center gap-4 text-right">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Home />
              </span>
              <span>
                <span className="block font-bold">יצירת משפחה חדשה</span>
                <span className="text-sm text-muted">מוסיפים כלב ומקבלים קוד לשתף</span>
              </span>
            </button>
          </Card>
          <Card>
            <button onClick={() => setMode("join")} className="flex w-full items-center gap-4 text-right">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <KeyRound />
              </span>
              <span>
                <span className="block font-bold">הצטרפות עם קוד</span>
                <span className="text-sm text-muted">קיבלתם קוד מבן משפחה</span>
              </span>
            </button>
          </Card>
        </>
      )}

      {mode !== "choose" && (
        <Card className="space-y-4">
          <Field label="איך לקרוא לך?" hint="כך יראו אותך שאר בני המשפחה">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          {mode === "create" ? (
            <Field label="שם המשפחה" required>
              <Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="למשל: משפחת רובין" autoFocus />
            </Field>
          ) : (
            <Field label="קוד הצטרפות" required>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                dir="ltr"
                className="text-center font-mono text-2xl tracking-[0.4em]"
                placeholder="K7P2QX"
                autoFocus={!initialCode}
                autoCapitalize="characters"
              />
            </Field>
          )}
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button onClick={mode === "create" ? create : join} disabled={busy} className="flex-1">
              {mode === "create" ? "יצירה" : "הצטרפות"}
            </Button>
            <Button variant="ghost" onClick={() => (setMode("choose"), setError(""))}>
              חזרה
            </Button>
          </div>
        </Card>
      )}

      <button className="mt-6 text-sm text-muted" onClick={async () => (await supabase().auth.signOut(), router.replace("/login"))}>
        התנתקות
      </button>
    </main>
  );
}
