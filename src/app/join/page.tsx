"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";

/** Shareable join link: /join?code=K7P2QX → onboarding with the code filled in. */
export default function JoinPage() {
  const router = useRouter();
  const code = useSearchParams().get("code") ?? "";
  useEffect(() => {
    router.replace(`/onboarding?code=${encodeURIComponent(code)}`);
  }, [router, code]);
  return <Spinner />;
}
