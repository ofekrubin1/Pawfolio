"use client";

import type { ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "./AppProvider";
import { Spinner } from "./ui";

/**
 * Wraps an add/edit form: waits for the dog's data, and remounts the form
 * whenever the URL query changes (?id=…), so it never shows a stale record.
 */
export function FormPage({ Form }: { Form: ComponentType }) {
  const params = useSearchParams();
  // bfcacheId changes on every new visit (link / push / replace) but not on browser Back,
  // so a kept-alive page never shows the last record's values.
  const { bfcacheId } = useRouter();
  const { dataLoading, pet } = useApp();
  if (dataLoading) return <Spinner />;
  return <Form key={`${bfcacheId}:${pet?.id}:${params.toString()}`} />;
}
