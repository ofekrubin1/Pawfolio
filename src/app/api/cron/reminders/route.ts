import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import { reminderDue, upcomingItems, type UpcomingItem } from "@/lib/logic";
import { fmtDate } from "@/lib/format";
import type { FoodProduct, Member, Pet, Policy, Vaccination } from "@/lib/types";

/**
 * Daily job (Vercel Cron, every morning): finds what is due today for every dog
 * and notifies the family by email and Web Push. Each reminder is sent once.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); // YYYY-MM-DD in Israel
  const appUrl = process.env.APP_URL ?? request.nextUrl.origin;

  const [pets, vaccinations, products, policies, members, subs] = await Promise.all([
    db.from("pets").select("*"),
    db.from("vaccinations").select("*"),
    db.from("food_products").select("*, food_purchases(*)").eq("active", true),
    db.from("insurance_policies").select("*, insurance_claims(*)"),
    db.from("household_members").select("*"),
    db.from("push_subscriptions").select("*"),
  ]);
  const err = [pets, vaccinations, products, policies, members, subs].find((r) => r.error)?.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  // Due reminders grouped by family.
  const byHousehold = new Map<string, { pet: Pet; item: UpcomingItem; sendKey: string }[]>();
  for (const pet of (pets.data ?? []) as Pet[]) {
    const items = upcomingItems(
      {
        pet,
        vaccinations: ((vaccinations.data ?? []) as Vaccination[]).filter((v) => v.pet_id === pet.id),
        products: ((products.data ?? []) as FoodProduct[]).filter((p) => p.pet_id === pet.id),
        policies: ((policies.data ?? []) as Policy[]).filter((p) => p.pet_id === pet.id),
      },
      today,
    );
    for (const item of items) {
      const sendKey = reminderDue(item, today);
      if (!sendKey) continue;
      const list = byHousehold.get(pet.household_id) ?? [];
      list.push({ pet, item, sendKey });
      byHousehold.set(pet.household_id, list);
    }
  }

  const allKeys = [...byHousehold.values()].flat().map((r) => r.sendKey);
  const { data: sentRows } = allKeys.length
    ? await db.from("reminders_sent").select("key").in("key", allKeys)
    : { data: [] as { key: string }[] };
  const alreadySent = new Set((sentRows ?? []).map((r) => r.key));

  const vapidReady = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const report = { households: 0, reminders: 0, emails: 0, pushes: 0, errors: [] as string[] };
  const newlySent: string[] = [];
  const deadEndpoints: string[] = [];

  for (const [householdId, all] of byHousehold) {
    const due = all.filter((r) => !alreadySent.has(r.sendKey));
    if (!due.length) continue;
    report.households++;
    report.reminders += due.length;
    const family = ((members.data ?? []) as Member[]).filter((m) => m.household_id === householdId);
    const line = (r: (typeof due)[number]) =>
      `${r.pet.name}: ${r.item.title} – ${r.item.kind === "claim" ? r.item.detail : fmtDate(r.item.date)}`;

    // Email: one short digest per person.
    if (resend) {
      const to = family.filter((m) => m.notify_email && m.email).map((m) => m.email!);
      if (to.length) {
        const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px">
          <h2 style="color:#0f766e">תזכורות Pawfolio</h2>
          <ul>${due.map((r) => `<li style="margin-bottom:6px"><a href="${appUrl}${r.item.href}">${line(r)}</a></li>`).join("")}</ul>
          <p style="color:#6b7478;font-size:13px">אפשר לכבות תזכורות במייל באפליקציה: עוד ← הגדרות</p></div>`;
        for (const email of to) {
          const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "Pawfolio <onboarding@resend.dev>",
            to: email,
            subject: due.length === 1 ? `תזכורת: ${line(due[0])}` : `${due.length} תזכורות לכלב`,
            html,
          });
          if (error) report.errors.push(`email ${email}: ${error.message}`);
          else report.emails++;
        }
      }
    }

    // Push: one notification per reminder to every device of members who allow push.
    if (vapidReady) {
      const userIds = new Set(family.filter((m) => m.notify_push).map((m) => m.user_id));
      const devices = ((subs.data ?? []) as { user_id: string; endpoint: string; p256dh: string; auth: string }[]).filter((s) =>
        userIds.has(s.user_id),
      );
      for (const r of due) {
        const payload = JSON.stringify({ title: `${r.pet.name}: ${r.item.title}`, body: r.item.kind === "claim" ? r.item.detail : `${r.item.detail} · ${fmtDate(r.item.date)}`, url: r.item.href, tag: r.sendKey });
        for (const d of devices) {
          try {
            await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload);
            report.pushes++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) deadEndpoints.push(d.endpoint);
            else report.errors.push(`push: ${(e as Error).message}`);
          }
        }
      }
    }
    newlySent.push(...due.map((r) => r.sendKey));
  }

  if (newlySent.length) await db.from("reminders_sent").upsert(newlySent.map((key) => ({ key })));
  if (deadEndpoints.length) await db.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  // Keep the table small: forget reminders older than a year.
  await db.from("reminders_sent").delete().lt("sent_at", new Date(Date.now() - 365 * 86_400_000).toISOString());

  return NextResponse.json({ today, ...report });
}
