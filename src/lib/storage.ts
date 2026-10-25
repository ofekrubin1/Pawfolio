"use client";

import { uuid } from "@/lib/format";
import { supabase } from "./supabase/client";
import type { Attachment } from "./types";

export const BUCKET = "attachments";

/** Shrinks photos before upload so receipts load fast on mobile data. PDFs and other files pass through. */
async function compress(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Uploads into the family's private folder; returns the storage path. */
export async function uploadFile(householdId: string, file: File, folder = "files") {
  const blob = await compress(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `${householdId}/${folder}/${uuid()}.${ext}`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type });
  if (error) throw error;
  return { path, mime: blob.type || file.type };
}

export async function attachFile(householdId: string, entityType: Attachment["entity_type"], entityId: string, file: File) {
  const { path, mime } = await uploadFile(householdId, file);
  const { error } = await supabase().from("attachments").insert({
    household_id: householdId,
    entity_type: entityType,
    entity_id: entityId,
    file_path: path,
    file_name: file.name,
    mime_type: mime,
  });
  if (error) throw error;
}

export async function deleteAttachment(a: Attachment) {
  await supabase().storage.from(BUCKET).remove([a.file_path]);
  await supabase().from("attachments").delete().eq("id", a.id);
}

/** Removes a record's attachments (call before deleting the record itself). */
export async function deleteAttachmentsOf(entityType: Attachment["entity_type"], entityId: string) {
  const { data } = await supabase().from("attachments").select("*").eq("entity_type", entityType).eq("entity_id", entityId);
  if (!data?.length) return;
  await supabase().storage.from(BUCKET).remove(data.map((a: Attachment) => a.file_path));
  await supabase().from("attachments").delete().in("id", data.map((a: Attachment) => a.id));
}

const urlCache = new Map<string, { url: string; expires: number }>();

/** Short-lived signed URL for a private file. */
export async function signedUrl(path: string) {
  const hit = urlCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data) return null;
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}
