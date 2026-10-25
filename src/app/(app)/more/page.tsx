"use client";

import Link from "next/link";
import { ChevronLeft, Dog, Siren, BarChart3, Users, Settings, Receipt, Scale } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { PetAvatar } from "@/components/PetAvatar";
import { Card } from "@/components/ui";
import { ageText } from "@/lib/format";

const LINKS = [
  { href: "/more/pet", label: "פרופיל הכלב", icon: Dog },
  { href: "/more/emergency", label: "כרטיס חירום", icon: Siren },
  { href: "/more/costs", label: "עלויות וייצוא", icon: BarChart3 },
  { href: "/expense", label: "הוצאה כללית", icon: Receipt },
  { href: "/health/weight", label: "משקל", icon: Scale },
  { href: "/more/family", label: "משפחה וקוד הצטרפות", icon: Users },
  { href: "/more/settings", label: "הגדרות", icon: Settings },
];

export default function MorePage() {
  const { pet, household } = useApp();
  return (
    <div>
      {pet && (
        <Card href="/more/pet" className="mb-4 flex items-center gap-4">
          <PetAvatar path={pet.photo_path} size={64} />
          <div>
            <div className="text-xl font-bold">{pet.name}</div>
            <div className="text-sm text-muted">{[pet.breed, ageText(pet.birth_date)].filter(Boolean).join(" · ")}</div>
            <div className="text-xs text-muted">{household.name}</div>
          </div>
        </Card>
      )}
      <Card className="!p-1">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3.5 active:bg-black/5">
            <Icon size={22} className="text-brand" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronLeft size={18} className="text-muted" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
