"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, postJournal as rpcPost, reverseJournal as rpcReverse, periodForDate, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type JournalLineInput = {
  account_id: string;
  partner_id?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
};

// ---------------------------------------------------------------------------
// CREATE — header + lines, atomic via lines insert after header
// ---------------------------------------------------------------------------
export async function createJournal(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const date        = String(formData.get("date") || "").trim();
  const number      = String(formData.get("number") || "").trim() || null;
  const reference   = String(formData.get("reference") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const linesJson   = String(formData.get("lines_data") || "[]");
  const postNow     = formData.get("post_now") === "1";

  if (!date) return { error: "Огноо заавал бөглөнө" };

  let lines: JournalLineInput[];
  try {
    lines = JSON.parse(linesJson);
  } catch {
    return { error: "Мөрүүд буруу бичигдсэн" };
  }
  if (!Array.isArray(lines) || lines.length < 2) {
    return { error: "Дор хаяж 2 мөр оруулна уу" };
  }

  // Balance check on client side too (DB enforces, but fail fast)
  const totalDr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(totalDr - totalCr) > 0.005) {
    return { error: `Дебит ${totalDr.toFixed(2)} ≠ Кредит ${totalCr.toFixed(2)}` };
  }
  if (totalDr === 0) return { error: "Дүн 0 байж болохгүй" };

  const supabase = await createClient();

  // Resolve company + period
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  const periodId = await periodForDate(supabase, uc.company_id, date);
  if (!periodId) return { error: `${date} огнооны period нээгдээгүй байна` };

  // Generate number if not provided: YYYYMM-NNNN
  let journalNumber = number;
  if (!journalNumber) {
    const ym = date.slice(0, 7).replace("-", "");
    const { data: lastNum } = await supabase
      .from("journals")
      .select("number")
      .like("number", `${ym}-%`)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastSeq = lastNum?.number ? parseInt(lastNum.number.split("-")[1] || "0", 10) : 0;
    journalNumber = `${ym}-${String(lastSeq + 1).padStart(4, "0")}`;
  }

  // Insert header
  const { data: journal, error: jErr } = await supabase
    .from("journals")
    .insert({
      company_id: uc.company_id,
      period_id: periodId,
      number: journalNumber,
      date,
      reference,
      description,
      status: "draft",
      source: "manual",
      total_debit: totalDr,
      total_credit: totalCr,
    })
    .select("id")
    .single();
  if (jErr) {
    if (jErr.code === "23505") return { error: `Дугаар "${journalNumber}" аль хэдийн бий` };
    return { error: jErr.message };
  }

  // Insert lines
  const lineRows = lines.map((l, idx) => ({
    journal_id: journal.id,
    line_no: idx + 1,
    account_id: l.account_id,
    partner_id: l.partner_id || null,
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
    description: l.description || null,
  }));
  const { error: lErr } = await supabase.from("journal_lines").insert(lineRows);
  if (lErr) {
    // Rollback header
    await supabase.from("journals").delete().eq("id", journal.id);
    return { error: `Мөр бичих алдаа: ${lErr.message}` };
  }

  // Optionally post
  if (postNow) {
    try {
      await rpcPost(supabase, journal.id);
    } catch (e) {
      return actionError(e, "Баталгаажуулах амжилтгүй");
    }
  }

  try {
    revalidatePath("/journals");
    redirect(
      `/journals/${journal.id}?flash=${encodeURIComponent(
        postNow ? "Журнал баталгаажсан" : "Журнал хадгалагдсан (ноорог)",
      )}&type=success`,
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// UPDATE — draft only; replaces all lines
// ---------------------------------------------------------------------------
export async function updateJournal(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const date        = String(formData.get("date") || "").trim();
  const reference   = String(formData.get("reference") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const linesJson   = String(formData.get("lines_data") || "[]");
  const postNow     = formData.get("post_now") === "1";

  if (!date) return { error: "Огноо заавал бөглөнө" };

  let lines: JournalLineInput[];
  try {
    lines = JSON.parse(linesJson);
  } catch {
    return { error: "Мөрүүд буруу" };
  }
  if (lines.length < 2) return { error: "Дор хаяж 2 мөр оруулна уу" };

  const totalDr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(totalDr - totalCr) > 0.005) {
    return { error: `Дебит ${totalDr.toFixed(2)} ≠ Кредит ${totalCr.toFixed(2)}` };
  }

  const supabase = await createClient();

  // Verify status = draft (triggers will also enforce)
  const { data: existing } = await supabase
    .from("journals")
    .select("status, company_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Журнал олдсонгүй" };
  if (existing.status !== "draft") return { error: "Зөвхөн ноорог журналыг засна" };

  const periodId = await periodForDate(supabase, existing.company_id, date);
  if (!periodId) return { error: `${date} огнооны period нээгдээгүй байна` };

  // Update header
  const { error: jErr } = await supabase
    .from("journals")
    .update({ date, period_id: periodId, reference, description, total_debit: totalDr, total_credit: totalCr })
    .eq("id", id);
  if (jErr) return { error: jErr.message };

  // Replace lines: delete all + insert new
  await supabase.from("journal_lines").delete().eq("journal_id", id);
  const lineRows = lines.map((l, idx) => ({
    journal_id: id,
    line_no: idx + 1,
    account_id: l.account_id,
    partner_id: l.partner_id || null,
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
    description: l.description || null,
  }));
  const { error: lErr } = await supabase.from("journal_lines").insert(lineRows);
  if (lErr) return { error: lErr.message };

  if (postNow) {
    try {
      await rpcPost(supabase, id);
    } catch (e) {
      return actionError(e, "Баталгаажуулах амжилтгүй");
    }
  }

  try {
    revalidatePath(`/journals/${id}`);
    revalidatePath("/journals");
    redirect(`/journals/${id}?flash=${encodeURIComponent("Журнал засагдсан")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// POST — draft → posted (RPC)
// ---------------------------------------------------------------------------
export async function postJournalAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await rpcPost(supabase, id);
    revalidatePath(`/journals/${id}`);
    revalidatePath("/journals");
    return { success: "Журнал баталгаажсан" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// REVERSE — posted → reversal journal (RPC)
// ---------------------------------------------------------------------------
export async function reverseJournalAction(id: string, reason: string): Promise<ActionResult> {
  if (!reason || reason.trim().length < 3) {
    return { error: "Буцаах шалтгаан 3+ тэмдэгт байх ёстой" };
  }
  const supabase = await createClient();
  try {
    const newId = await rpcReverse(supabase, id, reason);
    revalidatePath(`/journals/${id}`);
    revalidatePath("/journals");
    return { success: "Журнал буцаагдсан", data: newId };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// DELETE — draft only
// ---------------------------------------------------------------------------
export async function deleteJournalAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("journals").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/journals");
    return { success: "Журнал устгагдсан" };
  } catch (e) {
    return actionError(e);
  }
}
