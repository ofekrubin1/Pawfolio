"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { attachFile, deleteAttachment, signedUrl } from "@/lib/storage";
import type { Attachment } from "@/lib/types";
import { useApp } from "./AppProvider";
import { useSignedUrl } from "./PetAvatar";

type EntityType = Attachment["entity_type"];

function Thumb({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  const url = useSignedUrl(a.mime_type?.startsWith("image/") ? a.file_path : null);
  const open = async () => {
    const u = await signedUrl(a.file_path);
    if (u) window.open(u, "_blank");
  };
  return (
    <div className="relative h-20 w-20 shrink-0">
      <button type="button" onClick={open} className="h-full w-full overflow-hidden rounded-xl bg-line/50 ring-1 ring-line">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 p-1 text-[10px] text-muted">
            <FileText size={22} />
            <span className="line-clamp-2 break-all">{a.file_name}</span>
          </span>
        )}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className="absolute -left-1.5 -top-1.5 rounded-full bg-fg p-0.5 text-white" aria-label="הסרה">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-line/50 ring-1 ring-line">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover opacity-80" />
      ) : (
        <span className="flex h-full items-center justify-center text-muted">
          <FileText />
        </span>
      )}
      <button type="button" onClick={onRemove} className="absolute left-0.5 top-0.5 rounded-full bg-fg p-0.5 text-white" aria-label="הסרה">
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Photos / documents for a record. Before the record exists, files wait in memory;
 * call save(newId) right after the record is created.
 */
export function useAttachments(entityType: EntityType, entityId: string | null, label = "צילום / מסמך") {
  const { household } = useApp();
  const [items, setItems] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!entityId) return setItems([]);
    const { data } = await supabase()
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at");
    setItems(data ?? []);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    if (inputRef.current) inputRef.current.value = "";
    if (!entityId) return setPending((p) => [...p, ...list]);
    setBusy(true);
    try {
      for (const f of list) await attachFile(household.id, entityType, entityId, f);
      await load();
    } catch (e) {
      alert("ההעלאה נכשלה: " + (e as Error).message);
    }
    setBusy(false);
  };

  const save = async (newId: string) => {
    for (const f of pending) await attachFile(household.id, entityType, newId, f);
    setPending([]);
  };

  const ui = (
    <div>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="flex gap-2 overflow-x-auto pb-1 pt-1.5">
        {items.map((a) => (
          <Thumb
            key={a.id}
            a={a}
            onRemove={async () => {
              if (!confirm("למחוק את הקובץ?")) return;
              await deleteAttachment(a);
              load();
            }}
          />
        ))}
        {pending.map((f, i) => (
          <PendingThumb key={i} file={f} onRemove={() => setPending((p) => p.filter((_, j) => j !== i))} />
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs text-muted"
        >
          <Camera size={22} />
          {busy ? "מעלה…" : "הוספה"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onPick(e.target.files)} />
    </div>
  );

  return { ui, save, items, pending };
}

/** Read-only list of another record's files (e.g. a vet visit's receipts on its claim). */
export function AttachmentList({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  useEffect(() => {
    supabase()
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .then(({ data }: { data: Attachment[] | null }) => setItems(data ?? []));
  }, [entityType, entityId]);
  if (!items.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((a) => (
        <Thumb key={a.id} a={a} />
      ))}
    </div>
  );
}
