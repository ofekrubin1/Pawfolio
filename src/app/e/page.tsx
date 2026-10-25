"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PawPrint } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { EmergencyCard, type EmergencyData } from "@/components/EmergencyCard";
import { Spinner } from "@/components/ui";

/** Public emergency card: /e?t=<token>. No login; shows only what get_emergency_card returns. */
export default function PublicEmergencyPage() {
  const token = useSearchParams().get("t");
  const [card, setCard] = useState<EmergencyData | null | undefined>(undefined);

  useEffect(() => {
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return setCard(null);
    supabase()
      .rpc("get_emergency_card", { p_token: token })
      .then(({ data }: { data: unknown }) => setCard((data as EmergencyData) ?? null));
  }, [token]);

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-red-700">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100">🚨</span>
        כרטיס חירום
      </div>
      {card === undefined ? (
        <Spinner />
      ) : card === null ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted ring-1 ring-line">הקישור לא תקין או שבוטל.</p>
      ) : (
        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
          <EmergencyCard
            d={card}
            photo={
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                <PawPrint size={32} />
              </span>
            }
          />
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted">Pawfolio</p>
    </main>
  );
}
