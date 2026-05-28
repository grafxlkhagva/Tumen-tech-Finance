/**
 * Typed wrappers around Supabase RPC calls.
 *
 * Every PL/pgSQL function exposed via Postgrest should have a thin wrapper here.
 * Provides:
 *   1. TypeScript safety on params + return shape.
 *   2. Single place to add logging / error mapping.
 *   3. Easy refactoring when we change a function signature.
 *
 * Pattern: takes a SupabaseClient (from createClient() — server or browser),
 * does the call, throws on error so server actions can convert to ActionResult.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Sb = SupabaseClient;

// ---------------------------------------------------------------------------
// Generic ActionResult — used by Server Actions returning to useActionState
// ---------------------------------------------------------------------------

export type ActionResult<T = unknown> = {
  error?: string;
  success?: string;
  data?: T;
};

/** Convert a thrown error into a user-facing message. */
export function actionError(e: unknown, fallback = "Алдаа гарлаа"): ActionResult {
  if (e instanceof Error) return { error: e.message };
  if (typeof e === "string") return { error: e };
  return { error: fallback };
}

// ---------------------------------------------------------------------------
// JOURNAL RPCs (migration 012 — functions.sql)
// ---------------------------------------------------------------------------

/** Post a draft journal → posted. Validates double-entry balance. Atomic. */
export async function postJournal(sb: Sb, journalId: string): Promise<void> {
  const { error } = await sb.rpc("post_journal", { p_journal_id: journalId });
  if (error) throw new Error(`Журнал баталгаажуулах: ${error.message}`);
}

/** Reverse a posted journal — creates swap journal + auto-posts it. */
export async function reverseJournal(
  sb: Sb,
  journalId: string,
  reason: string,
  date?: string,
): Promise<string> {
  const { data, error } = await sb.rpc("reverse_journal", {
    p_journal_id: journalId,
    p_reason: reason,
    p_date: date ?? null,
  });
  if (error) throw new Error(`Журнал буцаах: ${error.message}`);
  return (data as { id: string }).id;
}

// ---------------------------------------------------------------------------
// PERIOD RPCs
// ---------------------------------------------------------------------------

export async function closePeriod(sb: Sb, periodId: string): Promise<void> {
  const { error } = await sb.rpc("close_period", { p_period_id: periodId });
  if (error) throw new Error(`Period хаах: ${error.message}`);
}

export async function reopenPeriod(sb: Sb, periodId: string, reason: string): Promise<void> {
  const { error } = await sb.rpc("reopen_period", {
    p_period_id: periodId,
    p_reason: reason,
  });
  if (error) throw new Error(`Period сэргээх: ${error.message}`);
}

// ---------------------------------------------------------------------------
// CASH RPCs
// ---------------------------------------------------------------------------

export async function createJournalFromCash(sb: Sb, cashId: string): Promise<string> {
  const { data, error } = await sb.rpc("create_journal_from_cash", {
    p_cash_id: cashId,
  });
  if (error) throw new Error(`Кассаас журнал үүсгэх: ${error.message}`);
  return data as string;
}

// ---------------------------------------------------------------------------
// AR/AP RPCs
// ---------------------------------------------------------------------------

export async function reconcileInvoicePayment(
  sb: Sb,
  receivableId: string,
  cashTxnId: string,
  amount: number,
): Promise<string> {
  const { data, error } = await sb.rpc("reconcile_invoice_payment", {
    p_receivable_id: receivableId,
    p_cash_txn_id: cashTxnId,
    p_amount: amount,
  });
  if (error) throw new Error(`Нэхэмжлэх төлбөр тулгах: ${error.message}`);
  return data as string;
}

// ---------------------------------------------------------------------------
// DEPRECIATION RPC
// ---------------------------------------------------------------------------

export type DepreciationResult = {
  asset_id: string;
  asset_code: string;
  depreciation_amount: number;
  journal_id: string;
};

export async function calculateDepreciation(
  sb: Sb,
  periodId: string,
): Promise<DepreciationResult[]> {
  const { data, error } = await sb.rpc("calculate_depreciation", {
    p_period_id: periodId,
  });
  if (error) throw new Error(`Элэгдэл тооцоолох: ${error.message}`);
  return (data ?? []) as DepreciationResult[];
}

// ---------------------------------------------------------------------------
// PARTNER FUZZY-SEARCH RPC (migration 004)
// ---------------------------------------------------------------------------

export type PartnerMatch = {
  partner_id: string;
  name: string;
  similarity: number;
  match_source: "name" | "alias";
};

export async function findPartnerByName(
  sb: Sb,
  companyId: string,
  search: string,
  threshold = 0.4,
): Promise<PartnerMatch[]> {
  const { data, error } = await sb.rpc("find_partner_by_name", {
    p_company_id: companyId,
    p_search: search,
    p_threshold: threshold,
  });
  if (error) throw new Error(`Харилцагч хайх: ${error.message}`);
  return (data ?? []) as PartnerMatch[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** auth_company_ids() — current user's company memberships. */
export async function authCompanyIds(sb: Sb): Promise<string[]> {
  const { data, error } = await sb.rpc("auth_company_ids");
  if (error) throw new Error(`Company ids: ${error.message}`);
  return (data ?? []) as string[];
}

/** period_for_date — find period.id for a date. */
export async function periodForDate(
  sb: Sb,
  companyId: string,
  date: string,
): Promise<string | null> {
  const { data, error } = await sb.rpc("period_for_date", {
    p_company_id: companyId,
    p_date: date,
  });
  if (error) throw new Error(`Period for date: ${error.message}`);
  return (data as string | null) ?? null;
}
