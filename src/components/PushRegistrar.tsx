"use client";

import { useEffect } from "react";
import { registerSW } from "@/lib/push";

/** Registers the service worker (offline shell + push) once the app loads. */
export function PushRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") registerSW()?.catch(() => {});
  }, []);
  return null;
}
