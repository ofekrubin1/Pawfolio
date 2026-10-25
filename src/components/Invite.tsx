"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { useApp } from "./AppProvider";
import { Button } from "./ui";

export function joinLink(code: string, origin = typeof location === "undefined" ? "" : location.origin) {
  return `${origin}/join?code=${code}`;
}

/** location.origin, available only after mount (pages also render on the server). */
export function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  return origin;
}

/** WhatsApp / copy buttons for the family join code. */
export function InviteButtons() {
  const { household } = useApp();
  const [copied, setCopied] = useState(false);
  const origin = useOrigin();
  const text = () => `הצטרפו למשפחת "${household.name}" ב-Pawfolio לניהול הכלב:\n${joinLink(household.join_code, origin)}\nקוד: ${household.join_code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("העתיקו את הקישור:", joinLink(household.join_code));
    }
  };

  return (
    <div className="flex gap-2">
      <Button href={`https://wa.me/?text=${encodeURIComponent(text())}`} className="flex-1 !bg-[#25D366]">
        <Share2 size={18} />
        וואטסאפ
      </Button>
      <Button variant="secondary" onClick={copy} className="flex-1">
        {copied ? <Check size={18} /> : <Copy size={18} />}
        {copied ? "הועתק" : "העתקה"}
      </Button>
    </div>
  );
}
