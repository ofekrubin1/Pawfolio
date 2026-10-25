"use client";

import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";
import { signedUrl } from "@/lib/storage";
import { cx } from "./ui";

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    signedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

export function PetAvatar({ path, size = 40, className }: { path: string | null | undefined; size?: number; className?: string }) {
  const url = useSignedUrl(path);
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-brand", className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <PawPrint size={size * 0.5} />
      )}
    </span>
  );
}
