// Security check against the LOCAL Supabase stack: families must never see each other's data.
// Run: node scripts/test-rls.mjs   (needs `npx supabase start`)
// Against the cloud project: TEST_URL=... TEST_KEY=... TEST_SECRET=... node scripts/test-rls.mjs
// (users are created confirmed with the secret key, and everything is deleted at the end)
import { createClient } from "@supabase/supabase-js";

const URL = process.env.TEST_URL || "http://127.0.0.1:54321";
const KEY = process.env.TEST_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const admin = process.env.TEST_SECRET ? createClient(URL, process.env.TEST_SECRET, { auth: { persistSession: false } }) : null;
const created = [];
const run = Date.now();
let failed = 0;

function check(name, ok, extra = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  " + extra}`);
  if (!ok) failed++;
}

async function user(tag) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const email = `rls-${tag}-${run}@test.local`;
  if (admin) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: "password123", email_confirm: true });
    if (error) throw error;
    created.push(data.user.id);
    const { error: e2 } = await c.auth.signInWithPassword({ email, password: "password123" });
    if (e2) throw e2;
    return { c, id: data.user.id };
  }
  const { data, error } = await c.auth.signUp({ email, password: "password123" });
  if (error) throw error;
  return { c, id: data.user.id };
}

const A = await user("a"); // family 1 owner
const B = await user("b"); // joins family 1
const C = await user("c"); // family 2
const anon = createClient(URL, KEY, { auth: { persistSession: false } });

// Families
const { data: h1, error: e1 } = await A.c.rpc("create_household", { p_name: "משפחה 1", p_display_name: "A" });
check("A creates family", !e1 && /^[A-Z2-9]{6}$/.test(h1?.join_code), e1?.message);
const { error: eTwice } = await A.c.rpc("create_household", { p_name: "שוב" });
check("A cannot create a second family", eTwice?.message.includes("already_in_household"), eTwice?.message);
const { data: h2 } = await C.c.rpc("create_household", { p_name: "משפחה 2", p_display_name: "C" });

const { data: bSeesBefore } = await B.c.from("households").select("*");
check("user without family sees no families (no guessing codes)", bSeesBefore?.length === 0, JSON.stringify(bSeesBefore));

const { error: eBad } = await B.c.rpc("join_household", { p_code: "ZZZZZZ" });
check("wrong code is rejected", eBad?.message.includes("invalid_code"), eBad?.message);
const { error: eJoin } = await B.c.rpc("join_household", { p_code: h1.join_code.toLowerCase(), p_display_name: "B" });
check("B joins with code (case-insensitive)", !eJoin, eJoin?.message);

// Pets & records
const { data: pet1, error: ep } = await A.c.from("pets").insert({ household_id: h1.id, name: "טומי" }).select().single();
check("A adds a dog", !ep, ep?.message);
const { data: bPets } = await B.c.from("pets").select("*");
check("B sees the family dog", bPets?.length === 1 && bPets[0].id === pet1.id);
const { error: ev } = await B.c.from("vaccinations").insert({ pet_id: pet1.id, type: "כלבת", given_on: "2026-01-01", next_due: "2027-01-01", cost: 120 });
check("B adds a vaccination", !ev, ev?.message);

const { data: cPets } = await C.c.from("pets").select("*");
check("C (other family) sees no dogs of family 1", cPets?.length === 0);
const { data: cVax } = await C.c.from("vaccinations").select("*");
check("C sees no vaccinations of family 1", cVax?.length === 0);
const { error: eCIns } = await C.c.from("vaccinations").insert({ pet_id: pet1.id, type: "x", given_on: "2026-01-01" });
check("C cannot add records to family 1's dog", !!eCIns);
const { error: eCPet } = await C.c.from("pets").insert({ household_id: h1.id, name: "פולש" });
check("C cannot add a dog to family 1", !!eCPet);
const { data: cUpd } = await C.c.from("pets").update({ name: "hacked" }).eq("id", pet1.id).select();
check("C cannot rename family 1's dog", (cUpd ?? []).length === 0);
const { data: cCosts } = await C.c.from("costs").select("*");
check("costs view hides other families", cCosts?.length === 0);
const { data: aCosts } = await A.c.from("costs").select("*");
check("costs view shows own costs", aCosts?.length === 1 && Number(aCosts[0].amount) === 120, JSON.stringify(aCosts));

// Roles
const { error: eRegen } = await B.c.rpc("regenerate_join_code");
check("member cannot regenerate the code", eRegen?.message.includes("not_owner"), eRegen?.message);
const { error: eRole } = await B.c.from("household_members").update({ role: "owner" }).eq("user_id", B.id);
check("member cannot make themselves owner", !!eRole);
const { data: bRen } = await B.c.from("households").update({ name: "x" }).eq("id", h1.id).select();
check("member cannot rename the family", (bRen ?? []).length === 0);
const { data: newCode, error: eR2 } = await A.c.rpc("regenerate_join_code");
check("owner regenerates the code", !eR2 && newCode !== h1.join_code, eR2?.message);
const { error: eOld } = await C.c.rpc("join_household", { p_code: h1.join_code });
check("old code stops working", !!eOld);

// Storage
const blob = new Blob(["hello"], { type: "text/plain" });
const { error: eUp } = await A.c.storage.from("attachments").upload(`${h1.id}/files/t.txt`, blob);
check("A uploads into family folder", !eUp, eUp?.message);
const { error: eUpC } = await C.c.storage.from("attachments").upload(`${h1.id}/files/evil.txt`, blob);
check("C cannot upload into family 1 folder", !!eUpC);
const { data: cDl } = await C.c.storage.from("attachments").download(`${h1.id}/files/t.txt`);
check("C cannot download family 1 files", !cDl);
const { data: bDl } = await B.c.storage.from("attachments").download(`${h1.id}/files/t.txt`);
check("B downloads family files", !!bDl);

// Emergency card
const token = crypto.randomUUID();
await A.c.from("pets").update({ emergency_token: token, vet_phone: "050-1234567" }).eq("id", pet1.id);
const { data: card } = await anon.rpc("get_emergency_card", { p_token: token });
check("public link shows the emergency card", card?.name === "טומי" && card?.vet_phone === "050-1234567");
const { data: noCard } = await anon.rpc("get_emergency_card", { p_token: crypto.randomUUID() });
check("random token shows nothing", noCard === null);
const { data: anonPets } = await anon.from("pets").select("*");
check("signed-out visitor sees no dogs", (anonPets ?? []).length === 0);
const { error: eAnonJoin } = await anon.rpc("join_household", { p_code: newCode });
check("signed-out visitor cannot join", !!eAnonJoin);

// Members & leaving
const { error: eRm } = await A.c.rpc("remove_member", { p_user_id: B.id });
check("owner removes a member", !eRm, eRm?.message);
const { data: bAfter } = await B.c.from("pets").select("*");
check("removed member loses access", bAfter?.length === 0);
await C.c.rpc("leave_household");
const { data: h2gone } = await A.c.rpc("my_household_id");
check("last member leaving deletes that family (A unaffected)", h2gone === h1.id);

if (admin) {
  // Clean up: test families (with their dogs and files), then the test users.
  const { data: hs } = await admin.from("households").select("id").in("created_by", created);
  for (const h of hs ?? []) {
    const { data: files } = await admin.storage.from("attachments").list(`${h.id}/files`);
    if (files?.length) await admin.storage.from("attachments").remove(files.map((f) => `${h.id}/files/${f.name}`));
    await admin.from("households").delete().eq("id", h.id);
  }
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`cleaned up ${hs?.length ?? 0} test families and ${created.length} test users`);
}

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
