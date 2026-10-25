"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChevronDown, HeartPulse, Home, MoreHorizontal, Plus, Shield, Syringe, Stethoscope, Utensils, Receipt, Scale, Check } from "lucide-react";
import { useApp } from "./AppProvider";
import { PetAvatar } from "./PetAvatar";
import { Sheet, cx } from "./ui";

const TABS = [
  { href: "/", label: "בית", icon: Home },
  { href: "/health", label: "בריאות", icon: HeartPulse },
  { href: "/food", label: "אוכל", icon: Utensils },
  { href: "/insurance", label: "ביטוח", icon: Shield },
  { href: "/more", label: "עוד", icon: MoreHorizontal },
];

const QUICK_ADD = [
  { href: "/health/vaccination", label: "חיסון / טיפול", icon: Syringe },
  { href: "/health/visit", label: "ביקור וטרינר", icon: Stethoscope },
  { href: "/food/purchase", label: "קניית אוכל", icon: Utensils },
  { href: "/expense", label: "הוצאה", icon: Receipt },
  { href: "/health/weight", label: "משקל", icon: Scale },
];

function PetPicker() {
  const { pets, pet, selectPet } = useApp();
  const [open, setOpen] = useState(false);
  if (!pet) return <span className="font-bold">Pawfolio</span>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full py-1 pe-3 ps-1 active:bg-black/5">
        <PetAvatar path={pet.photo_path} size={36} />
        <span className="text-lg font-bold">{pet.name}</span>
        <ChevronDown size={18} className="text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="בחירת כלב">
        <div className="space-y-1">
          {pets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                selectPet(p.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl p-2 active:bg-black/5"
            >
              <PetAvatar path={p.photo_path} size={44} />
              <span className="flex-1 text-right text-lg font-medium">{p.name}</span>
              {p.id === pet.id && <Check className="text-brand" />}
            </button>
          ))}
          <Link href="/more/pet?new=1" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2 text-brand">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10">
              <Plus />
            </span>
            <span className="font-medium">הוספת כלב</span>
          </Link>
        </div>
      </Sheet>
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const isTab = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/90 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur">
        <PetPicker />
      </header>

      <main className="flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-1">{children}</main>

      {TABS.some((t) => t.href === path) && (
      <button
        aria-label="הוספה מהירה"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
        style={{ left: "max(1rem, calc(50% - 15rem))" }}
      >
        <Plus size={30} />
      </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-xs", isTab(href) ? "text-brand" : "text-muted")}
            >
              <Icon size={24} strokeWidth={isTab(href) ? 2.4 : 1.8} />
              <span className={cx(isTab(href) && "font-semibold")}>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="מה להוסיף?">
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ADD.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setAddOpen(false)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line active:scale-[0.98]"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Icon />
              </span>
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
