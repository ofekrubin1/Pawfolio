"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PawPrint } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button, ErrorText, Input } from "@/components/ui";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

/** Email + password login, only when NEXT_PUBLIC_DEV_LOGIN=1 (local testing without Google). */
function DevLogin({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("dev1@pawfolio.test");
  const [error, setError] = useState("");
  const go = async () => {
    const db = supabase();
    const password = "devpassword123";
    let { error } = await db.auth.signInWithPassword({ email, password });
    if (error) ({ error } = await db.auth.signUp({ email, password }));
    if (error) return setError(error.message);
    router.replace(next);
    router.refresh();
  };
  return (
    <div className="mt-8 space-y-2 rounded-2xl border border-dashed border-line p-4">
      <p className="text-xs text-muted">כניסת בדיקה (רק במחשב המקומי)</p>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
      <Button variant="secondary" onClick={go} className="w-full">
        כניסה
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("error") ? "ההתחברות נכשלה, נסו שוב" : "");

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-10 text-center">
        <span className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-white shadow-lg">
          <PawPrint size={44} />
        </span>
        <h1 className="text-3xl font-bold">Pawfolio</h1>
        <p className="mt-2 text-muted">חיסונים, אוכל, ביטוח ועלויות של הכלב – במקום אחד, לכל המשפחה</p>
      </div>
      <button
        onClick={signIn}
        disabled={loading}
        className="flex items-center justify-center gap-3 rounded-xl bg-surface px-4 py-3.5 font-semibold shadow-sm ring-1 ring-line active:scale-[0.98] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "מעביר ל-Google…" : "התחברות עם Google"}
      </button>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      {process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && <DevLogin next={next} />}
    </main>
  );
}
